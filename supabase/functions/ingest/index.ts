// supabase/functions/ingest/index.ts
// Ingest: fetch sources (IPv4 + Domains), normalize, insert-if-new, bump last_seen

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

// --- CORS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const IPV4_SOURCES = [
  'https://rules.emergingthreats.net/blockrules/compromised-ips.txt',
  'https://check.torproject.org/torbulkexitlist',
  'https://cinsscore.com/list/ci-badguys.txt',
  'https://lists.blocklist.de/lists/all.txt',
  'https://isc.sans.edu/block.txt',
  'https://raw.githubusercontent.com/borestad/blocklist-abuseipdb/main/abuseipdb-s100-30d.ipv4',
  'https://binarydefense.com/banlist.txt',
  'https://dataplane.org/signals/sshclient.txt',
  'https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt',
  'https://danger.rulez.sk/projects/bruteforceblocker/blist.php',
  'https://blocklist.greensnow.co/greensnow.txt',
  'https://sblam.com/blacklist.txt',
];

const DOMAIN_SOURCES = [
  'https://urlhaus.abuse.ch/downloads/text/',
  'https://urlhaus.abuse.ch/downloads/hostfile/',          // tenere solo colonna dominio
  'https://threatfox.abuse.ch/downloads/hostfile/',        // tenere solo colonna dominio
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf',
  'https://raw.githubusercontent.com/chadmayfield/my-pihole-blocklists/master/lists/pi_blocklist_porn_top1m.list', // opzionale “Porn”
];

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

    const collected: Array<{ indicator: string; kind: 'ipv4' | 'domain'; source: string }> = [];

    // 1) IPv4
    for (const src of IPV4_SOURCES) {
      try {
        const txt = await fetchText(src);
        const norm = normalizeLines(txt, 'ipv4', src);
        collected.push(...norm);
        console.log(`[ingest] IPv4 +${norm.length} from ${src}`);
      } catch (e) {
        console.warn(`[ingest] IPv4 source failed ${src}:`, String(e));
      }
    }

    // 2) Domains
    for (const src of DOMAIN_SOURCES) {
      try {
        const txt = await fetchText(src);
        const norm = normalizeLines(txt, 'domain', src);
        collected.push(...norm);
        console.log(`[ingest] Domains +${norm.length} from ${src}`);
      } catch (e) {
        console.warn(`[ingest] Domain source failed ${src}:`, String(e));
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

    const nowIso = new Date().toISOString();
    const CHUNK = 1000;

    // 4) INSERT IGNORE (solo nuovi): use insert with "ignoreDuplicates: true"
    for (const batch of chunks(deduped, CHUNK)) {
      const toInsert = batch.map((r) => ({
        indicator: r.indicator,
        kind: r.kind,
        source: r.source,
        first_seen: nowIso,
        last_seen: nowIso,
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
          .update({ last_seen: nowIso })
          .eq('source', source)
          .in('indicator', part);
        if (updErr) {
          console.error('[indigest] update last_seen error:', updErr);
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
