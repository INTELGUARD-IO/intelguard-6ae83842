import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DomainToScan {
  id: number;
  indicator: string;
  kind: string;
  confidence: number;
}

interface ScanSubmission {
  uuid: string;
  url: string;
  time: string;
}

interface ScanResult {
  uuid: string;
  status: string;
  time: string;
  url: string;
  task?: {
    uuid: string;
    visibility: string;
    url: string;
    success: boolean;
    effectiveUrl?: string;
    screenshot?: string;
  };
  scan?: {
    summary?: {
      malicious?: boolean;
      categories?: string[];
      verdict?: string;
    };
    technologies?: any[];
    certificates?: any[];
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudflareToken = Deno.env.get('CF_RADAR_TOKEN')!;
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;

    if (!cloudflareAccountId) {
      console.error('❌ CLOUDFLARE_ACCOUNT_ID not configured');
      return new Response(
        JSON.stringify({ error: 'CLOUDFLARE_ACCOUNT_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Cloudflare URL Scanner Validator started');

    // Step 1: Clean expired cache
    console.log('🧹 Cleaning expired cache...');
    const { error: cleanupError } = await supabase.rpc('clean_expired_cloudflare_urlscan_cache');
    if (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    // Step 2: Fetch domains to scan
    const BATCH_SIZE = 50; // Increased batch size for better throughput
    const MAX_RETRIES = 2; // Max retry attempts per scan
    console.log(`📊 Fetching up to ${BATCH_SIZE} domains to scan...`);

    const { data: domains, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('id, indicator, kind, confidence')
      .eq('kind', 'domain')
      .gte('confidence', 50)
      .eq('whitelisted', false)
      .eq('cloudflare_urlscan_checked', false)
      .order('confidence', { ascending: false })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    if (!domains || domains.length === 0) {
      console.log('✅ No domains to scan');
      return new Response(
        JSON.stringify({ message: 'No domains to scan', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Found ${domains.length} domains to scan`);

    let scanned = 0;
    let cached = 0;
    let failed = 0;

    // Step 3: Process each domain
    for (const domain of domains) {
      try {
        console.log(`\n🔄 Processing ${domain.indicator}...`);

        // Check cache first
        const { data: cacheEntry } = await supabase
          .from('cloudflare_urlscan_cache')
          .select('*')
          .eq('indicator', domain.indicator)
          .eq('kind', 'domain')
          .gt('expires_at', new Date().toISOString())
          .single();

        if (cacheEntry) {
          console.log(`✓ Using cached result for ${domain.indicator}`);
          
          // Update dynamic_raw_indicators from cache
          await supabase
            .from('dynamic_raw_indicators')
            .update({
              cloudflare_urlscan_checked: true,
              cloudflare_urlscan_score: cacheEntry.score,
              cloudflare_urlscan_malicious: cacheEntry.malicious,
              cloudflare_urlscan_categories: cacheEntry.categories,
              cloudflare_urlscan_verdict: cacheEntry.verdict,
            })
            .eq('id', domain.id);

          cached++;
          continue;
        }

        // Submit scan with retry logic
        const scanUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/urlscanner/scan`;
        
        let scanResponse;
        let scanData: { result: ScanSubmission } | null = null;
        let retryCount = 0;
        
        while (retryCount <= MAX_RETRIES) {
          try {
            console.log(`📤 Submitting scan for ${domain.indicator} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
            scanResponse = await fetch(scanUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${cloudflareToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: `https://${domain.indicator}`,
                visibility: 'unlisted',
                customHeaders: {},
              }),
            });

            if (scanResponse.ok) {
              scanData = await scanResponse.json();
              break; // Success, exit retry loop
            }
            
            const errorText = await scanResponse.text();
            console.error(`Scan submission failed (attempt ${retryCount + 1}):`, errorText);
            
            // Exponential backoff: 2s, 4s, 8s
            if (retryCount < MAX_RETRIES) {
              const backoffMs = Math.pow(2, retryCount + 1) * 1000;
              console.log(`⏳ Waiting ${backoffMs}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
            
            retryCount++;
          } catch (fetchError) {
            console.error(`Fetch error (attempt ${retryCount + 1}):`, fetchError);
            retryCount++;
            if (retryCount <= MAX_RETRIES) {
              const backoffMs = Math.pow(2, retryCount) * 1000;
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
        }

        // If all retries failed
        if (!scanData) {
          console.error(`❌ All retry attempts failed for ${domain.indicator}`);
          failed++;
          
          await supabase
            .from('dynamic_raw_indicators')
            .update({
              cloudflare_urlscan_checked: true,
              cloudflare_urlscan_verdict: 'error',
            })
            .eq('id', domain.id);
          
          continue;
        }

        const scanUuid = scanData.result.uuid;
        console.log(`✓ Scan submitted for ${domain.indicator}, UUID: ${scanUuid}`);

        // Wait and poll for results (max 60s)
        const maxAttempts = 12; // 12 attempts * 5s = 60s
        let result: ScanResult | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s between polls

          const resultUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/urlscanner/scan/${scanUuid}`;
          const resultResponse = await fetch(resultUrl, {
            headers: {
              'Authorization': `Bearer ${cloudflareToken}`,
            },
          });

          if (resultResponse.ok) {
            const resultData: { result: ScanResult } = await resultResponse.json();
            
            if (resultData.result.task?.success) {
              result = resultData.result;
              console.log(`✓ Scan completed for ${domain.indicator}`);
              break;
            } else if (resultData.result.status === 'failed') {
              console.error(`Scan failed for ${domain.indicator}`);
              break;
            }
          }
        }

        if (!result || !result.task?.success) {
          console.error(`⏱️ Scan timeout or failed for ${domain.indicator}`);
          failed++;
          
          await supabase
            .from('dynamic_raw_indicators')
            .update({
              cloudflare_urlscan_checked: true,
              cloudflare_urlscan_verdict: 'timeout',
            })
            .eq('id', domain.id);
          
          continue;
        }

        // Analyze results
        const summary = result.scan?.summary;
        const malicious = summary?.malicious || false;
        const categories = summary?.categories || [];
        const verdict = summary?.verdict || 'clean';

        // Calculate score (0-100)
        let score = 0;
        if (malicious) {
          score = 85;
          if (categories.includes('Phishing')) score = Math.min(100, score + 15);
          if (categories.includes('Malware')) score = Math.min(100, score + 15);
        }

        console.log(`✓ Analysis complete for ${domain.indicator}: ${verdict} (score: ${score})`);

        // Upsert cache
        await supabase
          .from('cloudflare_urlscan_cache')
          .upsert({
            indicator: domain.indicator,
            kind: 'domain',
            scan_id: result.uuid,
            verdict,
            score,
            malicious,
            categories,
            technologies: result.scan?.technologies || null,
            certificates: result.scan?.certificates || null,
            raw_response: result,
            checked_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });

        // Update dynamic_raw_indicators
        await supabase
          .from('dynamic_raw_indicators')
          .update({
            cloudflare_urlscan_checked: true,
            cloudflare_urlscan_score: score,
            cloudflare_urlscan_malicious: malicious,
            cloudflare_urlscan_categories: categories,
            cloudflare_urlscan_verdict: verdict,
          })
          .eq('id', domain.id);

        scanned++;

        // Small delay between scans
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing ${domain.indicator}:`, error);
        failed++;
        
        // Mark as checked to avoid reprocessing
        await supabase
          .from('dynamic_raw_indicators')
          .update({
            cloudflare_urlscan_checked: true,
            cloudflare_urlscan_verdict: 'error',
          })
          .eq('id', domain.id);
      }
    }

    const summary = {
      processed: scanned + cached + failed,
      scanned,
      cached,
      failed,
    };

    console.log('\n📊 Final Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
