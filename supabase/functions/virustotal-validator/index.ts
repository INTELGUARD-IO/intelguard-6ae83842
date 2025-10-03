import { supabaseQuery } from '../_shared/supabase-rest.ts';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON secret
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (cronSecret !== expectedSecret) {
      console.log('Invalid or missing CRON secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vtApiKey = Deno.env.get('VIRUSTOTAL_API_KEY');

    if (!vtApiKey) {
      throw new Error('VIRUSTOTAL_API_KEY not configured');
    }

    console.log('Starting VirusTotal validator...\n');

    // Test credentials
    console.log('Testing VirusTotal credentials...');
    const testResponse = await fetch('https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-apikey': vtApiKey,
      },
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Credential test failed:', testResponse.status, errorText);
      throw new Error(`Invalid VirusTotal credentials: ${testResponse.statusText}`);
    }
    console.log('✓ Credentials validated\n');

    // Step 1: Clean expired cache
    console.log('Step 1: Cleaning expired VirusTotal cache entries...');
    await supabaseQuery(
      supabaseUrl,
      supabaseServiceKey,
      'rpc/clean_expired_virustotal_cache',
      'POST'
    );
    console.log('✓ Expired entries cleaned\n');

    // Step 2: Get candidates for validation
    console.log('Step 2: Fetching candidates for VirusTotal validation...');
    const candidates = await supabaseQuery(
      supabaseUrl,
      supabaseServiceKey,
      'dynamic_raw_indicators',
      'GET',
      null,
      '?select=indicator,kind&virustotal_checked=eq.false&order=last_validated.asc&limit=250'
    );

    if (!candidates || candidates.length === 0) {
      console.log('No candidates found for validation');
      return new Response(
        JSON.stringify({ message: 'No candidates to validate', validated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${candidates.length} candidates\n`);

    // Step 3: Process candidates with rate limiting
    // Rate limits: 4 lookups/min, 500/day, 15.5K/month
    const maxPerMinute = 4;
    const maxPerDay = 500;
    const delayBetweenCalls = 15000; // 15 seconds to stay under 4/min
    
    let processed = 0;
    let apiCalls = 0;
    const startTime = Date.now();

    console.log('Step 3: Processing candidates...\n');

    for (const candidate of candidates) {
      if (apiCalls >= maxPerDay) {
        console.log(`Reached daily quota limit (${maxPerDay}), stopping validation`);
        break;
      }

      const { indicator, kind } = candidate;

      try {
        console.log(`Processing ${kind}: ${indicator}`);

        let vtData: any = null;
        let endpoint = '';

        if (kind === 'ipv4') {
          // IP Address lookup
          endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${indicator}`;
          
          const callLogId = await logNetworkCall(supabaseUrl, supabaseServiceKey, {
            call_type: 'validator',
            target_url: endpoint,
            target_name: `VirusTotal IP: ${indicator}`,
            method: 'GET',
            edge_function_name: 'virustotal-validator'
          });
          
          const callStart = Date.now();
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'x-apikey': vtApiKey,
            },
          });

          apiCalls++;

          if (!response.ok) {
            console.error(`VirusTotal API error for ${indicator}:`, response.status);
            continue;
          }

          vtData = await response.json();
          const callDuration = Date.now() - callStart;
          
          if (callLogId) {
            await updateNetworkLog(supabaseUrl, supabaseServiceKey, callLogId, {
              status: 'completed',
              status_code: response.status,
              response_time_ms: callDuration,
              items_processed: 1
            });
          }
        } else if (kind === 'domain') {
          // Domain lookup - first check if it exists
          endpoint = `https://www.virustotal.com/api/v3/domains/${indicator}`;
          
          const callLogId = await logNetworkCall(supabaseUrl, supabaseServiceKey, {
            call_type: 'validator',
            target_url: endpoint,
            target_name: `VirusTotal Domain: ${indicator}`,
            method: 'GET',
            edge_function_name: 'virustotal-validator'
          });
          
          const callStart = Date.now();
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'x-apikey': vtApiKey,
            },
          });

          apiCalls++;
          const callDuration = Date.now() - callStart;

          if (response.ok) {
            vtData = await response.json();
            
            if (callLogId) {
              await updateNetworkLog(supabaseUrl, supabaseServiceKey, callLogId, {
                status: 'completed',
                status_code: response.status,
                response_time_ms: callDuration,
                items_processed: 1
              });
            }
          } else if (response.status === 404) {
            // Domain not found, skip
            console.log(`Domain ${indicator} not found in VirusTotal`);
            
            // Mark as checked anyway
            await supabaseQuery(
              supabaseUrl,
              supabaseServiceKey,
              'dynamic_raw_indicators',
              'PATCH',
              {
                virustotal_checked: true,
                virustotal_score: null,
                virustotal_malicious: false,
              },
              `?indicator=eq.${encodeURIComponent(indicator)}&kind=eq.${kind}`
            );
            processed++;
            continue;
          } else {
            console.error(`VirusTotal API error for ${indicator}:`, response.status);
            continue;
          }
        } else {
          console.log(`Skipping unsupported kind: ${kind}`);
          continue;
        }

        if (!vtData || !vtData.data) {
          console.error(`Invalid response for ${indicator}`);
          continue;
        }

        const attributes = vtData.data.attributes;
        const lastAnalysisStats = attributes.last_analysis_stats || {};
        const reputation = attributes.reputation || 0;

        const maliciousCount = lastAnalysisStats.malicious || 0;
        const suspiciousCount = lastAnalysisStats.suspicious || 0;
        const harmlessCount = lastAnalysisStats.harmless || 0;
        const undetectedCount = lastAnalysisStats.undetected || 0;
        
        const total = maliciousCount + suspiciousCount + harmlessCount + undetectedCount;
        const score = total > 0 ? Math.round((maliciousCount / total) * 100) : 0;
        const isMalicious = maliciousCount > 0;

        console.log(`  Stats - Malicious: ${maliciousCount}, Suspicious: ${suspiciousCount}, Score: ${score}%`);

        // Save to cache
        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'virustotal_cache',
          'POST',
          {
            indicator,
            kind,
            last_analysis_stats: lastAnalysisStats,
            reputation,
            malicious_count: maliciousCount,
            suspicious_count: suspiciousCount,
            harmless_count: harmlessCount,
            undetected_count: undetectedCount,
            checked_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }
        );

        // Save to vendor_checks
        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'vendor_checks',
          'POST',
          {
            indicator,
            kind,
            vendor: 'virustotal',
            score,
            raw: vtData,
            checked_at: new Date().toISOString(),
          }
        );

        // Update dynamic_raw_indicators
        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'dynamic_raw_indicators',
          'PATCH',
          {
            virustotal_checked: true,
            virustotal_score: score,
            virustotal_malicious: isMalicious,
          },
          `?indicator=eq.${encodeURIComponent(indicator)}&kind=eq.${kind}`
        );

        processed++;
        console.log(`  ✓ Processed ${indicator}`);

        // Rate limiting: sleep between calls
        if (apiCalls % maxPerMinute === 0 && apiCalls < maxPerDay) {
          console.log(`Sleeping 15s to respect rate limit (${apiCalls} calls made)...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
        }

      } catch (error) {
        console.error(`Error processing ${indicator}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✓ Validation complete`);
    console.log(`Processed: ${processed}/${candidates.length}`);
    console.log(`API calls: ${apiCalls}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        total: candidates.length,
        apiCalls,
        duration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('VirusTotal validator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
