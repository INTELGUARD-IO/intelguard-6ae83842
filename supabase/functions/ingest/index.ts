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
  priority: number;
  last_attempt: string | null;
}

// Process max 5 sources per invocation to avoid timeout
const MAX_SOURCES_PER_RUN = 5;

// --- Helpers di validazione ---
const isIPv4 = (s: string) =>
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s.trim());

const isDomain = (s: string) =>
  /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(s.trim());

// Helper per estrarre dominio da URL completi
function extractDomain(input: string): string | null {
  try {
    const url = new URL(input.startsWith('http') ? input : `http://${input}`);
    return url.hostname;
  } catch {
    // Se fallisce il parsing, restituisci input originale
    return input;
  }
}

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
  let trimmed = line.trim();
  
  // Rimuovi commenti inline (es: "1.2.3.4 # comment")
  if (trimmed.includes('#')) {
    trimmed = trimmed.split('#')[0].trim();
  }
  if (!trimmed || trimmed.startsWith(';')) return null;

  // Gestisci separatori multipli: spazi, tab, virgole
  const columns = trimmed.split(/[\s,]+/);
  const firstCol = columns[0];

  if (kind === 'ipv4') {
    if (isIPv4(firstCol)) return { indicator: firstCol, kind, source };
  } else {
    // DOMINIO: controlla se prima colonna è IPv4 (formato hostfile)
    if (isIPv4(firstCol) && columns.length > 1) {
      // È un hostfile tipo "127.0.0.1 malicious.com"
      // Prendi la seconda colonna (dominio)
      const dom = columns[1].toLowerCase();
      if (isDomain(dom)) return { indicator: dom, kind, source };
    } else {
      // Formato normale: prendi prima colonna
      let domain = firstCol.toLowerCase();
      
      // Se sembra un URL completo, estrai il dominio
      if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const extracted = extractDomain(domain);
        if (extracted) domain = extracted;
      }
      
      if (isDomain(domain)) return { indicator: domain, kind, source };
    }
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
    console.log('[ingest] Starting optimized ingestion run with rotation…');

    // Fetch enabled sources sorted by priority (desc) and last_attempt (asc, nulls first)
    // This ensures high-priority sources and sources not recently attempted are processed first
    const { data: allSources, error: sourcesError } = await supabase
      .from('ingest_sources')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false })
      .order('last_attempt', { ascending: true, nullsFirst: true });

    if (sourcesError) {
      console.error('[ingest] Failed to fetch sources:', sourcesError);
      throw sourcesError;
    }

    if (!allSources || allSources.length === 0) {
      console.log('[ingest] No enabled sources found');
      return new Response(JSON.stringify({ success: true, count: 0, note: 'no enabled sources' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process only MAX_SOURCES_PER_RUN sources per invocation to avoid timeout
    const sources = allSources.slice(0, MAX_SOURCES_PER_RUN);
    console.log(`[ingest] Processing ${sources.length} of ${allSources.length} enabled sources (batch rotation)`);

    const nowIso = new Date().toISOString();
    const BATCH_SIZE = 5000; // Increased from 1000
    let totalProcessed = 0;

    // Process sources sequentially with memory optimization
    for (const source of sources) {
      const startTime = Date.now();
      let sourceCount = 0;
      let batchNumber = 0;
      let batchBuffer: Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> = [];
      const seen = new Set<string>();
      
      // Create log entry
      const { data: logEntry } = await supabase
        .from('ingest_logs')
        .insert({
          source_id: source.id,
          source_name: source.name,
          status: 'running',
        })
        .select()
        .single();
      
      const logId = logEntry?.id;
      
      try {
        console.log(`[ingest] Starting ${source.name} (${source.kind}) [priority: ${source.priority}]`);
        
        // Mark attempt start
        await supabase
          .from('ingest_sources')
          .update({ last_run: nowIso, last_attempt: nowIso })
          .eq('id', source.id);
        
        for await (const line of fetchTextStream(source.url, 180000)) {
          const normalized = normalizeLine(line, source.kind, source.url);
          if (!normalized) continue;
          
          const key = `${normalized.indicator}||${normalized.source}`;
          if (seen.has(key)) continue;
          seen.add(key);
          
          batchBuffer.push(normalized);
          sourceCount++;
          
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
              console.error('[ingest] Batch insert error:', insErr);
              throw insErr;
            }
            
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
            const elapsed = Date.now() - startTime;
            const rate = (sourceCount / (elapsed / 1000)).toFixed(0);
            console.log(`[ingest] ${source.name}: ${sourceCount} indicators (batch ${batchNumber}, ${rate}/sec)`);
            
            batchBuffer = [];
            
            // Memory management: clear dedup set every 10 batches
            if (batchNumber % 10 === 0) {
              seen.clear();
              await new Promise(resolve => setTimeout(resolve, 10));
            }
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
        const rate = (sourceCount / (duration / 1000)).toFixed(0);
        console.log(`[ingest] ✓ ${source.name}: ${sourceCount} indicators in ${duration}ms (${rate}/sec)`);
        
        // Update source metadata
        await supabase
          .from('ingest_sources')
          .update({
            last_success: new Date().toISOString(),
            last_run: new Date().toISOString(),
            last_attempt: new Date().toISOString(),
            indicators_count: sourceCount,
            last_error: null,
          })
          .eq('id', source.id);
        
        // Update log entry
        if (logId) {
          await supabase
            .from('ingest_logs')
            .update({
              status: 'success',
              completed_at: new Date().toISOString(),
              indicators_fetched: sourceCount,
              duration_ms: duration,
            })
            .eq('id', logId);
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        const duration = Date.now() - startTime;
        const isTimeout = errorMsg.includes('aborted') || errorMsg.includes('timeout');
        
        console.error(`[ingest] ${source.name} failed:`, errorMsg);
        
        // Update source metadata
        await supabase
          .from('ingest_sources')
          .update({
            last_run: new Date().toISOString(),
            last_attempt: new Date().toISOString(),
            last_error: errorMsg,
          })
          .eq('id', source.id);
        
        // Update log entry
        if (logId) {
          await supabase
            .from('ingest_logs')
            .update({
              status: isTimeout ? 'timeout' : 'error',
              completed_at: new Date().toISOString(),
              error_message: errorMsg,
              indicators_fetched: sourceCount,
              duration_ms: duration,
            })
            .eq('id', logId);
        }
      }
    }

    const processed = sources.length;
    const remaining = allSources.length - processed;
    console.log(`[ingest] Completed batch: ${totalProcessed} indicators from ${processed} sources. Remaining: ${remaining}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      count: totalProcessed,
      sources_processed: processed,
      sources_remaining: remaining,
      total_enabled_sources: allSources.length
    }), {
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
