const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface URLScanSearchResult {
  results: Array<{
    task: {
      uuid: string;
      time: string;
      url: string;
      visibility: string;
      reportURL?: string;
    };
    page: {
      domain: string;
      asn?: string;
      asnname?: string;
      country?: string;
    };
    verdict?: {
      overall?: {
        score?: number;
        malicious?: boolean;
        hasVerdicts?: boolean;
        categories?: string[];
      };
      urlscan?: {
        score?: number;
        malicious?: boolean;
        categories?: string[];
      };
      engines?: {
        score?: number;
        malicious?: boolean;
        categories?: string[];
      };
      community?: {
        score?: number;
        malicious?: boolean;
        categories?: string[];
      };
    };
  }>;
  total: number;
}

const supabaseQuery = async (
  url: string,
  serviceKey: string,
  table: string,
  method: string = 'GET',
  body?: any,
  query?: string
) => {
  const endpoint = `${url}/rest/v1/${table}${query || ''}`;
  const headers: Record<string, string> = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Supabase error: ${JSON.stringify(data)}`);
  }
  
  return data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    const cronSecretHeader = req.headers.get('x-cron-secret');
    
    if (CRON_SECRET && cronSecretHeader !== CRON_SECRET) {
      console.error('[URLSCAN] Invalid cron secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const urlscanApiKey = Deno.env.get('URLSCAN_API_KEY')!;

    if (!urlscanApiKey) {
      throw new Error('URLSCAN_API_KEY not configured');
    }

    console.log('[URLSCAN] === STARTING VALIDATION RUN ===');

    // Step 1: Fetch domains to validate
    console.log('[URLSCAN] Step 1: Fetching candidate domains...');
    const candidates = await supabaseQuery(
      supabaseUrl,
      supabaseServiceKey,
      'dynamic_raw_indicators',
      'GET',
      null,
      '?select=indicator,kind,source_count,confidence&kind=eq.domain&urlscan_checked=eq.false&order=source_count.desc,confidence.desc&limit=833'
    );

    if (!candidates || candidates.length === 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oldChecked = await supabaseQuery(
        supabaseUrl,
        supabaseServiceKey,
        'vendor_checks',
        'GET',
        null,
        `?select=indicator&vendor=eq.urlscan&checked_at=lt.${sevenDaysAgo}&limit=833`
      );

      if (!oldChecked || oldChecked.length === 0) {
        console.log('[URLSCAN] No domains to validate');
        return new Response(
          JSON.stringify({ success: true, message: 'No domains to validate' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const indicators = oldChecked.map((d: any) => d.indicator).join(',');
      const refreshCandidates = await supabaseQuery(
        supabaseUrl,
        supabaseServiceKey,
        'dynamic_raw_indicators',
        'GET',
        null,
        `?select=indicator,kind,source_count,confidence&kind=eq.domain&indicator=in.(${indicators})&limit=833`
      );

      if (!refreshCandidates || refreshCandidates.length === 0) {
        console.log('[URLSCAN] No domains to refresh');
        return new Response(
          JSON.stringify({ success: true, message: 'No domains to refresh' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      candidates.push(...refreshCandidates);
    }

    console.log(`[URLSCAN] ✓ Step 1 Complete: ${candidates.length} candidate domains found`);

    // Step 2: Process domains with URLScan.io API
    console.log('[URLSCAN] Step 2: Validating domains via URLScan.io API...');
    let processed = 0;
    let validated = 0;
    let errors = 0;
    let maliciousFound = 0;
    let cleanFound = 0;
    let apiCallCount = 0;

    const maxCallsPerMinute = 60;
    const maxCallsPerDay = 4998;

    let minuteStartTime = Date.now();
    let callsThisMinute = 0;

    const checkRateLimit = async () => {
      const now = Date.now();
      
      if (now - minuteStartTime >= 60000) {
        minuteStartTime = now;
        callsThisMinute = 0;
      }

      if (callsThisMinute >= maxCallsPerMinute) {
        const waitTime = 60000 - (now - minuteStartTime);
        console.log(`[URLSCAN] Rate limit: waiting ${waitTime}ms for minute reset`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        minuteStartTime = Date.now();
        callsThisMinute = 0;
      }

      if (apiCallCount >= maxCallsPerDay) {
        console.log(`[URLSCAN] Daily limit reached: ${maxCallsPerDay} calls`);
        return false;
      }

      return true;
    };

    for (const candidate of candidates) {
      if (!(await checkRateLimit())) {
        console.log(`[URLSCAN] Stopping: daily limit reached at ${processed} domains`);
        break;
      }

      try {
        const domain = candidate.indicator;
        processed++;

        const searchUrl = `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}&size=10`;
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'API-Key': urlscanApiKey,
            'Content-Type': 'application/json',
          },
        });

        apiCallCount++;
        callsThisMinute++;

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`[URLSCAN] Rate limited on ${domain}, waiting 60s`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
          console.error(`[URLSCAN] API error for ${domain}: ${response.status}`);
          errors++;
          continue;
        }

        const searchData: URLScanSearchResult = await response.json();

        let maliciousScore = 0;
        let isMalicious = false;
        const recentScans = searchData.results || [];

        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const relevantScans = recentScans.filter(scan => 
          new Date(scan.task.time).getTime() > thirtyDaysAgo
        );

        for (const scan of relevantScans) {
          if (scan.verdict?.overall?.malicious === true) {
            maliciousScore += 30;
            isMalicious = true;
          }
          
          if (scan.verdict?.overall?.hasVerdicts && 
              scan.verdict?.overall?.categories?.includes('phishing')) {
            maliciousScore += 25;
            isMalicious = true;
          }

          if (scan.verdict?.engines?.malicious === true) {
            maliciousScore += 20;
            isMalicious = true;
          }

          if (scan.verdict?.community?.malicious === true) {
            maliciousScore += 15;
          }

          if (scan.task.reportURL) {
            maliciousScore += 10;
          }
        }

        maliciousScore = Math.min(maliciousScore, 100);

        if (maliciousScore > 50) {
          maliciousFound++;
          console.log(`[URLSCAN] ⚠ Malicious: ${domain} (score: ${maliciousScore}%, scans: ${relevantScans.length})`);
        } else {
          cleanFound++;
          console.log(`[URLSCAN] ✓ Clean: ${domain} (score: ${maliciousScore}%, scans: ${relevantScans.length})`);
        }

        // Store in vendor_checks
        try {
          await supabaseQuery(
            supabaseUrl,
            supabaseServiceKey,
            'vendor_checks',
            'POST',
            {
              vendor: 'urlscan',
              kind: 'domain',
              indicator: domain,
              score: maliciousScore,
              raw: {
                total_scans: searchData.total,
                recent_scans: relevantScans.length,
                malicious_verdicts: relevantScans.filter(s => s.verdict?.overall?.malicious).length,
                sample_scans: relevantScans.slice(0, 3),
              },
              checked_at: new Date().toISOString(),
            },
            '?on_conflict=vendor,kind,indicator'
          );
        } catch (vendorError) {
          console.error(`[URLSCAN] Error storing vendor check for ${domain}:`, vendorError);
        }

        // Update dynamic_raw_indicators
        try {
          await supabaseQuery(
            supabaseUrl,
            supabaseServiceKey,
            'dynamic_raw_indicators',
            'PATCH',
            {
              urlscan_checked: true,
              urlscan_score: maliciousScore,
              urlscan_malicious: isMalicious,
            },
            `?indicator=eq.${encodeURIComponent(domain)}&kind=eq.domain`
          );
          validated++;
        } catch (updateError) {
          console.error(`[URLSCAN] Error updating ${domain}:`, updateError);
        }

        // Progress logging
        if (processed % 50 === 0) {
          console.log(`[URLSCAN] Progress: ${processed}/${candidates.length} processed, ${validated} validated`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err: any) {
        errors++;
        console.error(`[URLSCAN] ✗ Error checking ${candidate.indicator}:`, err.message);
      }
    }

    console.log(`[URLSCAN] ✓ Step 2 Complete`);
    console.log(`[URLSCAN] === FINAL STATS ===`);
    console.log(`[URLSCAN] Total processed: ${processed}/${candidates.length}`);
    console.log(`[URLSCAN] Validated: ${validated}`);
    console.log(`[URLSCAN] Malicious found: ${maliciousFound}`);
    console.log(`[URLSCAN] Clean found: ${cleanFound}`);
    console.log(`[URLSCAN] Errors: ${errors}`);
    console.log(`[URLSCAN] API calls made: ${apiCallCount}`);
    console.log(`[URLSCAN] === VALIDATION RUN COMPLETE ===`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processed,
        validated: validated,
        malicious: maliciousFound,
        clean: cleanFound,
        errors: errors,
        api_calls: apiCallCount,
        message: `Validated ${processed} domains using ${apiCallCount} API calls`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[URLSCAN] === ERROR ===', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
