import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    const cronSecretHeader = req.headers.get('x-cron-secret');
    
    if (CRON_SECRET && cronSecretHeader !== CRON_SECRET) {
      console.error('Invalid cron secret');
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting URLScan validator...');

    // Fetch domains to validate (833 per run, prioritize unchecked and multi-source)
    const { data: candidates, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('indicator, kind, source_count, confidence')
      .eq('kind', 'domain')
      .eq('urlscan_checked', false)
      .order('source_count', { ascending: false })
      .order('confidence', { ascending: false })
      .limit(833);

    if (fetchError) {
      console.error('Error fetching candidates:', fetchError);
      throw fetchError;
    }

    if (!candidates || candidates.length === 0) {
      // If no unchecked domains, refresh oldest checked (cache expiry)
      const { data: oldChecked, error: oldError } = await supabase
        .from('vendor_checks')
        .select('indicator')
        .eq('vendor', 'urlscan')
        .lt('checked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(833);

      if (oldError || !oldChecked || oldChecked.length === 0) {
        console.log('No domains to validate');
        return new Response(
          JSON.stringify({ success: true, message: 'No domains to validate' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh these domains
      const { data: refreshCandidates } = await supabase
        .from('dynamic_raw_indicators')
        .select('indicator, kind, source_count, confidence')
        .eq('kind', 'domain')
        .in('indicator', oldChecked.map(d => d.indicator))
        .limit(833);

      if (!refreshCandidates || refreshCandidates.length === 0) {
        console.log('No domains to refresh');
        return new Response(
          JSON.stringify({ success: true, message: 'No domains to refresh' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      candidates.push(...refreshCandidates);
    }

    console.log(`Processing ${candidates.length} domains`);

    let processedCount = 0;
    let apiCallCount = 0;
    const maxCallsPerMinute = 60;
    const maxCallsPerHour = 500;
    const maxCallsPerDay = 4998;

    let minuteStartTime = Date.now();
    let hourStartTime = Date.now();
    let callsThisMinute = 0;
    let callsThisHour = 0;

    // Rate limiting helper
    const checkRateLimit = async () => {
      const now = Date.now();
      
      // Reset minute counter
      if (now - minuteStartTime >= 60000) {
        minuteStartTime = now;
        callsThisMinute = 0;
      }
      
      // Reset hour counter
      if (now - hourStartTime >= 3600000) {
        hourStartTime = now;
        callsThisHour = 0;
      }

      // Check limits
      if (callsThisMinute >= maxCallsPerMinute) {
        const waitTime = 60000 - (now - minuteStartTime);
        console.log(`Rate limit: waiting ${waitTime}ms for minute reset`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        minuteStartTime = Date.now();
        callsThisMinute = 0;
      }

      if (callsThisHour >= maxCallsPerHour) {
        const waitTime = 3600000 - (now - hourStartTime);
        console.log(`Rate limit: waiting ${waitTime}ms for hour reset`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        hourStartTime = Date.now();
        callsThisHour = 0;
      }

      if (apiCallCount >= maxCallsPerDay) {
        console.log(`Daily limit reached: ${maxCallsPerDay} calls`);
        return false;
      }

      return true;
    };

    // Process each domain
    for (const candidate of candidates) {
      if (!(await checkRateLimit())) {
        console.log(`Stopping: daily limit reached at ${processedCount} domains`);
        break;
      }

      try {
        const domain = candidate.indicator;
        console.log(`Validating domain: ${domain}`);

        // Query URLScan.io Search API
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
        callsThisHour++;

        if (!response.ok) {
          if (response.status === 429) {
            console.warn(`Rate limited on domain ${domain}, waiting 60s`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
          console.error(`URLScan API error for ${domain}: ${response.status}`);
          continue;
        }

        const searchData: URLScanSearchResult = await response.json();

        // Calculate malicious score (0-100)
        let maliciousScore = 0;
        let isMalicious = false;
        const recentScans = searchData.results || [];

        // Analyze recent scans (last 30 days)
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

        // Cap score at 100
        maliciousScore = Math.min(maliciousScore, 100);

        // Store in vendor_checks
        const { error: vendorError } = await supabase
          .from('vendor_checks')
          .upsert({
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
          }, {
            onConflict: 'vendor,kind,indicator',
          });

        if (vendorError) {
          console.error(`Error storing vendor check for ${domain}:`, vendorError);
        }

        // Update dynamic_raw_indicators
        const { error: updateError } = await supabase
          .from('dynamic_raw_indicators')
          .update({
            urlscan_checked: true,
            urlscan_score: maliciousScore,
            urlscan_malicious: isMalicious,
          })
          .eq('indicator', domain)
          .eq('kind', 'domain');

        if (updateError) {
          console.error(`Error updating indicator ${domain}:`, updateError);
        }

        processedCount++;

        // Small delay between calls (1 call/sec = 60/min)
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing domain ${candidate.indicator}:`, error);
      }
    }

    console.log(`URLScan validation complete: ${processedCount} domains processed, ${apiCallCount} API calls made`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        api_calls: apiCallCount,
        message: `Validated ${processedCount} domains using ${apiCallCount} API calls`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('URLScan validator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
