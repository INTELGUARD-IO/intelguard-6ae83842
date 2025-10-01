// supabase/functions/ingest/index.ts
// Ingest: fetch sources (IPv4 + Domains), normalize, insert-if-new, bump last_seen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// --- CORS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Sources are now managed dynamically in the database
interface IngestSource {
  id: string;
  url: string;
  kind: 'ipv4' | 'domain';
  name: string;
  enabled: boolean;
}

// --- Helpers di validazione ---
const isIPv4 = (s: string) =>
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s.trim());

const isDomain = (s: string) =>
  /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(s.trim());

// Stream processing with line-by-line reading for large files
async function* fetchTextStream(url: string, timeoutMs = 120000): AsyncGenerator<string> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { 
        'User-Agent': 'intelguard/ingest/1.0',
        'Accept-Encoding': 'gzip, deflate'
      },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    
    if (!r.body) throw new Error('No response body');
    
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        yield line;
      }
    }
    
    // Yield remaining buffer
    if (buffer) yield buffer;
  } finally {
    clearTimeout(id);
  }
}

// Process a single line and return indicator if valid
function normalizeLine(
  line: string,
  kind: 'ipv4' | 'domain',
  source: string,
): { indicator: string; kind: 'ipv4' | 'domain'; source: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return null;

  // hostfile: prendi la prima colonna (di solito IP o dominio)
  const firstCol = trimmed.split(/\s+/)[0];

  if (kind === 'ipv4') {
    if (isIPv4(firstCol)) return { indicator: firstCol, kind, source };
  } else {
    // domini sempre in lowercase
    const dom = firstCol.toLowerCase();
    if (isDomain(dom)) return { indicator: dom, kind, source };
  }
  return null;
}

// deduplica per (indicator, source)
function dedupeByIndicatorSource<T extends { indicator: string; source: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const res: T[] = [];
  for (const it of arr) {
    const key = `${it.indicator}||${it.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      res.push(it);
    }
  }
  return res;
}

// chunk utility
function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Orchestrator: launches separate jobs for each source
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  if (providedSecret && providedSecret !== secret) {
    console.error('[ingest] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }
  
  if (!providedSecret) {
    console.log('[ingest] Manual test invocation (no cron secret provided)');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('[ingest] Starting orchestration run…');

    // Fetch enabled sources
    const { data: sources, error: sourcesError } = await supabase
      .from('ingest_sources')
      .select('*')
      .eq('enabled', true);

    if (sourcesError) {
      console.error('[ingest] Failed to fetch sources:', sourcesError);
      throw sourcesError;
    }

    if (!sources || sources.length === 0) {
      console.log('[ingest] No enabled sources found');
      return new Response(JSON.stringify({ success: true, count: 0, note: 'no enabled sources' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ingest] Orchestrating ${sources.length} sources via background jobs`);

    const projectUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
    const processFunctionUrl = `${projectUrl}/process-single-source`;
    
    // Launch background jobs for each source (max 3 concurrent)
    const MAX_CONCURRENT = 3;
    const jobs: Promise<void>[] = [];
    
    for (let i = 0; i < sources.length; i += MAX_CONCURRENT) {
      const batch = sources.slice(i, i + MAX_CONCURRENT);
      
      const batchJobs = batch.map(async (source) => {
        try {
          console.log(`[ingest] Launching job for ${source.name}`);
          
          const response = await fetch(processFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'x-cron-secret': secret || '',
            },
            body: JSON.stringify({ sourceId: source.id }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log(`[ingest] ✓ ${source.name} completed: ${result.count} indicators`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[ingest] ✗ ${source.name} failed:`, errorMsg);
          
          // Update source with error
          await supabase
            .from('ingest_sources')
            .update({
              last_run: new Date().toISOString(),
              last_error: errorMsg,
            })
            .eq('id', source.id);
        }
      });

      jobs.push(...batchJobs);
      
      // Wait for current batch to complete before starting next batch
      await Promise.all(batchJobs);
      
      // Small delay between batches to avoid overload
      if (i + MAX_CONCURRENT < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    await Promise.all(jobs);

    console.log('[ingest] All orchestration jobs completed');
    return new Response(JSON.stringify({ 
      success: true, 
      sources_processed: sources.length,
      note: 'Jobs launched via background processing'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest] Orchestration error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
