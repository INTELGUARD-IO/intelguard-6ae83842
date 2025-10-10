// montysecurity-c2-tracker-sync
// Unified sync for 84 Monty Security C2-Tracker sources (C2, Stealer, RAT, Loader, Botnet, Tools)
// Updated weekly (Monday 02:00 UTC) via Shodan/Censys

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const BATCH_SIZE = 1000;
const MAX_CONCURRENT_FETCHES = 10;
const BASE_URL = 'https://raw.githubusercontent.com/montysecurity/C2-Tracker/main/data/';

// Source definitions with category and priority
const SOURCES = [
  // C2 Frameworks (priority 90)
  { name: 'Cobalt Strike', file: 'cobalt_strike.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Metasploit Framework', file: 'metasploit_framework.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Covenant', file: 'covenant.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Mythic', file: 'mythic.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Brute Ratel C4', file: 'brute_ratel_c4.txt', category: 'C2 Framework', priority: 90 },
  { name: 'PoshC2', file: 'posh.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Sliver', file: 'sliver.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Deimos', file: 'deimos.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Panda', file: 'panda.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Nimplant C2', file: 'nimplant_c2.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Havoc C2', file: 'havoc_c2.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Caldera', file: 'caldera.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Empire', file: 'empire.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Ares', file: 'ares.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Hak5 Cloud C2', file: 'hak5_cloud_c2.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Pantegana', file: 'pantegana.txt', category: 'C2 Framework', priority: 90 },
  { name: 'SuperShell', file: 'supershell.txt', category: 'C2 Framework', priority: 90 },
  { name: 'VShell', file: 'vshell.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Villain', file: 'villain.txt', category: 'C2 Framework', priority: 90 },
  { name: 'RedGuard C2', file: 'redguard_c2.txt', category: 'C2 Framework', priority: 90 },
  { name: 'Oyster C2', file: 'oyster_c2.txt', category: 'C2 Framework', priority: 90 },
  { name: 'BYOB C2', file: 'byob_c2.txt', category: 'C2 Framework', priority: 90 },

  // Malware - Stealer (priority 85)
  { name: 'AcidRain Stealer', file: 'acidrain_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Misha Stealer', file: 'misha_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Patriot Stealer', file: 'patriot_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Raxnet Bitcoin Stealer', file: 'raxnet_bitcoin_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Titan Stealer', file: 'titan_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Collector Stealer', file: 'collector_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Mystic Stealer', file: 'mystic_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Gotham Stealer', file: 'gotham_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Meduza Stealer', file: 'meduza_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'RisePro Stealer', file: 'risepro_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Bandit Stealer', file: 'bandit_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Mint Stealer', file: 'mint_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Atlandida Stealer', file: 'atlandida_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Atomic Stealer', file: 'atomic_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Lumma Stealer', file: 'lumma_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Serpent Stealer', file: 'serpent_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Axile Stealer', file: 'axile_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Vector Stealer', file: 'vector_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Z3us Stealer', file: 'z3us_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Rastro Stealer', file: 'rastro_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'DarkEye Stealer', file: 'darkeye_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Agniane Stealer', file: 'agniane_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Epsilon Stealer', file: 'epsilon_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Bahamut Stealer', file: 'bahamut_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Vidar Stealer', file: 'vidar_stealer.txt', category: 'Stealer', priority: 85 },
  { name: 'Spectre Stealer', file: 'spectre_stealer.txt', category: 'Stealer', priority: 85 },

  // Malware - RAT/Trojan (priority 85)
  { name: 'Quasar RAT', file: 'quasar_rat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'ShadowPad', file: 'shadowpad.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'AsyncRAT', file: 'asyncrat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'DCRAT', file: 'dcrat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'BitRAT', file: 'bitrat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'DarkComet Trojan', file: 'darkcomet_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'XtremeRAT Trojan', file: 'xtremerat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'NanoCore RAT', file: 'nanocore_rat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Gh0st RAT', file: 'gh0st_rat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'DarkTrack RAT', file: 'darktrack_rat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'njRAT', file: 'njrat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Remcos Pro RAT', file: 'remcos_pro_rat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Poison Ivy', file: 'poison_ivy_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Orcus RAT', file: 'orcus_rat_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'ZeroAccess Trojan', file: 'zeroaccess_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'HookBot Trojan', file: 'hookbot_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'NetBus Trojan', file: 'netbus_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Mekotio Trojan', file: 'mekotio_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Gozi Trojan', file: 'gozi_trojan.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'VenomRAT', file: 'venomrat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'BlackDolphin', file: 'blackdolphin.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Artemis RAT', file: 'artemis_rat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'SpyAgent', file: 'spyagent.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'SpiceRAT', file: 'spicerat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Dust RAT', file: 'dust_rat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Pupy RAT', file: 'pupy_rat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Kraken RAT', file: 'kraken_rat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'Viper RAT', file: 'viper_rat.txt', category: 'RAT/Trojan', priority: 85 },
  { name: 'SecTop RAT', file: 'sectop_rat.txt', category: 'RAT/Trojan', priority: 85 },

  // Malware - Loader (priority 80)
  { name: 'Godzilla Loader', file: 'godzilla_loader.txt', category: 'Loader', priority: 80 },
  { name: 'Jinx Loader', file: 'jinx_loader.txt', category: 'Loader', priority: 80 },
  { name: 'Netpune Loader', file: 'netpune_loader.txt', category: 'Loader', priority: 80 },
  { name: 'Bumblebee Loader', file: 'bumblebee_loader.txt', category: 'Loader', priority: 80 },

  // Malware - Altri (priority 75)
  { name: 'UNAM Web Panel', file: 'unam_web_panel.txt', category: 'Malware Other', priority: 75 },

  // Tools (priority 70)
  { name: 'XMRig Monero Cryptominer', file: 'xmrig_monero_cryptominer.txt', category: 'Tool', priority: 70 },
  { name: 'GoPhish', file: 'gophish.txt', category: 'Tool', priority: 70 },
  { name: 'Browser Exploitation Framework', file: 'browser_exploitation_framework.txt', category: 'Tool', priority: 70 },
  { name: 'BurpSuite', file: 'burpsuite.txt', category: 'Tool', priority: 70 },
  { name: 'Hashcat', file: 'hashcat.txt', category: 'Tool', priority: 70 },
  { name: 'MobSF', file: 'mobsf.txt', category: 'Tool', priority: 70 },
  { name: 'EvilGoPhish', file: 'evilgophish.txt', category: 'Tool', priority: 70 },
  { name: 'Evilginx', file: 'evilginx.txt', category: 'Tool', priority: 70 },

  // Botnets (priority 90)
  { name: '7777 Botnet', file: '7777.txt', category: 'Botnet', priority: 90 },
  { name: 'BlackNet Botnet', file: 'blacknet.txt', category: 'Botnet', priority: 90 },
  { name: 'Doxerina Botnet', file: 'doxerina.txt', category: 'Botnet', priority: 90 },
  { name: 'Scarab Botnet', file: 'scarab.txt', category: 'Botnet', priority: 90 },
  { name: '63256 Botnet', file: '63256.txt', category: 'Botnet', priority: 90 },
  { name: 'Kaiji Botnet', file: 'kaiji.txt', category: 'Botnet', priority: 90 },
  { name: 'Moobot Botnet', file: 'moobot.txt', category: 'Botnet', priority: 90 },
  { name: 'Mozi Botnet', file: 'mozi.txt', category: 'Botnet', priority: 90 },
];

// Parse and validate IPv4 with strict bogon filtering
function parseIPv4(line: string): string | null {
  const ip = line.trim();
  
  if (!ip || ip.startsWith('#')) return null;
  
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (!match) return null;
  
  const [, o1, o2, o3, o4] = match;
  const octets = [o1, o2, o3, o4].map(Number);
  
  if (octets.some(o => o > 255)) return null;
  
  const [a, b, c, d] = octets;
  
  // Filter private/reserved/bogon ranges
  if (a === 10) return null;
  if (a === 172 && b >= 16 && b <= 31) return null;
  if (a === 192 && b === 168) return null;
  if (a === 0) return null;
  if (a === 127) return null;
  if (a === 169 && b === 254) return null;
  if (a === 100 && b >= 64 && b <= 127) return null;
  if (a >= 224) return null;
  if (a === 255 && b === 255 && c === 255 && d === 255) return null;
  
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

// Process single source
async function processSource(
  supabase: any,
  source: { name: string; file: string; category: string; priority: number }
): Promise<{ success: boolean; ips: number; error?: string }> {
  const url = BASE_URL + source.file;
  const sourceName = `montysecurity_${source.category.toLowerCase().replace(/[\/\s]/g, '_')}_${source.name.toLowerCase().replace(/[\/\s]/g, '_')}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IntelGuard/MontySecurityC2Tracker/1.0',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const content = await response.text();
    const lines = content.split('\n');
    const validIPs: string[] = [];

    for (const line of lines) {
      const ip = parseIPv4(line);
      if (ip) validIPs.push(ip);
    }

    if (validIPs.length > 0) {
      for (let i = 0; i < validIPs.length; i += BATCH_SIZE) {
        const batch = validIPs.slice(i, i + BATCH_SIZE);
        await upsertIPBatch(supabase, batch, sourceName);
      }
    }

    // Update ingest_sources
    await supabase
      .from('ingest_sources')
      .update({
        last_success: new Date().toISOString(),
        last_run: new Date().toISOString(),
        indicators_count: validIPs.length,
        last_error: null,
      })
      .eq('name', `Monty Security - ${source.category} - ${source.name}`);

    return { success: true, ips: validIPs.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    await supabase
      .from('ingest_sources')
      .update({
        last_run: new Date().toISOString(),
        last_error: errorMsg,
      })
      .eq('name', `Monty Security - ${source.category} - ${source.name}`);

    return { success: false, ips: 0, error: errorMsg };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  if (providedSecret && providedSecret !== secret) {
    console.error('[montysecurity-sync] Invalid cron secret');
    return new Response(JSON.stringify({ error: 'forbidden' }), { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startTime = Date.now();

  const networkLogId = await logNetworkCall(supabaseUrl, serviceKey, {
    call_type: 'ingest',
    target_url: BASE_URL,
    target_name: 'Monty Security C2 Tracker (84 sources)',
    method: 'GET',
    edge_function_name: 'montysecurity-c2-tracker-sync',
  });

  try {
    console.log('[montysecurity-sync] 🚀 Starting sync for 84 C2-Tracker sources...');

    // Process sources in batches to respect rate limits
    const results = [];
    for (let i = 0; i < SOURCES.length; i += MAX_CONCURRENT_FETCHES) {
      const batch = SOURCES.slice(i, i + MAX_CONCURRENT_FETCHES);
      const batchResults = await Promise.allSettled(
        batch.map(source => processSource(supabase, source))
      );
      results.push(...batchResults);
    }

    // Aggregate statistics
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalIPs = 0;
    const categoryStats: Record<string, { success: number; ips: number }> = {};

    results.forEach((result, idx) => {
      const source = SOURCES[idx];
      
      if (result.status === 'fulfilled' && result.value.success) {
        totalSuccess++;
        totalIPs += result.value.ips;
        
        if (!categoryStats[source.category]) {
          categoryStats[source.category] = { success: 0, ips: 0 };
        }
        categoryStats[source.category].success++;
        categoryStats[source.category].ips += result.value.ips;
        
        console.log(`[montysecurity-sync] ✅ ${source.category} - ${source.name}: ${result.value.ips} IPs`);
      } else {
        totalFailed++;
        const error = result.status === 'fulfilled' ? result.value.error : 'Promise rejected';
        console.error(`[montysecurity-sync] ❌ ${source.category} - ${source.name}: ${error}`);
      }
    });

    const totalTime = Date.now() - startTime;
    
    console.log('[montysecurity-sync] 📊 SUMMARY:');
    console.log(`[montysecurity-sync]   ✓ Success: ${totalSuccess}/${SOURCES.length}`);
    console.log(`[montysecurity-sync]   ❌ Failed: ${totalFailed}`);
    console.log(`[montysecurity-sync]   📈 Total IPs: ${totalIPs}`);
    console.log(`[montysecurity-sync]   ⏱️  Duration: ${totalTime}ms`);
    
    Object.entries(categoryStats).forEach(([category, stats]) => {
      console.log(`[montysecurity-sync]   ${category}: ${stats.success} sources, ${stats.ips} IPs`);
    });

    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, serviceKey, networkLogId, {
        status: 'completed',
        response_time_ms: totalTime,
        items_processed: totalIPs,
        status_code: 200,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_sources: SOURCES.length,
        successful: totalSuccess,
        failed: totalFailed,
        total_ips: totalIPs,
        category_stats: categoryStats,
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
    
    console.error('[montysecurity-sync] ❌ FATAL ERROR:', errorMsg);

    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, serviceKey, networkLogId, {
        status: 'failed',
        response_time_ms: duration,
        error_message: errorMsg,
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        duration_ms: duration,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
