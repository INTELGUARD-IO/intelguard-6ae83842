import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbuseIPDBCheckResponse {
  data: {
    ipAddress: string;
    isPublic: boolean;
    ipVersion: number;
    isWhitelisted: boolean;
    abuseConfidenceScore: number;
    countryCode: string;
    countryName: string;
    usageType: string;
    isp: string;
    domain: string;
    hostnames: string[];
    isTor: boolean;
    totalReports: number;
    numDistinctUsers: number;
    lastReportedAt: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[abuseipdb-enrich] Starting enrichment run...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const abuseipdbApiKey = Deno.env.get('ABUSEIPDB_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check today's API usage (1000/day limit)
    const today = new Date().toISOString().split('T')[0];
    const { data: todayChecks, error: countError } = await supabase
      .from('vendor_checks')
      .select('id', { count: 'exact', head: true })
      .eq('vendor', 'abuseipdb')
      .gte('checked_at', `${today}T00:00:00Z`)
      .lte('checked_at', `${today}T23:59:59Z`);

    const todayCount = todayChecks || 0;
    const remainingQuota = 1000 - todayCount;

    if (remainingQuota <= 0) {
      console.log('[abuseipdb-enrich] Daily quota exhausted (1000/day)');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Daily API quota exhausted',
          quota_used: todayCount,
          quota_limit: 1000
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[abuseipdb-enrich] Remaining quota: ${remainingQuota}/1000`);

    // Fetch top indicators to enrich (prioritize by confidence and source count)
    const BATCH_SIZE = Math.min(100, remainingQuota); // Process up to 100 at a time
    
    const { data: indicatorsToEnrich, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('indicator, kind, confidence, source_count')
      .eq('kind', 'ipv4')
      .order('confidence', { ascending: false })
      .order('source_count', { ascending: false })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch indicators: ${fetchError.message}`);
    }

    if (!indicatorsToEnrich || indicatorsToEnrich.length === 0) {
      console.log('[abuseipdb-enrich] No indicators to enrich');
      return new Response(
        JSON.stringify({ 
          success: true, 
          enriched: 0,
          message: 'No indicators to enrich'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[abuseipdb-enrich] Enriching ${indicatorsToEnrich.length} indicators...`);

    let enriched = 0;
    let errors = 0;

    for (const indicator of indicatorsToEnrich) {
      try {
        // Check if already enriched recently (within 7 days)
        const { data: existingCheck } = await supabase
          .from('vendor_checks')
          .select('checked_at')
          .eq('indicator', indicator.indicator)
          .eq('vendor', 'abuseipdb')
          .gte('checked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existingCheck) {
          console.log(`[abuseipdb-enrich] Skipping ${indicator.indicator} (recently checked)`);
          continue;
        }

        // Call AbuseIPDB Check API
        const checkUrl = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(indicator.indicator)}&maxAgeInDays=90&verbose`;
        
        const checkResponse = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'Key': abuseipdbApiKey,
            'Accept': 'application/json',
          },
        });

        if (!checkResponse.ok) {
          console.error(`[abuseipdb-enrich] API error for ${indicator.indicator}: ${checkResponse.status}`);
          errors++;
          continue;
        }

        const checkData: AbuseIPDBCheckResponse = await checkResponse.json();
        const ipData = checkData.data;

        // Store enriched data
        const { error: insertError } = await supabase
          .from('vendor_checks')
          .upsert({
            indicator: indicator.indicator,
            kind: indicator.kind,
            vendor: 'abuseipdb',
            score: ipData.abuseConfidenceScore,
            country: ipData.countryName,
            isp: ipData.isp,
            usage_type: ipData.usageType,
            asn: ipData.domain || null,
            raw: ipData,
            checked_at: new Date().toISOString(),
          }, { onConflict: 'indicator,vendor' });

        if (insertError) {
          console.error(`[abuseipdb-enrich] Error storing data for ${indicator.indicator}:`, insertError);
          errors++;
        } else {
          enriched++;
          console.log(`[abuseipdb-enrich] Enriched ${indicator.indicator}: score=${ipData.abuseConfidenceScore}, country=${ipData.countryName}, isp=${ipData.isp}`);
        }

        // Rate limiting: 1 request per second to be safe
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Check quota
        if (enriched >= remainingQuota) {
          console.log('[abuseipdb-enrich] Quota limit reached');
          break;
        }

      } catch (error) {
        console.error(`[abuseipdb-enrich] Error enriching ${indicator.indicator}:`, error);
        errors++;
      }
    }

    console.log(`[abuseipdb-enrich] Enrichment complete: ${enriched} enriched, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        enriched,
        errors,
        quota_used: todayCount + enriched,
        quota_limit: 1000,
        quota_remaining: remainingQuota - enriched
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[abuseipdb-enrich] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
