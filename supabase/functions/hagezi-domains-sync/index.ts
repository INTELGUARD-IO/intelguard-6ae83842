// hagezi-domains-sync
// Downloads large Hagezi Pro domain blocklist, stores in Supabase Storage, then processes in chunks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const HAGEZI_URL = 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt';
const STORAGE_BUCKET = 'whitelists';
const STORAGE_PATH = 'hagezi-pro-domains.txt';
const CHUNK_SIZE = 10000; // Process 10k domains at a time
const BATCH_SIZE = 5000; // DB upsert batch size

// Parse and validate domain according to Hagezi rules
function parseHageziDomain(line: string): string | null {
  // Step 1: Normalize - remove \r, trim, lowercase
  const cleaned = line
    .replace(/\r/g, '')
    .trim()
    .toLowerCase();
  
  // Step 2: Filter out comments, empty lines, whitespace-only
  if (!cleaned || cleaned.startsWith('#') || /^\s*$/.test(cleaned)) {
    return null;
  }
  
  // Step 3: Handle wildcards (*.example.com → example.com)
  let domain = cleaned;
  if (domain.startsWith('*.')) {
    domain = domain.slice(2);
  }
  
  // Step 4: Filter out URLs
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return null;
  }
  
  // Step 5: Validate FQDN format
  // Must be: alphanumeric + hyphens, with dots, ending in TLD
  const fqdnRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
  if (!fqdnRegex.test(domain)) {
    return null;
  }
  
  // Step 6: Filter invalid patterns
  const parts = domain.split('.');
  if (
    domain === 'localhost' ||     // No localhost
    parts.length < 2 ||           // No single TLD (com, net)
    domain.includes('_')          // No underscore in domain names
  ) {
    return null;
  }
  
  return domain;
}

// Batch upsert domains to raw_indicators
async function upsertDomainBatch(
  supabase: any,
  domains: string[],
  source: string
): Promise<void> {
  const now = new Date().toISOString();
  const records = domains.map(indicator => ({
    indicator,
    kind: 'domain',
    source,
    first_seen: now,
    last_seen: now,
  }));
  
  const { error } = await supabase
    .from('raw_indicators')
    .upsert(records, { onConflict: 'indicator,source' });
  
  if (error) {
    throw new Error(`Batch upsert failed: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  if (providedSecret && providedSecret !== secret) {
    console.error('[hagezi-sync] Invalid cron secret');
    return new Response(JSON.stringify({ error: 'forbidden' }), { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startTime = Date.now();
  let totalDomains = 0;
  let validDomains = 0;
  let batchNumber = 0;

  const networkLogId = await logNetworkCall(supabaseUrl, serviceKey, {
    call_type: 'ingest',
    target_url: HAGEZI_URL,
    target_name: 'Hagezi Pro Domains',
    method: 'GET',
    edge_function_name: 'hagezi-domains-sync',
  });

  try {
    console.log('[hagezi-sync] 🚀 Starting Hagezi Pro domain sync...');
    console.log(`[hagezi-sync] 📥 Downloading from: ${HAGEZI_URL}`);

    // === PHASE 1: Download file ===
    const downloadStart = Date.now();
    const response = await fetch(HAGEZI_URL, {
      headers: {
        'User-Agent': 'IntelGuard/Hagezi-Sync/1.0',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const fileContent = await response.text();
    const downloadTime = Date.now() - downloadStart;
    const fileSizeMB = (fileContent.length / 1024 / 1024).toFixed(2);
    
    console.log(`[hagezi-sync] ✅ Downloaded ${fileSizeMB}MB in ${downloadTime}ms`);

    // === PHASE 2: Upload to Storage ===
    const uploadStart = Date.now();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(STORAGE_PATH, fileContent, {
        contentType: 'text/plain',
        upsert: true, // Overwrite existing file
      });

    if (uploadError) {
      console.error('[hagezi-sync] Storage upload error:', uploadError);
      throw uploadError;
    }

    const uploadTime = Date.now() - uploadStart;
    console.log(`[hagezi-sync] 📦 Uploaded to storage in ${uploadTime}ms`);

    // === PHASE 3: Parse and Process ===
    console.log('[hagezi-sync] 🔍 Starting domain parsing...');
    
    const lines = fileContent.split('\n');
    totalDomains = lines.length;
    
    let batch: string[] = [];
    let processedLines = 0;

    for (const line of lines) {
      processedLines++;
      
      const domain = parseHageziDomain(line);
      if (domain) {
        batch.push(domain);
        validDomains++;
        
        // Process in chunks of 10k for progress reporting
        if (batch.length >= CHUNK_SIZE) {
          // Split into DB batch sizes (5k)
          for (let i = 0; i < batch.length; i += BATCH_SIZE) {
            const dbBatch = batch.slice(i, i + BATCH_SIZE);
            await upsertDomainBatch(supabase, dbBatch, 'hagezi_pro');
            batchNumber++;
          }
          
          const progress = ((processedLines / totalDomains) * 100).toFixed(1);
          const rate = (validDomains / ((Date.now() - startTime) / 1000)).toFixed(0);
          console.log(`[hagezi-sync] 📊 Progress: ${progress}% | ${validDomains} valid domains | ${rate}/sec`);
          
          batch = [];
        }
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const dbBatch = batch.slice(i, i + BATCH_SIZE);
        await upsertDomainBatch(supabase, dbBatch, 'hagezi_pro');
        batchNumber++;
      }
    }

    const totalTime = Date.now() - startTime;
    const filterRate = ((validDomains / totalDomains) * 100).toFixed(1);
    
    console.log(`[hagezi-sync] ✅ COMPLETED`);
    console.log(`[hagezi-sync] 📈 Total lines: ${totalDomains}`);
    console.log(`[hagezi-sync] ✓ Valid domains: ${validDomains} (${filterRate}%)`);
    console.log(`[hagezi-sync] ⏱️ Total time: ${totalTime}ms`);
    console.log(`[hagezi-sync] 📦 DB batches: ${batchNumber}`);

    // Update network log
    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, serviceKey, networkLogId, {
        status: 'completed',
        response_time_ms: totalTime,
        items_processed: validDomains,
        status_code: 200,
      });
    }

    // Update ingest_sources
    await supabase
      .from('ingest_sources')
      .update({
        last_success: new Date().toISOString(),
        last_run: new Date().toISOString(),
        indicators_count: validDomains,
        last_error: null,
      })
      .eq('url', HAGEZI_URL);

    return new Response(
      JSON.stringify({
        success: true,
        total_lines: totalDomains,
        valid_domains: validDomains,
        filter_rate: `${filterRate}%`,
        duration_ms: totalTime,
        file_size_mb: fileSizeMB,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    
    console.error('[hagezi-sync] ❌ ERROR:', errorMsg);

    // Update network log
    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, serviceKey, networkLogId, {
        status: 'failed',
        response_time_ms: duration,
        error_message: errorMsg,
        items_processed: validDomains,
      });
    }

    // Update ingest_sources
    await supabase
      .from('ingest_sources')
      .update({
        last_run: new Date().toISOString(),
        last_error: errorMsg,
      })
      .eq('url', HAGEZI_URL);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        valid_domains: validDomains,
        duration_ms: duration,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
