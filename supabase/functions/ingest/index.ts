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

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET only if provided (for cron jobs)
  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  // If a secret is provided, validate it
  if (providedSecret && providedSecret !== secret) {
    console.error('[ingest] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }
  
  // If no secret provided, allow manual testing
  if (!providedSecret) {
    console.log('[ingest] Manual test invocation (no cron secret provided)');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('[ingest] Starting ingestion run…');

    // Fetch enabled sources from database
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

    console.log(`[ingest] Processing ${sources.length} enabled sources`);

    const nowIso = new Date().toISOString();
    const BATCH_SIZE = 1000;
    let totalProcessed = 0;

    // Process each source with streaming
    for (const source of sources) {
      const startTime = Date.now();
      let sourceCount = 0;
      let batchBuffer: Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> = [];
      const seen = new Set<string>(); // Per-source deduplication
      
      try {
        console.log(`[ingest] Starting ${source.name} (${source.kind})`);
        
        // Stream and process line by line
        for await (const line of fetchTextStream(source.url)) {
          const normalized = normalizeLine(line, source.kind, source.url);
          if (!normalized) continue;
          
          // Deduplicate within this source
          const key = `${normalized.indicator}||${normalized.source}`;
          if (seen.has(key)) continue;
          seen.add(key);
          
          batchBuffer.push(normalized);
          sourceCount++;
          
          // Process batch when buffer is full
          if (batchBuffer.length >= BATCH_SIZE) {
            const upsertTime = new Date().toISOString();
            const toInsert = batchBuffer.map((r) => ({
              indicator: r.indicator,
              kind: r.kind,
              source: r.source,
              first_seen: upsertTime,
              last_seen: upsertTime,
            }));
            
            const { error: insErr } = await supabase
              .from('raw_indicators')
              .upsert(toInsert, { onConflict: 'indicator,source', ignoreDuplicates: true });
            
            if (insErr) {
              console.error('[ingest] Batch insert error:', insErr);
              throw insErr;
            }
            
            // Update last_seen for existing records
            const indicators = batchBuffer.map(r => r.indicator);
            const { error: updErr } = await supabase
              .from('raw_indicators')
              .update({ last_seen: upsertTime })
              .eq('source', source.url)
              .in('indicator', indicators);
            
            if (updErr) {
              console.error('[ingest] Batch update error:', updErr);
            }
            
            totalProcessed += batchBuffer.length;
            console.log(`[ingest] ${source.name}: processed ${sourceCount} indicators (batch ${Math.floor(sourceCount / BATCH_SIZE)})`);
            batchBuffer = [];
          }
        }
        
        // Process remaining buffer
        if (batchBuffer.length > 0) {
          const upsertTime = new Date().toISOString();
          const toInsert = batchBuffer.map((r) => ({
            indicator: r.indicator,
            kind: r.kind,
            source: r.source,
            first_seen: upsertTime,
            last_seen: upsertTime,
          }));
          
          const { error: insErr } = await supabase
            .from('raw_indicators')
            .upsert(toInsert, { onConflict: 'indicator,source', ignoreDuplicates: true });
          
          if (insErr) {
            console.error('[ingest] Final batch insert error:', insErr);
            throw insErr;
          }
          
          // Update last_seen for existing records
          const indicators = batchBuffer.map(r => r.indicator);
          const { error: updErr } = await supabase
            .from('raw_indicators')
            .update({ last_seen: upsertTime })
            .eq('source', source.url)
            .in('indicator', indicators);
          
          if (updErr) {
            console.error('[ingest] Final batch update error:', updErr);
          }
          
          totalProcessed += batchBuffer.length;
        }
        
        const duration = Date.now() - startTime;
        console.log(`[ingest] ${source.kind.toUpperCase()} +${sourceCount} from ${source.name} (${duration}ms, ${(sourceCount / (duration / 1000)).toFixed(0)} ind/sec)`);
        
        // Update source success stats
        await supabase
          .from('ingest_sources')
          .update({
            last_success: nowIso,
            last_run: nowIso,
            indicators_count: sourceCount,
            last_error: null,
          })
          .eq('id', source.id);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.warn(`[ingest] ${source.kind.toUpperCase()} source failed ${source.name}:`, errorMsg);
        
        // Update source error stats
        await supabase
          .from('ingest_sources')
          .update({
            last_run: nowIso,
            last_error: errorMsg,
          })
          .eq('id', source.id);
      }
    }

    console.log('[ingest] Done. Total processed:', totalProcessed);
    return new Response(JSON.stringify({ success: true, count: totalProcessed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest] Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
