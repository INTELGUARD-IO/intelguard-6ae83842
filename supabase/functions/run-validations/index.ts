import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VendorResult {
  vendor: string;
  score: number;
  raw: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET
  const secret = Deno.env.get('CRON_SECRET');
  if (req.headers.get('x-cron-secret') !== secret) {
    console.error('Invalid cron secret');
    return new Response('forbidden', { status: 403 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[run-validations] Starting validation run...');

    // Fetch up to 100 PENDING jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('validation_jobs')
      .select('*')
      .eq('status', 'PENDING')
      .order('scheduled_at', { ascending: true })
      .limit(100);

    if (jobsError) {
      console.error('[run-validations] Error fetching jobs:', jobsError);
      throw jobsError;
    }

    console.log(`[run-validations] Processing ${jobs?.length || 0} jobs`);

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // TODO: Get API keys from environment
    // const abuseIPDBKey = Deno.env.get('ABUSEIPDB_API_KEY');
    // const virusTotalKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    // const neutrinoKey = Deno.env.get('NEUTRINO_API_KEY');

    let processedCount = 0;

    for (const job of jobs) {
      try {
        console.log(`[run-validations] Processing ${job.indicator} (${job.kind})`);

        // TODO: Call vendor APIs based on kind
        // For IPv4:
        //   - AbuseIPDB: GET https://api.abuseipdb.com/api/v2/check?ipAddress={ip}
        //     Header: Key: {abuseIPDBKey}
        //     Parse: data.abuseConfidenceScore (0-100)
        //   - VirusTotal: GET https://www.virustotal.com/api/v3/ip_addresses/{ip}
        //     Header: x-apikey: {virusTotalKey}
        //     Parse: data.attributes.last_analysis_stats.malicious / total
        //   - Neutrino: GET https://neutrinoapi.net/ip-info?ip={ip}
        //     Header: API-Key: {neutrinoKey}
        //     Parse: is-proxy, is-vpn, etc.
        //
        // For domains:
        //   - VirusTotal: GET https://www.virustotal.com/api/v3/domains/{domain}
        //   - Similar vendor checks
        //
        // Store each vendor result in vendor_checks table:
        // await supabase.from('vendor_checks').insert({
        //   indicator: job.indicator,
        //   kind: job.kind,
        //   vendor: 'abuseipdb',
        //   score: 85.5,
        //   raw: { ... },
        //   checked_at: new Date().toISOString()
        // });

        const vendorResults: VendorResult[] = [];
        
        // TODO: Implement vendor API calls here
        console.log('[run-validations] TODO: Call AbuseIPDB, VirusTotal, Neutrino APIs');

        // Calculate confidence
        // Rule: Require ≥70 confidence and ≥2 vendors agreeing
        const agreementCount = vendorResults.filter(v => v.score >= 70).length;
        const avgScore = vendorResults.length > 0
          ? vendorResults.reduce((sum, v) => sum + v.score, 0) / vendorResults.length
          : 0;
        
        const meetsThreshold = avgScore >= 70 && agreementCount >= 2;

        if (meetsThreshold) {
          // TODO: Enrich with country/ASN if available
          // For IPs, can use ipapi.co or similar:
          // const geoResp = await fetch(`https://ipapi.co/${job.indicator}/json/`);
          // const geo = await geoResp.json();
          // const country = geo.country_code;
          // const asn = geo.asn;

          const country = null; // TODO: Implement geo enrichment
          const asn = null;

          // Upsert into validated_indicators
          const { error: validatedError } = await supabase
            .from('validated_indicators')
            .upsert({
              indicator: job.indicator,
              kind: job.kind,
              confidence: avgScore,
              last_validated: new Date().toISOString(),
              country,
              asn,
            }, {
              onConflict: 'indicator,kind',
              ignoreDuplicates: false,
            });

          if (validatedError) {
            console.error(`[run-validations] Error upserting validated indicator:`, validatedError);
          } else {
            console.log(`[run-validations] Validated ${job.indicator} with confidence ${avgScore.toFixed(2)}`);
          }
        }

        // Mark job as COMPLETED
        await supabase
          .from('validation_jobs')
          .update({
            status: 'COMPLETED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        processedCount++;
      } catch (jobError) {
        console.error(`[run-validations] Error processing job ${job.id}:`, jobError);
        
        // Increment attempts, mark as FAILED if > 3 attempts
        const newAttempts = (job.attempts || 0) + 1;
        await supabase
          .from('validation_jobs')
          .update({
            status: newAttempts > 3 ? 'FAILED' : 'PENDING',
            attempts: newAttempts,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }

    console.log(`[run-validations] Processed ${processedCount} jobs`);

    return new Response(
      JSON.stringify({ success: true, processed: processedCount }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[run-validations] Error:', error);
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
