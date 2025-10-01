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

// fetch con UA e timeout
async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'intelguard/ingest/1.0' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(id);
  }
}

// normalizza un testo in array {indicator, kind, source}
function normalizeLines(
  txt: string,
  kind: 'ipv4' | 'domain',
  source: string,
): Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> {
  const out: Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    // hostfile: prendi la prima colonna (di solito IP o dominio)
    const firstCol = line.split(/\s+/)[0];

    if (kind === 'ipv4') {
      if (isIPv4(firstCol)) out.push({ indicator: firstCol, kind, source });
    } else {
      // domini sempre in lowercase
      const dom = firstCol.toLowerCase();
      if (isDomain(dom)) out.push({ indicator: dom, kind, source });
    }
  }
  return out;
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

    const collected: Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> = [];
    const nowIso = new Date().toISOString();

    // Process each source
    for (const source of sources) {
      const startTime = Date.now();
      try {
        const txt = await fetchText(source.url);
        const norm = normalizeLines(txt, source.kind, source.url);
        collected.push(...norm);
        
        const duration = Date.now() - startTime;
        console.log(`[ingest] ${source.kind.toUpperCase()} +${norm.length} from ${source.name} (${duration}ms)`);
        
        // Update source success stats
        await supabase
          .from('ingest_sources')
          .update({
            last_success: nowIso,
            last_run: nowIso,
            indicators_count: norm.length,
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

    // 3) Dedup
    const deduped = dedupeByIndicatorSource(collected);
    console.log(`[ingest] Total normalized: ${collected.length} → deduped: ${deduped.length}`);

    if (deduped.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, note: 'no data' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // IMPORTANTISSIMO:
    // Nel tuo schema la UNIQUE è (indicator, source).
    // Il tuo codice iniziale usava onConflict 'indicator,kind,source' → NON combacia.
    // Usiamo insert IGNORE per non toccare first_seen degli esistenti,
    // poi UPDATE del last_seen per tutti gli indicatori toccati.

    const CHUNK = 1000;
    const upsertTime = new Date().toISOString();

    // 4) INSERT IGNORE (solo nuovi): use insert with "ignoreDuplicates: true"
    for (const batch of chunks(deduped, CHUNK)) {
      const toInsert = batch.map((r) => ({
        indicator: r.indicator,
        kind: r.kind,
        source: r.source,
        first_seen: upsertTime,
        last_seen: upsertTime,
      }));

      // Inserisce nuovi, ignora conflitti su (indicator,source)
      const { error: insErr } = await supabase
        .from('raw_indicators')
        .upsert(toInsert, { onConflict: 'indicator,source', ignoreDuplicates: true });

      if (insErr) {
        console.error('[ingest] insert error:', insErr);
        throw insErr;
      }
    }

    // 5) UPDATE last_seen per tutti i record toccati (nuovi o già esistenti)
    // Nota: Supabase non consente update in bulk per IN (multi-colonna) con un'unica chiamata comoda.
    // Facciamo per "source" a blocchi per minimizzare round-trip.
    const bySource = new Map<string, Set<string>>();
    for (const r of deduped) {
      if (!bySource.has(r.source)) bySource.set(r.source, new Set());
      bySource.get(r.source)!.add(r.indicator);
    }

    for (const [source, indicatorsSet] of bySource.entries()) {
      const indicators = Array.from(indicatorsSet);
      for (const part of chunks(indicators, CHUNK)) {
        // Aggiorna last_seen = now() per (source = X AND indicator IN (...))
        const { error: updErr } = await supabase
          .from('raw_indicators')
          .update({ last_seen: upsertTime })
          .eq('source', source)
          .in('indicator', part);
        if (updErr) {
          console.error('[ingest] update last_seen error:', updErr);
          throw updErr;
        }
      }
    }

    console.log('[ingest] Done. Upserted/updated:', deduped.length);
    return new Response(JSON.stringify({ success: true, count: deduped.length }), {
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
