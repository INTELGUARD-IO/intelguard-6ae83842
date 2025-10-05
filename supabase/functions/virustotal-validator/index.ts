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
    // Allow either CRON secret OR valid JWT token
    const cronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    const isValidCronCall = cronSecret === expectedSecret;
    const isAuthenticatedUser = authHeader && authHeader.startsWith('Bearer ');
    
    if (!isValidCronCall && !isAuthenticatedUser) {
      console.log('Unauthorized: Missing CRON secret or JWT authentication');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const executionSource = isValidCronCall ? 'CRON' : 'Manual UI';
    console.log(`Starting VirusTotal validator (source: ${executionSource})...\n`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vtApiKey = Deno.env.get('VIRUSTOTAL_API_KEY');

    if (!vtApiKey) {
      throw new Error('VIRUSTOTAL_API_KEY not configured');
    }

    // Check validator status first
    console.log('Checking validator status...');
    const statusCheck = await supabaseQuery(
      supabaseUrl,
      supabaseServiceKey,
      'validator_status',
      'GET',
      null,
      '?validator_name=eq.virustotal&select=*'
    );

    if (statusCheck && statusCheck.length > 0) {
      const status = statusCheck[0];
      if (status.status === 'quota_exceeded' && status.quota_reset_at) {
        const resetTime = new Date(status.quota_reset_at);
        const now = new Date();
        
        if (now < resetTime) {
          console.log(`⏸️  Validator paused due to quota. Reset at: ${resetTime.toISOString()}`);
          return new Response(
            JSON.stringify({ 
              message: 'Validator paused due to quota exceeded',
              quota_reset_at: resetTime.toISOString(),
              validated: 0
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Reset time passed, reactivate validator
          console.log('✓ Quota reset time passed, reactivating validator');
          await supabaseQuery(
            supabaseUrl,
            supabaseServiceKey,
            'validator_status',
            'PATCH',
            { status: 'active', quota_reset_at: null, last_error: null },
            '?validator_name=eq.virustotal'
          );
        }
      }
    }

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
      
      // Handle quota exceeded (429) gracefully
      if (testResponse.status === 429) {
        console.log('⚠️  VirusTotal quota exceeded, pausing validator');
        
        // Calculate reset time (24 hours from now for daily quota)
        const resetTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Upsert validator status
        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'validator_status',
          'POST',
          {
            validator_name: 'virustotal',
            status: 'quota_exceeded',
            quota_reset_at: resetTime.toISOString(),
            last_error: errorText,
            updated_at: new Date().toISOString()
          }
        );
        
        console.log(`Validator paused until ${resetTime.toISOString()}`);
        
        return new Response(
          JSON.stringify({ 
            message: 'Quota exceeded, validator paused',
            quota_reset_at: resetTime.toISOString(),
            validated: 0
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
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
            // Handle quota exceeded gracefully
            if (response.status === 429) {
              console.log('⚠️  Quota exceeded during processing, pausing validator');
              
              const resetTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
              
              await supabaseQuery(
                supabaseUrl,
                supabaseServiceKey,
                'validator_status',
                'POST',
                {
                  validator_name: 'virustotal',
                  status: 'quota_exceeded',
                  quota_reset_at: resetTime.toISOString(),
                  last_error: 'Quota exceeded during indicator processing',
                  updated_at: new Date().toISOString()
                }
              );
              
              console.log(`Validator paused until ${resetTime.toISOString()}`);
              break; // Stop processing
            }
            
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
            // Handle quota exceeded gracefully
            if (response.status === 429) {
              console.log('⚠️  Quota exceeded during processing, pausing validator');
              
              const resetTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
              
              await supabaseQuery(
                supabaseUrl,
                supabaseServiceKey,
                'validator_status',
                'POST',
                {
                  validator_name: 'virustotal',
                  status: 'quota_exceeded',
                  quota_reset_at: resetTime.toISOString(),
                  last_error: 'Quota exceeded during indicator processing',
                  updated_at: new Date().toISOString()
                }
              );
              
              console.log(`Validator paused until ${resetTime.toISOString()}`);
              break; // Stop processing
            }
            
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

        // Use stored procedure to merge sources atomically
        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'rpc/merge_validator_result',
          'POST',
          {
            p_indicator: indicator,
            p_kind: kind,
            p_new_source: 'virustotal',
            p_confidence: 60, // Default confidence for virustotal
            p_validator_fields: {
              virustotal_checked: true,
              virustotal_score: score,
              virustotal_malicious: isMalicious
            }
          }
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
