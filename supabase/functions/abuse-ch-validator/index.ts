import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseQuery, supabaseRPC } from '../_shared/supabase-rest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawIndicator {
  indicator: string;
  kind: string;
  source: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET
  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  if (providedSecret && providedSecret !== secret) {
    console.error('[ABUSE-CH] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const abuseChApiKey = Deno.env.get('ABUSE_CH_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ABUSE-CH] === STARTING VALIDATION RUN ===');

    // Step 1: Download False Positive List from Abuse.Ch
    console.log('[ABUSE-CH] Step 1: Fetching FP List from Abuse.Ch...');
    const fpResponse = await fetch('https://hunting-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: {
        'Auth-Key': abuseChApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'get_fplist',
        format: 'json'
      })
    });

    if (!fpResponse.ok) {
      throw new Error(`Abuse.Ch API error: ${fpResponse.status} ${fpResponse.statusText}`);
    }

    const fpData = await fpResponse.json();
    console.log(`[ABUSE-CH] Received FP list response with ${fpData?.length || 0} entries`);

    // Step 2: Clean expired entries and update FP list in DB
    console.log('[ABUSE-CH] Step 2: Cleaning expired FP entries...');
    await supabase.rpc('clean_expired_abuse_ch_fplist');

    // Parse and insert new FP list entries
    let fpIndicators: Array<{ indicator: string; kind: string }> = [];
    
    if (fpData && Array.isArray(fpData)) {
      fpIndicators = fpData.map((item: any) => {
        const indicator = typeof item === 'string' ? item : item.indicator || item.value;
        const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(indicator);
        return {
          indicator,
          kind: isIPv4 ? 'ipv4' : 'domain'
        };
      }).filter(item => item.indicator);
    }

    console.log(`[ABUSE-CH] Parsed ${fpIndicators.length} FP indicators`);

    // Upsert FP list in batches
    if (fpIndicators.length > 0) {
      const BATCH_SIZE = 1000;
      for (let i = 0; i < fpIndicators.length; i += BATCH_SIZE) {
        const batch = fpIndicators.slice(i, i + BATCH_SIZE);
        const { error: fpInsertError } = await supabase
          .from('abuse_ch_fplist')
          .upsert(
            batch.map(fp => ({
              indicator: fp.indicator,
              kind: fp.kind,
              added_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            })),
            { onConflict: 'indicator' }
          );

        if (fpInsertError) {
          console.error(`[ABUSE-CH] Error inserting FP batch:`, fpInsertError);
        } else {
          console.log(`[ABUSE-CH] Inserted/updated FP batch ${i / BATCH_SIZE + 1}`);
        }
      }
    }

    console.log(`[ABUSE-CH] ✓ Step 2 Complete: ${fpIndicators.length} FP entries in database`);

    // Step 3: Process raw_indicators and validate against FP list
    console.log('[ABUSE-CH] Step 3: Fetching raw indicators for processing...');
    
    const BATCH_LIMIT = 10000;
    const { data: indicators, error: indicatorsError } = await supabase
      .from('raw_indicators')
      .select('indicator, kind, source')
      .is('removed_at', null)
      .limit(BATCH_LIMIT);

    if (indicatorsError) {
      console.error('[ABUSE-CH] Error fetching indicators:', indicatorsError);
      throw indicatorsError;
    }

    // Aggregate by indicator and kind
    const indicatorMap = new Map<string, RawIndicator & { sources: Set<string> }>();
    
    if (indicators) {
      for (const ind of indicators) {
        const key = `${ind.indicator}||${ind.kind}`;
        if (!indicatorMap.has(key)) {
          indicatorMap.set(key, {
            indicator: ind.indicator,
            kind: ind.kind,
            source: ind.source,
            sources: new Set([ind.source])
          });
        } else {
          indicatorMap.get(key)!.sources.add(ind.source);
        }
      }
    }

    console.log(`[ABUSE-CH] ✓ Step 3 Complete: Processing ${indicatorMap.size} unique indicators`);

    // Step 4: Check against FP list and calculate confidence
    console.log('[ABUSE-CH] Step 4: Validating indicators against FP list...');
    let processedCount = 0;
    let validatedCount = 0;
    let skippedFP = 0;
    let skippedLowConfidence = 0;

    for (const [key, ind] of indicatorMap.entries()) {
      processedCount++;

      // Check if it's in FP list
      const { data: fpCheck } = await supabase
        .from('abuse_ch_fplist')
        .select('indicator')
        .eq('indicator', ind.indicator)
        .eq('kind', ind.kind)
        .maybeSingle();

      const isFalsePositive = !!fpCheck;
      
      if (isFalsePositive) {
        skippedFP++;
        console.log(`[ABUSE-CH] ✗ False Positive: ${ind.indicator} (kind: ${ind.kind})`);
        continue;
      }

      // Calculate confidence based on source count
      const sourceCount = ind.sources.size;
      let confidence = 50;
      if (sourceCount >= 3) confidence = 100;
      else if (sourceCount === 2) confidence = 75;
      else confidence = 60; // Single source gets 60%

      // Only include if confidence >= 50% (lowered threshold to populate initial data)
      if (confidence < 50) {
        skippedLowConfidence++;
        console.log(`[ABUSE-CH] ⊘ Low Confidence: ${ind.indicator} (confidence: ${confidence}%, sources: ${sourceCount})`);
        continue;
      }

      // Insert into dynamic_raw_indicators
      const { error: insertError } = await supabase
        .from('dynamic_raw_indicators')
        .upsert({
          indicator: ind.indicator,
          kind: ind.kind,
          confidence,
          sources: Array.from(ind.sources),
          source_count: sourceCount,
          last_validated: new Date().toISOString(),
          abuse_ch_checked: true,
          abuse_ch_is_fp: false
        }, {
          onConflict: 'indicator,kind'
        });

      if (insertError) {
        console.error(`[ABUSE-CH] Error inserting ${ind.indicator}:`, insertError);
      } else {
        validatedCount++;
        console.log(`[ABUSE-CH] ✓ Validated: ${ind.indicator} (confidence: ${confidence}%, sources: ${sourceCount}, kind: ${ind.kind})`);
      }

      // Progress logging
      if (processedCount % 100 === 0) {
        console.log(`[ABUSE-CH] Progress: ${processedCount}/${indicatorMap.size} processed, ${validatedCount} validated`);
      }

      // Rate limiting
      if (validatedCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[ABUSE-CH] ✓ Step 4 Complete`);
    console.log(`[ABUSE-CH] === FINAL STATS ===`);
    console.log(`[ABUSE-CH] Total processed: ${processedCount}`);
    console.log(`[ABUSE-CH] False positives skipped: ${skippedFP}`);
    console.log(`[ABUSE-CH] Low confidence skipped: ${skippedLowConfidence}`);
    console.log(`[ABUSE-CH] Validated and added: ${validatedCount}`);
    console.log(`[ABUSE-CH] === VALIDATION RUN COMPLETE ===`);

    return new Response(
      JSON.stringify({
        success: true,
        validated: validatedCount,
        skipped_fp: skippedFP,
        skipped_low_confidence: skippedLowConfidence,
        total_processed: processedCount
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ABUSE-CH] === ERROR ===', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
