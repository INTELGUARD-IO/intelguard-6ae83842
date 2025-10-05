import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseQuery, supabaseRPC } from '../_shared/supabase-rest.ts';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbuseIPDBBlacklistEntry {
  ipAddress: string;
  abuseConfidenceScore: number;
  lastReportedAt: string;
}

interface AbuseIPDBBlacklistResponse {
  data: AbuseIPDBBlacklistEntry[];
  meta: {
    generatedAt: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ABUSEIPDB] === STARTING VALIDATION RUN ===');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const abuseipdbApiKey = Deno.env.get('ABUSEIPDB_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 0: Check daily quota before proceeding
    console.log('[ABUSEIPDB] Step 0: Checking daily quota...');
    const { data: quotaData, error: quotaError } = await supabase.rpc('get_current_day_abuseipdb_quota');
    
    if (quotaError) {
      console.error('[ABUSEIPDB] Error checking quota:', quotaError);
      throw new Error(`Failed to check quota: ${quotaError.message}`);
    }

    const quota = quotaData?.[0];
    console.log(`[ABUSEIPDB] Daily quota status: ${quota.used_count}/${quota.daily_limit} calls used, ${quota.remaining_count} remaining`);

    if (quota.remaining_count <= 0) {
      console.error('[ABUSEIPDB] ❌ DAILY QUOTA EXHAUSTED. Aborting validation.');
      return new Response(
        JSON.stringify({ 
          error: 'Daily API quota exhausted', 
          quota: {
            daily_limit: quota.daily_limit,
            used_count: quota.used_count,
            remaining_count: quota.remaining_count
          }
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ABUSEIPDB] ✓ Step 0 Complete: Quota check passed');

    // Step 1: Clean expired entries
    console.log('[ABUSEIPDB] Step 1: Cleaning expired blacklist entries...');
    const { error: cleanError } = await supabase.rpc('clean_expired_abuseipdb_blacklist');
    if (cleanError) {
      console.error('[ABUSEIPDB] Error cleaning expired entries:', cleanError);
    } else {
      console.log('[ABUSEIPDB] ✓ Step 1 Complete: Cleaned expired entries');
    }

    // Step 2: Fetch AbuseIPDB Blacklist (confidenceMinimum=70)
    console.log('[ABUSEIPDB] Step 2: Fetching AbuseIPDB blacklist...');
    const blacklistUrl = 'https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=70&limit=10000';
    
    const networkLogId = await logNetworkCall(supabaseUrl, supabaseKey, {
      call_type: 'validator',
      target_url: blacklistUrl,
      target_name: 'AbuseIPDB Blacklist API',
      method: 'GET',
      edge_function_name: 'abuseipdb-validator',
      items_total: 10000
    });
    
    const startTime = Date.now();
    const blacklistResponse = await fetch(blacklistUrl, {
      method: 'GET',
      headers: {
        'Key': abuseipdbApiKey,
        'Accept': 'application/json',
      },
    });

    if (!blacklistResponse.ok) {
      throw new Error(`AbuseIPDB API error: ${blacklistResponse.status} ${blacklistResponse.statusText}`);
    }

    const blacklistData: AbuseIPDBBlacklistResponse = await blacklistResponse.json();
    const duration = Date.now() - startTime;
    console.log(`[ABUSEIPDB] Fetched ${blacklistData.data.length} IPs from blacklist`);
    
    // Increment quota usage (1 API call made)
    const { error: incrementError } = await supabase.rpc('increment_abuseipdb_usage', { calls_count: 1 });
    if (incrementError) {
      console.error('[ABUSEIPDB] Error incrementing quota:', incrementError);
    } else {
      console.log('[ABUSEIPDB] ✓ Quota incremented (1 call used)');
    }
    
    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, supabaseKey, networkLogId, {
        status: 'completed',
        status_code: blacklistResponse.status,
        response_time_ms: duration,
        items_processed: blacklistData.data.length
      });
    }

    // Step 3: Store blacklist in database (batch upsert)
    console.log('[ABUSEIPDB] Step 3: Storing blacklist in database...');
    const BATCH_SIZE = 1000;
    let stored = 0;

    for (let i = 0; i < blacklistData.data.length; i += BATCH_SIZE) {
      const batch = blacklistData.data.slice(i, i + BATCH_SIZE);
      const entries = batch.map(entry => ({
        indicator: entry.ipAddress,
        abuse_confidence_score: entry.abuseConfidenceScore,
        last_reported_at: entry.lastReportedAt,
      }));

      const { error: upsertError } = await supabase
        .from('abuseipdb_blacklist')
        .upsert(entries, { onConflict: 'indicator' });

      if (upsertError) {
        console.error('[ABUSEIPDB] Error upserting batch:', upsertError);
      } else {
        stored += entries.length;
      }

      if (i + BATCH_SIZE < blacklistData.data.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[ABUSEIPDB] ✓ Step 3 Complete: Stored ${stored} IPs in blacklist cache`);

    // Step 4: Process raw_indicators and validate against blacklist
    console.log('[ABUSEIPDB] Step 4: Processing raw IPv4 indicators...');
    
    const BATCH_LIMIT = 10000;
    const { data: rawIndicators, error: fetchError } = await supabase
      .from('raw_indicators')
      .select('indicator, kind, source')
      .eq('kind', 'ipv4')
      .is('removed_at', null)
      .limit(BATCH_LIMIT);

    if (fetchError) {
      throw new Error(`Failed to fetch raw indicators: ${fetchError.message}`);
    }

    // Manually aggregate
    const aggregated = new Map<string, { sources: Set<string>; kind: string }>();
    for (const row of rawIndicators || []) {
      const key = row.indicator;
      if (!aggregated.has(key)) {
        aggregated.set(key, { sources: new Set(), kind: row.kind });
      }
      aggregated.get(key)!.sources.add(row.source);
    }

    const aggregatedData = Array.from(aggregated.entries()).map(([indicator, data]) => ({
      indicator,
      kind: data.kind,
      sources: Array.from(data.sources),
      source_count: data.sources.size,
    }));

    console.log(`[ABUSEIPDB] ✓ Step 4 Complete: Aggregated ${aggregatedData.length} unique IPv4 indicators`);
    
    // Step 5: Validate indicators
    console.log('[ABUSEIPDB] Step 5: Validating indicators...');
    const validatedCount = await processIndicators(supabase, aggregatedData);
    
    console.log(`[ABUSEIPDB] ✓ Step 5 Complete: Validated ${validatedCount} indicators`);
    console.log(`[ABUSEIPDB] === FINAL STATS ===`);
    console.log(`[ABUSEIPDB] Blacklist entries: ${stored}`);
    console.log(`[ABUSEIPDB] Total processed: ${aggregatedData.length}`);
    console.log(`[ABUSEIPDB] Validated and added: ${validatedCount}`);
    console.log(`[ABUSEIPDB] === VALIDATION RUN COMPLETE ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        blacklist_count: stored,
        processed: aggregatedData.length,
        validated: validatedCount,
        message: 'AbuseIPDB validation completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ABUSEIPDB] === ERROR ===', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processIndicators(supabase: any, indicators: any[]) {
  let processed = 0;
  let validated = 0;
  let skippedLowConfidence = 0;
  let blacklistHits = 0;

  for (const indicator of indicators) {
    try {
      processed++;

      // Check if in AbuseIPDB blacklist
      const { data: blacklistEntry, error: checkError } = await supabase
        .from('abuseipdb_blacklist')
        .select('abuse_confidence_score')
        .eq('indicator', indicator.indicator)
        .maybeSingle();

      if (checkError) {
        console.error(`[ABUSEIPDB] Error checking blacklist for ${indicator.indicator}:`, checkError);
        continue;
      }

      const inBlacklist = !!blacklistEntry;
      const abuseScore = blacklistEntry?.abuse_confidence_score || null;

      if (inBlacklist) {
        blacklistHits++;
        console.log(`[ABUSEIPDB] ⚠ Blacklist Hit: ${indicator.indicator} (AbuseIPDB score: ${abuseScore})`);
      }

      // Calculate confidence based on sources and AbuseIPDB score
      let confidence = 60; // Single source gets 60%
      if (indicator.source_count >= 3) confidence = 100;
      else if (indicator.source_count === 2) confidence = 75;
      else confidence = 60;

      // Boost confidence if in AbuseIPDB blacklist with high score
      if (inBlacklist && abuseScore && abuseScore >= 70) {
        confidence = Math.max(confidence, abuseScore);
      }

      // Only process if confidence >= 50% (lowered threshold to populate initial data)
      if (confidence < 50) {
        skippedLowConfidence++;
        console.log(`[ABUSEIPDB] ⊘ Low Confidence: ${indicator.indicator} (confidence: ${confidence}%, sources: ${indicator.source_count})`);
        continue;
      }

      const { error: upsertError } = await supabase.rpc('merge_validator_result', {
        p_indicator: indicator.indicator,
        p_kind: indicator.kind,
        p_new_source: 'abuseipdb',
        p_confidence: confidence,
        p_validator_fields: {
          abuseipdb_checked: true,
          abuseipdb_score: abuseScore,
          abuseipdb_in_blacklist: inBlacklist
        }
      });

      if (upsertError) {
        console.error(`[ABUSEIPDB] Error upserting ${indicator.indicator}:`, upsertError);
      } else {
        validated++;
        console.log(`[ABUSEIPDB] ✓ Validated: ${indicator.indicator} (confidence: ${confidence}%, sources: ${indicator.source_count}, blacklisted: ${inBlacklist})`);
      }

      // Progress logging
      if (processed % 100 === 0) {
        console.log(`[ABUSEIPDB] Progress: ${processed}/${indicators.length} processed, ${validated} validated`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error) {
      console.error(`[ABUSEIPDB] Error processing ${indicator.indicator}:`, error);
    }
  }

  console.log(`[ABUSEIPDB] Blacklist hits: ${blacklistHits}`);
  console.log(`[ABUSEIPDB] Low confidence skipped: ${skippedLowConfidence}`);
  
  return validated;
}
