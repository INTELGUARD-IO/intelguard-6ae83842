import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    console.error('[abuse-ch-validator] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const abuseChApiKey = Deno.env.get('ABUSE_CH_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[abuse-ch-validator] Starting validation run...');

    // Step 1: Download False Positive List from Abuse.Ch
    console.log('[abuse-ch-validator] Fetching False Positive List from Abuse.Ch...');
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
    console.log(`[abuse-ch-validator] Received FP list response:`, fpData);

    // Step 2: Clean expired entries and update FP list in DB
    console.log('[abuse-ch-validator] Cleaning expired FP entries...');
    await supabase.rpc('clean_expired_abuse_ch_fplist');

    // Parse and insert new FP list entries
    // Abuse.Ch returns a list of indicators in various formats
    let fpIndicators: Array<{ indicator: string; kind: string }> = [];
    
    if (fpData && Array.isArray(fpData)) {
      // Parse the response - adjust based on actual API response format
      fpIndicators = fpData.map((item: any) => {
        // Determine if it's an IP or domain
        const indicator = typeof item === 'string' ? item : item.indicator || item.value;
        const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(indicator);
        return {
          indicator,
          kind: isIPv4 ? 'ipv4' : 'domain'
        };
      }).filter(item => item.indicator);
    }

    console.log(`[abuse-ch-validator] Parsed ${fpIndicators.length} FP indicators`);

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
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            })),
            { onConflict: 'indicator' }
          );

        if (fpInsertError) {
          console.error(`[abuse-ch-validator] Error inserting FP batch:`, fpInsertError);
        } else {
          console.log(`[abuse-ch-validator] Inserted/updated FP batch ${i / BATCH_SIZE + 1}`);
        }
      }
    }

    // Step 3: Process raw_indicators and validate against FP list
    console.log('[abuse-ch-validator] Processing raw indicators...');
    
    // Get aggregated indicators with source count (limit to batch processing)
    const BATCH_LIMIT = 5000;
    const { data: rawIndicators, error: rawError } = await supabase.rpc(
      'exec_sql',
      {
        query: `
          SELECT 
            indicator,
            kind,
            COUNT(DISTINCT source) as source_count,
            ARRAY_AGG(DISTINCT source) as sources
          FROM raw_indicators
          WHERE removed_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM dynamic_raw_indicators dri
              WHERE dri.indicator = raw_indicators.indicator
                AND dri.kind = raw_indicators.kind
                AND dri.last_validated > NOW() - INTERVAL '24 hours'
            )
          GROUP BY indicator, kind
          HAVING COUNT(DISTINCT source) >= 2
          ORDER BY COUNT(DISTINCT source) DESC
          LIMIT ${BATCH_LIMIT}
        `
      }
    );

    // Alternative: direct query if RPC not available
    const { data: indicators, error: indicatorsError } = await supabase
      .from('raw_indicators')
      .select('indicator, kind, source')
      .is('removed_at', null)
      .limit(BATCH_LIMIT);

    if (indicatorsError) {
      console.error('[abuse-ch-validator] Error fetching indicators:', indicatorsError);
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

    console.log(`[abuse-ch-validator] Processing ${indicatorMap.size} unique indicators`);

    // Step 4: Check against FP list and calculate confidence
    let validatedCount = 0;
    let skippedFP = 0;
    let lowConfidence = 0;

    for (const [key, ind] of indicatorMap.entries()) {
      // Check if it's in FP list
      const { data: fpCheck } = await supabase
        .from('abuse_ch_fplist')
        .select('indicator')
        .eq('indicator', ind.indicator)
        .eq('kind', ind.kind)
        .single();

      const isFalsePositive = !!fpCheck;
      
      if (isFalsePositive) {
        skippedFP++;
        continue;
      }

      // Calculate confidence based on source count
      const sourceCount = ind.sources.size;
      const confidence = Math.min((sourceCount / 3) * 100, 100); // 3+ sources = 100% confidence

      // Only include if confidence >= 70%
      if (confidence < 70) {
        lowConfidence++;
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
        console.error(`[abuse-ch-validator] Error inserting ${ind.indicator}:`, insertError);
      } else {
        validatedCount++;
      }

      // Rate limiting: small delay every 100 indicators
      if (validatedCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[abuse-ch-validator] Validation complete:`);
    console.log(`  - Validated: ${validatedCount}`);
    console.log(`  - Skipped (FP): ${skippedFP}`);
    console.log(`  - Skipped (low confidence): ${lowConfidence}`);

    return new Response(
      JSON.stringify({
        success: true,
        validated: validatedCount,
        skipped_fp: skippedFP,
        skipped_low_confidence: lowConfidence,
        total_processed: indicatorMap.size
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[abuse-ch-validator] Error:', error);
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
