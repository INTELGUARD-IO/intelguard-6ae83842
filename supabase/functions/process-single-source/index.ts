// supabase/functions/process-single-source/index.ts
// Process a single ingest source - optimized for large datasets

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface IngestSource {
  id: string;
  url: string;
  kind: 'ipv4' | 'domain';
  name: string;
}

// Validation helpers
const isIPv4 = (s: string) =>
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s.trim());

const isDomain = (s: string) =>
  /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(s.trim());

// Stream processing with line-by-line reading
async function* fetchTextStream(url: string, timeoutMs = 180000): AsyncGenerator<string> {
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
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        yield line;
      }
    }
    
    if (buffer) yield buffer;
  } finally {
    clearTimeout(id);
  }
}

function normalizeLine(
  line: string,
  kind: 'ipv4' | 'domain',
  source: string,
): { indicator: string; kind: 'ipv4' | 'domain'; source: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return null;

  const firstCol = trimmed.split(/\s+/)[0];

  if (kind === 'ipv4') {
    if (isIPv4(firstCol)) return { indicator: firstCol, kind, source };
  } else {
    const dom = firstCol.toLowerCase();
    if (isDomain(dom)) return { indicator: dom, kind, source };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate secret
  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  if (providedSecret && providedSecret !== secret) {
    console.error('[process-single-source] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Get source info from request body
    const { sourceId } = await req.json();
    
    if (!sourceId) {
      return new Response(JSON.stringify({ error: 'sourceId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch source details
    const { data: source, error: sourceError } = await supabase
      .from('ingest_sources')
      .select('*')
      .eq('id', sourceId)
      .eq('enabled', true)
      .single();

    if (sourceError || !source) {
      console.error('[process-single-source] Source not found:', sourceId);
      return new Response(JSON.stringify({ error: 'Source not found or disabled' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();
    const nowIso = new Date().toISOString();
    const BATCH_SIZE = 7500; // Increased from 1000
    let sourceCount = 0;
    let batchNumber = 0;
    let batchBuffer: Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> = [];
    const seen = new Set<string>();

    console.log(`[process-single-source] Starting ${source.name} (${source.kind})`);

    // Mark run start
    await supabase
      .from('ingest_sources')
      .update({ last_run: nowIso })
      .eq('id', source.id);

    try {
      // Stream and process line by line
      for await (const line of fetchTextStream(source.url)) {
        const normalized = normalizeLine(line, source.kind, source.url);
        if (!normalized) continue;
        
        const key = `${normalized.indicator}||${normalized.source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        
        batchBuffer.push(normalized);
        sourceCount++;
        
        // Process batch when buffer is full
        if (batchBuffer.length >= BATCH_SIZE) {
          batchNumber++;
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
            console.error('[process-single-source] Batch insert error:', insErr);
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
            console.error('[process-single-source] Batch update error:', updErr);
          }
          
          const elapsed = Date.now() - startTime;
          const rate = (sourceCount / (elapsed / 1000)).toFixed(0);
          console.log(`[process-single-source] ${source.name}: processed ${sourceCount} indicators (batch ${batchNumber}, ${rate} ind/sec)`);
          
          batchBuffer = [];
          
          // Free memory periodically
          if (batchNumber % 10 === 0) {
            seen.clear();
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }
      
      // Process remaining buffer
      if (batchBuffer.length > 0) {
        batchNumber++;
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
          console.error('[process-single-source] Final batch insert error:', insErr);
          throw insErr;
        }
        
        const indicators = batchBuffer.map(r => r.indicator);
        const { error: updErr } = await supabase
          .from('raw_indicators')
          .update({ last_seen: upsertTime })
          .eq('source', source.url)
          .in('indicator', indicators);
        
        if (updErr) {
          console.error('[process-single-source] Final batch update error:', updErr);
        }
      }
      
      const duration = Date.now() - startTime;
      const rate = (sourceCount / (duration / 1000)).toFixed(0);
      console.log(`[process-single-source] ✓ ${source.name}: completed ${sourceCount} indicators in ${duration}ms (${rate} ind/sec)`);
      
      // Update source success stats
      await supabase
        .from('ingest_sources')
        .update({
          last_success: new Date().toISOString(),
          last_run: new Date().toISOString(),
          indicators_count: sourceCount,
          last_error: null,
        })
        .eq('id', source.id);

      return new Response(JSON.stringify({ 
        success: true, 
        source: source.name,
        count: sourceCount,
        duration,
        rate: parseInt(rate)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`[process-single-source] ${source.name} failed:`, errorMsg);
      
      // Update source error stats
      await supabase
        .from('ingest_sources')
        .update({
          last_run: new Date().toISOString(),
          last_error: errorMsg,
        })
        .eq('id', source.id);

      throw e;
    }
  } catch (error) {
    console.error('[process-single-source] Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
