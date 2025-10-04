import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CENSYS_BASE_URL = 'https://api.platform.censys.io/v3/global';
const MONTHLY_LIMIT = 100;

// Helper to classify indicator type
function classifyIndicator(indicator: string): 'domain' | 'url' | 'other' {
  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  const domainPattern = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;
  
  const s = indicator.trim();
  if (urlPattern.test(s)) return 'url';
  if (domainPattern.test(s)) return 'domain';
  return 'other';
}

// Extract host and port from URL
function extractHostPort(url: string): { host: string; port: number } | null {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const port = urlObj.port ? Number(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
    return { host, port };
  } catch {
    return null;
  }
}

// Check Censys Web Property
async function checkWebProperty(
  hostname: string,
  port: number,
  apiKey: string,
  logId: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ exists: boolean; raw: any }> {
  const propertyId = `${hostname}:${port}`;
  const url = `${CENSYS_BASE_URL}/asset/webproperty/${encodeURIComponent(propertyId)}`;
  
  console.log(`Checking Censys web property: ${propertyId}`);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      const data = await response.json();
      await updateNetworkLog(supabaseUrl, serviceKey, logId, {
        status: 'completed',
        status_code: response.status,
        response_time_ms: responseTime,
        items_processed: 1
      });
      return { exists: true, raw: data };
    } else if (response.status === 404) {
      await updateNetworkLog(supabaseUrl, serviceKey, logId, {
        status: 'completed',
        status_code: response.status,
        response_time_ms: responseTime,
        items_processed: 0
      });
      return { exists: false, raw: null };
    } else {
      // Other errors (rate limit, etc.)
      const errorText = await response.text();
      await updateNetworkLog(supabaseUrl, serviceKey, logId, {
        status: 'failed',
        status_code: response.status,
        response_time_ms: responseTime,
        error_message: errorText
      });
      console.error(`Censys API error ${response.status}: ${errorText}`);
      return { exists: false, raw: null };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await updateNetworkLog(supabaseUrl, serviceKey, logId, {
      status: 'failed',
      status_code: 0,
      response_time_ms: responseTime,
      error_message: errorMsg
    });
    console.error('Censys API request failed:', errorMsg);
    return { exists: false, raw: null };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Verify CRON secret
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (cronSecret !== expectedSecret) {
      console.error('Invalid CRON secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const censysApiKey = Deno.env.get('CENSYS_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!censysApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('=== Censys Validator Started ===');

    // Step 1: Check monthly usage limit
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_current_month_censys_usage')
      .single();

    if (usageError) {
      console.error('Error getting usage data:', usageError);
      throw usageError;
    }

    const usage = usageData as { api_calls_count: number; remaining_calls: number };
    const remainingCalls = usage.remaining_calls || 0;
    console.log(`Monthly usage: ${usage.api_calls_count}/100, Remaining: ${remainingCalls}`);

    if (remainingCalls <= 0) {
      console.log('Monthly API limit reached. Skipping validation.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Monthly limit reached',
          processed: 0,
          apiCallsMade: 0,
          remaining: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch candidate domains (not yet checked by Censys)
    // Limit to remainingCalls to not exceed monthly limit
    const { data: candidates, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('id, indicator, kind')
      .eq('censys_checked', false)
      .in('kind', ['domain', 'url'])
      .order('source_count', { ascending: false })
      .order('confidence', { ascending: false })
      .limit(Math.min(remainingCalls, 50)); // Process max 50 at a time

    if (fetchError) {
      console.error('Error fetching candidates:', fetchError);
      throw fetchError;
    }

    if (!candidates || candidates.length === 0) {
      console.log('No candidates found for validation');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No candidates to process',
          processed: 0,
          apiCallsMade: 0,
          remaining: remainingCalls
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${candidates.length} candidates for validation`);

    // Step 3: Process each candidate
    let apiCallsMade = 0;
    let successCount = 0;

    for (const candidate of candidates) {
      if (apiCallsMade >= remainingCalls) {
        console.log('Reached monthly limit during processing');
        break;
      }

      const { id, indicator, kind } = candidate;
      const type = classifyIndicator(indicator);
      
      console.log(`Processing ${type}: ${indicator}`);

      let exists = false;
      let rawResponse = null;
      let portsToTry: number[] = [];

      // Determine which ports to try
      if (type === 'url') {
        const hostPort = extractHostPort(indicator);
        if (hostPort) {
          portsToTry = [hostPort.port];
        }
      } else if (type === 'domain') {
        // Try both 443 and 80 for domains
        portsToTry = [443, 80];
      }

      // Check Censys for each port
      for (const port of portsToTry) {
        if (apiCallsMade >= remainingCalls) break;

        const hostname = type === 'url' ? extractHostPort(indicator)?.host : indicator;
        if (!hostname) continue;

        const logId = await logNetworkCall(supabaseUrl, supabaseServiceKey, {
          call_type: 'validator',
          target_name: 'censys.io',
          target_url: `${CENSYS_BASE_URL}/asset/webproperty/${hostname}:${port}`,
          method: 'GET',
          edge_function_name: 'censys-validator',
          metadata: { indicator, kind: type }
        });

        if (!logId) {
          console.error('Failed to create network log');
          continue;
        }

        const result = await checkWebProperty(hostname, port, censysApiKey, logId, supabaseUrl, supabaseServiceKey);
        apiCallsMade++;

        if (result.exists) {
          exists = true;
          rawResponse = result.raw;
          break; // Found on this port, no need to check others
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Calculate score: if exists in Censys, score = 0 (legitimate), otherwise score = 100 (suspicious)
      const censysScore = exists ? 0 : 100;
      const censusMalicious = !exists; // Not found = suspicious/malicious

      // Log the check in vendor_checks
      await supabase.from('vendor_checks').insert({
        indicator,
        kind,
        vendor: 'censys',
        score: censysScore,
        raw: rawResponse,
      });

      // Update the indicator
      const { error: updateError } = await supabase
        .from('dynamic_raw_indicators')
        .update({
          censys_checked: true,
          censys_score: censysScore,
          censys_malicious: censusMalicious,
        })
        .eq('id', id);

      if (updateError) {
        console.error(`Error updating indicator ${indicator}:`, updateError);
      } else {
        successCount++;
        console.log(`Updated ${indicator}: score=${censysScore}, malicious=${censusMalicious}`);
      }
    }

    // Step 4: Update monthly usage counter
    if (apiCallsMade > 0) {
      const { error: incrementError } = await supabase.rpc('increment_censys_usage', {
        calls_count: apiCallsMade
      });

      if (incrementError) {
        console.error('Error incrementing usage counter:', incrementError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`=== Censys Validator Completed in ${duration}ms ===`);
    console.log(`Processed: ${successCount}, API calls made: ${apiCallsMade}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        apiCallsMade,
        remaining: remainingCalls - apiCallsMade,
        duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Censys validator error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

