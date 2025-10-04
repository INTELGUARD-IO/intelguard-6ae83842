import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleSafeBrowsingApiKey = Deno.env.get('GOOGLE_SAFEBROWSING_API_KEY')!;
const cronSecret = Deno.env.get('CRON_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Rate limits: 10k queries/day, 500 queries/minute
const BATCH_SIZE = 200; // URLs per batch
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds to respect 500/min limit
const MAX_INDICATORS_PER_RUN = 4000; // Stay within daily limit

const SAFE_BROWSING_API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

interface ThreatMatch {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: { url: string };
}

function calculateThreatScore(threatTypes: string[]): number {
  if (!threatTypes || threatTypes.length === 0) return 0;

  const weights: Record<string, number> = {
    'MALWARE': 100,
    'SOCIAL_ENGINEERING': 95,
    'UNWANTED_SOFTWARE': 80,
    'POTENTIALLY_HARMFUL_APPLICATION': 70,
    'THREAT_TYPE_UNSPECIFIED': 50,
  };

  const maxWeight = Math.max(...threatTypes.map((t) => weights[t] || 50));
  return maxWeight;
}

function getVerdict(score: number): string {
  if (score >= 90) return 'malicious';
  if (score >= 50) return 'suspicious';
  return 'clean';
}

function canonicalizeUrl(indicator: string, kind: string): string[] {
  // Construct URLs for Safe Browsing API
  if (kind === 'ipv4') {
    return [`http://${indicator}/`];
  } else if (kind === 'domain') {
    // Return both HTTP and HTTPS variants
    return [`http://${indicator}/`, `https://${indicator}/`];
  }
  return [];
}

async function logNetworkCall(
  targetName: string,
  targetUrl: string,
  callType: string,
  method: string = 'POST'
) {
  const { data, error } = await supabase
    .from('network_activity_log')
    .insert({
      target_name: targetName,
      target_url: targetUrl,
      call_type: callType,
      method: method,
      status: 'active',
      edge_function_name: 'google-safebrowsing-validator',
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Failed to log network call:', error);
    return null;
  }
  return data?.id;
}

async function updateNetworkLog(
  logId: string,
  status: string,
  statusCode: number | null,
  itemsProcessed: number,
  responseTimeMs: number,
  errorMessage?: string
) {
  await supabase
    .from('network_activity_log')
    .update({
      status,
      status_code: statusCode,
      items_processed: itemsProcessed,
      response_time_ms: responseTimeMs,
      completed_at: new Date().toISOString(),
      error_message: errorMessage || null,
    })
    .eq('id', logId);
}

async function checkSafeBrowsing(urls: string[]): Promise<Map<string, ThreatMatch[]>> {
  const startTime = Date.now();
  const logId = await logNetworkCall(
    'Google Safe Browsing API',
    SAFE_BROWSING_API_URL,
    'api_call'
  );

  const threatEntries = urls.map((url) => ({ url }));

  const requestBody = {
    client: {
      clientId: 'intelguard',
      clientVersion: '1.0.0',
    },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries,
    },
  };

  try {
    const response = await fetch(`${SAFE_BROWSING_API_URL}?key=${googleSafeBrowsingApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Safe Browsing API error: ${response.status} - ${errorText}`);
      if (logId) {
        await updateNetworkLog(logId, 'error', response.status, 0, responseTimeMs, errorText);
      }
      return new Map();
    }

    const data = await response.json();
    const matches = data.matches || [];

    // Group matches by URL
    const matchMap = new Map<string, ThreatMatch[]>();
    for (const match of matches) {
      const url = match.threat.url;
      if (!matchMap.has(url)) {
        matchMap.set(url, []);
      }
      matchMap.get(url)!.push(match);
    }

    if (logId) {
      await updateNetworkLog(
        logId,
        'completed',
        response.status,
        urls.length,
        responseTimeMs
      );
    }

    console.log(`✅ Checked ${urls.length} URLs, found ${matches.length} threats`);
    return matchMap;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    console.error('❌ Safe Browsing API request failed:', error);
    if (logId) {
      await updateNetworkLog(
        logId,
        'error',
        null,
        0,
        responseTimeMs,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    return new Map();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow either CRON secret OR valid JWT token
  const cronSecretHeader = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('authorization');

  const isValidCronCall = cronSecretHeader === cronSecret;
  const isAuthenticatedUser = authHeader && authHeader.startsWith('Bearer ');

  if (!isValidCronCall && !isAuthenticatedUser) {
    console.error('❌ Unauthorized: Missing CRON secret or authentication');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const executionSource = isValidCronCall ? 'CRON' : 'Manual UI';
  const executionStart = Date.now();
  console.log(`🚀 Google Safe Browsing Validator started (source: ${executionSource})`);

  try {
    // Step 1: Clean expired cache
    console.log('🧹 Cleaning expired cache...');
    await supabase.rpc('clean_expired_safebrowsing_cache');

    // Step 2: Fetch candidates for validation
    console.log(`📊 Fetching up to ${MAX_INDICATORS_PER_RUN} indicators to validate...`);
    const { data: candidates, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('indicator, kind')
      .eq('safebrowsing_checked', false)
      .in('kind', ['ipv4', 'domain'])
      .order('confidence', { ascending: false })
      .order('source_count', { ascending: false })
      .limit(MAX_INDICATORS_PER_RUN);

    if (fetchError) {
      console.error('❌ Failed to fetch candidates:', fetchError);
      throw fetchError;
    }

    if (!candidates || candidates.length === 0) {
      console.log('✅ No indicators to validate');
      return new Response(
        JSON.stringify({ message: 'No indicators to validate', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Found ${candidates.length} indicators to validate`);

    // Step 3: Check existing cache
    const indicatorKeys = candidates.map((c) => `${c.indicator}__${c.kind}`);
    const { data: cachedResults } = await supabase
      .from('google_safebrowsing_cache')
      .select('*')
      .in(
        'indicator',
        candidates.map((c) => c.indicator)
      );

    const cacheMap = new Map<string, any>();
    if (cachedResults) {
      for (const cached of cachedResults) {
        cacheMap.set(`${cached.indicator}__${cached.kind}`, cached);
      }
    }

    // Step 4: Prepare URLs for batch processing
    const urlToIndicatorMap = new Map<string, { indicator: string; kind: string }>();
    const urlsToCheck: string[] = [];

    for (const candidate of candidates) {
      const cacheKey = `${candidate.indicator}__${candidate.kind}`;

      // Check if already in cache
      if (cacheMap.has(cacheKey)) {
        const cached = cacheMap.get(cacheKey);
        // Update dynamic_raw_indicators with cached result
        await supabase
          .from('dynamic_raw_indicators')
          .update({
            safebrowsing_checked: true,
            safebrowsing_score: cached.score,
            safebrowsing_verdict: cached.verdict,
          })
          .eq('indicator', candidate.indicator)
          .eq('kind', candidate.kind);
        continue;
      }

      // Generate URLs for this indicator
      const urls = canonicalizeUrl(candidate.indicator, candidate.kind);
      for (const url of urls) {
        urlsToCheck.push(url);
        urlToIndicatorMap.set(url, candidate);
      }
    }

    console.log(`🔍 Checking ${urlsToCheck.length} URLs via Safe Browsing API`);

    // Step 5: Process in batches with rate limiting
    let totalProcessed = 0;
    let totalThreats = 0;

    for (let i = 0; i < urlsToCheck.length; i += BATCH_SIZE) {
      const batch = urlsToCheck.slice(i, i + BATCH_SIZE);
      console.log(
        `📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(urlsToCheck.length / BATCH_SIZE)} (${batch.length} URLs)`
      );

      const matchMap = await checkSafeBrowsing(batch);

      // Step 6: Process results and save to database
      const indicatorsProcessed = new Set<string>();

      for (const url of batch) {
        const candidate = urlToIndicatorMap.get(url);
        if (!candidate) continue;

        const indicatorKey = `${candidate.indicator}__${candidate.kind}`;
        if (indicatorsProcessed.has(indicatorKey)) continue;

        const matches = matchMap.get(url) || [];
        const threatTypes = matches.map((m) => m.threatType);
        const platformTypes = matches.map((m) => m.platformType);
        const threatEntryTypes = matches.map((m) => m.threatEntryType);
        const isThreat = matches.length > 0;
        const score = calculateThreatScore(threatTypes);
        const verdict = getVerdict(score);

        if (isThreat) {
          totalThreats++;
        }

        // Save to cache
        await supabase.from('google_safebrowsing_cache').upsert({
          indicator: candidate.indicator,
          kind: candidate.kind,
          threat_types: threatTypes,
          platform_types: platformTypes,
          threat_entry_types: threatEntryTypes,
          is_threat: isThreat,
          score,
          verdict,
          raw_response: matches.length > 0 ? { matches } : null,
          checked_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

        // Save to vendor_checks
        await supabase.from('vendor_checks').insert({
          vendor: 'google_safebrowsing',
          indicator: candidate.indicator,
          kind: candidate.kind,
          score,
          raw: matches.length > 0 ? { matches, verdict } : null,
        });

        // Update dynamic_raw_indicators
        await supabase
          .from('dynamic_raw_indicators')
          .update({
            safebrowsing_checked: true,
            safebrowsing_score: score,
            safebrowsing_verdict: verdict,
          })
          .eq('indicator', candidate.indicator)
          .eq('kind', candidate.kind);

        indicatorsProcessed.add(indicatorKey);
        totalProcessed++;
      }

      // Rate limiting: wait between batches
      if (i + BATCH_SIZE < urlsToCheck.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    const executionTime = Date.now() - executionStart;
    console.log(
      `✅ Validation completed: ${totalProcessed} indicators processed, ${totalThreats} threats detected in ${executionTime}ms`
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        threats_detected: totalThreats,
        execution_time_ms: executionTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in google-safebrowsing-validator:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
