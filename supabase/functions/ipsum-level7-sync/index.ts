// ipsum-level7-sync
// Syncs IPsum Level 7 (most dangerous IPs) with strict IPv4 validation and bogon filtering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const IPSUM_URL = 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/7.txt';
const BATCH_SIZE = 1000;

// Parse and validate IPv4 with strict bogon filtering (same as abuseipdb)
function parseIPv4(line: string): string | null {
  const ip = line.trim();
  
  // Step 1: Skip empty lines and comments
  if (!ip || ip.startsWith('#')) {
    return null;
  }
  
  // Step 2: Validate IPv4 format (A.B.C.D)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (!match) {
    return null; // Not a valid IPv4 format
  }
  
  // Step 3: Parse octets and validate range (0-255)
  const [, o1, o2, o3, o4] = match;
  const octets = [o1, o2, o3, o4].map(Number);
  
  if (octets.some(o => o > 255)) {
    return null; // Octet out of range
  }
  
  // Step 4: Filter private/reserved/bogon IP ranges
  const [a, b, c, d] = octets;
  
  // RFC1918 Private Networks
  if (a === 10) return null;                                  // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return null;           // 172.16.0.0/12
  if (a === 192 && b === 168) return null;                    // 192.168.0.0/16
  
  // Reserved/Special Use
  if (a === 0) return null;                                   // 0.0.0.0/8 (this network)
  if (a === 127) return null;                                 // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return null;                    // 169.254.0.0/16 (link-local)
  if (a === 100 && b >= 64 && b <= 127) return null;          // 100.64.0.0/10 (CGNAT)
  
  // Multicast and Reserved
  if (a >= 224) return null;                                  // 224.0.0.0/4 (multicast + reserved)
  if (a === 255 && b === 255 && c === 255 && d === 255) {    // 255.255.255.255 (broadcast)
    return null;
  }
  
  return ip;
}

// Batch upsert IPs to raw_indicators
async function upsertIPBatch(
  supabase: any,
  ips: string[],
  source: string
): Promise<void> {
  const now = new Date().toISOString();
  const records = ips.map(indicator => ({
    indicator,
    kind: 'ipv4',
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
    console.error('[ipsum-sync] Invalid cron secret');
    return new Response(JSON.stringify({ error: 'forbidden' }), { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startTime = Date.now();
  let totalLines = 0;
  let validIPs = 0;
  let filteredBogons = 0;
  let filteredInvalid = 0;

  const networkLogId = await logNetworkCall(supabaseUrl, serviceKey, {
    call_type: 'ingest',
    target_url: IPSUM_URL,
    target_name: 'IPsum Level 7',
    method: 'GET',
    edge_function_name: 'ipsum-level7-sync',
  });

  try {
    console.log('[ipsum-sync] 🚀 Starting IPsum Level 7 sync...');
    console.log(`[ipsum-sync] 📥 Fetching from: ${IPSUM_URL}`);

    // === PHASE 1: Download file ===
    const response = await fetch(IPSUM_URL, {
      headers: {
        'User-Agent': 'IntelGuard/IPsum-Sync/1.0',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const fileContent = await response.text();
    console.log(`[ipsum-sync] ✅ Downloaded ${(fileContent.length / 1024).toFixed(1)}KB`);

    // === PHASE 2: Parse and Filter ===
    const lines = fileContent.split('\n');
    totalLines = lines.length;
    
    const validIPsBatch: string[] = [];

    for (const line of lines) {
      const ip = parseIPv4(line);
      
      if (ip) {
        validIPsBatch.push(ip);
        validIPs++;
      } else if (line.trim() && !line.trim().startsWith('#')) {
        // Line was not empty/comment but failed validation
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(line.trim())) {
          filteredBogons++; // Valid format but bogon/private
        } else {
          filteredInvalid++; // Invalid format
        }
      }
    }

    console.log(`[ipsum-sync] 📊 Parsed ${totalLines} lines:`);
    console.log(`[ipsum-sync]   ✓ Valid public IPs: ${validIPs}`);
    console.log(`[ipsum-sync]   🚫 Filtered bogons/private: ${filteredBogons}`);
    console.log(`[ipsum-sync]   ❌ Invalid format: ${filteredInvalid}`);

    // === PHASE 3: Upsert to Database ===
    if (validIPsBatch.length > 0) {
      // Split into batches
      for (let i = 0; i < validIPsBatch.length; i += BATCH_SIZE) {
        const batch = validIPsBatch.slice(i, i + BATCH_SIZE);
        await upsertIPBatch(supabase, batch, 'ipsum_level7');
      }
    }

    const totalTime = Date.now() - startTime;
    const acceptRate = ((validIPs / totalLines) * 100).toFixed(1);
    
    console.log(`[ipsum-sync] ✅ COMPLETED in ${totalTime}ms`);
    console.log(`[ipsum-sync] 📈 Accept rate: ${acceptRate}%`);

    // Update network log
    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, serviceKey, networkLogId, {
        status: 'completed',
        response_time_ms: totalTime,
        items_processed: validIPs,
        status_code: 200,
      });
    }

    // Update ingest_sources
    await supabase
      .from('ingest_sources')
      .update({
        last_success: new Date().toISOString(),
        last_run: new Date().toISOString(),
        indicators_count: validIPs,
        last_error: null,
      })
      .eq('url', IPSUM_URL);

    return new Response(
      JSON.stringify({
        success: true,
        total_lines: totalLines,
        valid_ips: validIPs,
        filtered_bogons: filteredBogons,
        filtered_invalid: filteredInvalid,
        accept_rate: `${acceptRate}%`,
        duration_ms: totalTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    
    console.error('[ipsum-sync] ❌ ERROR:', errorMsg);

    // Update network log
    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, serviceKey, networkLogId, {
        status: 'failed',
        response_time_ms: duration,
        error_message: errorMsg,
        items_processed: validIPs,
      });
    }

    // Update ingest_sources
    await supabase
      .from('ingest_sources')
      .update({
        last_run: new Date().toISOString(),
        last_error: errorMsg,
      })
      .eq('url', IPSUM_URL);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        valid_ips: validIPs,
        duration_ms: duration,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
