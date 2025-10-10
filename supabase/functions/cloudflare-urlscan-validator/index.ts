// Cloudflare URL Scanner Validator - Optimized for 172K+ indicators
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OPTIMIZED PARAMETERS
const BATCH_SIZE = 50;              // Reduced from 1000 → 50 for rate limit safety
const SCAN_DELAY_MS = 2500;         // Increased from 500ms → 2.5s between scans
const POLLING_DELAY_MS = 3000;      // 3s between result polling attempts
const MAX_POLL_ATTEMPTS = 8;        // Max 24s timeout for scan completion
const MAX_RETRIES = 1;              // Quick retry strategy

interface IndicatorToScan {
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

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudflareToken = Deno.env.get('CLOUDFLARE_URLSCAN_API_KEY')!;
    const cloudflareAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;

    if (!cloudflareAccountId) {
      console.error('❌ CLOUDFLARE_ACCOUNT_ID not configured');
      return new Response(
        JSON.stringify({ error: 'CLOUDFLARE_ACCOUNT_ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cloudflareToken) {
      console.error('❌ CLOUDFLARE_URLSCAN_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'CLOUDFLARE_URLSCAN_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Cloudflare URL Scanner Validator started');
    console.log(`⚙️  Config: BATCH_SIZE=${BATCH_SIZE}, DELAY=${SCAN_DELAY_MS}ms`);

    // Step 1: Clean expired cache
    console.log('🧹 Cleaning expired cache...');
    const { error: cleanupError } = await supabase.rpc('clean_expired_cloudflare_urlscan_cache');
    if (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    // Global counters
    let totalScanned = 0;
    let totalCached = 0;
    let totalFailed = 0;
    let batchCount = 0;

    // Step 2: Process ALL indicators in batches until none left
    console.log(`📊 Starting continuous processing (batch size: ${BATCH_SIZE})...`);

    while (true) {
      batchCount++;
      console.log(`\n🔄 ===== Batch ${batchCount} =====`);

      // Fetch next batch of indicators
      const { data: indicators, error: fetchError } = await supabase
        .from('dynamic_raw_indicators')
        .select('id, indicator, kind, confidence')
        .in('kind', ['domain', 'ipv4'])
        .gte('confidence', 50)
        .eq('whitelisted', false)
        .or('cloudflare_urlscan_checked.is.null,cloudflare_urlscan_checked.eq.false')
        .order('confidence', { ascending: false })
        .limit(BATCH_SIZE);

      if (fetchError) {
        console.error('❌ Fetch error:', fetchError);
        throw fetchError;
      }

      // If no more indicators, we're done!
      if (!indicators || indicators.length === 0) {
        console.log('✅ All indicators processed! No more pending scans.');
        break;
      }

      console.log(`🔍 Found ${indicators.length} indicators in batch ${batchCount}`);
      console.log(`   - Domains: ${indicators.filter(i => i.kind === 'domain').length}`);
      console.log(`   - IPs: ${indicators.filter(i => i.kind === 'ipv4').length}`);

      let batchScanned = 0;
      let batchCached = 0;
      let batchFailed = 0;

      // Process each indicator in current batch
      for (const indicator of indicators) {
        try {
          console.log(`\n  🔄 Processing ${indicator.kind}: ${indicator.indicator}...`);

          // Check cache first (7-day TTL)
          const { data: cacheEntry } = await supabase
            .from('cloudflare_urlscan_cache')
            .select('*')
            .eq('indicator', indicator.indicator)
            .eq('kind', indicator.kind)
            .gt('expires_at', new Date().toISOString())
            .single();

          if (cacheEntry) {
            console.log(`  ✓ Cache hit for ${indicator.indicator}`);
            
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
              .eq('id', indicator.id);

            batchCached++;
            totalCached++;
            continue;
          }
          
          // Prepare scan URL based on indicator type
          const scanTargetUrl = indicator.kind === 'ipv4' 
            ? `http://${indicator.indicator}` 
            : `https://${indicator.indicator}`;

          // Submit scan with retry logic
          const scanUrl = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/urlscanner/scan`;
          
          let scanResponse;
          let scanData: { result: ScanSubmission } | null = null;
          let retryCount = 0;
          
          while (retryCount <= MAX_RETRIES) {
            try {
              console.log(`  📤 Submitting scan (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
              scanResponse = await fetch(scanUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${cloudflareToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: scanTargetUrl,
                  visibility: 'unlisted',
                  customHeaders: {},
                }),
              });

              if (scanResponse.ok) {
                scanData = await scanResponse.json();
                break; // Success!
              }
              
              const errorText = await scanResponse.text();
              console.error(`  ⚠️  Scan submission failed (attempt ${retryCount + 1}):`, errorText);
              
              // Check for rate limiting
              if (scanResponse.status === 429) {
                console.warn(`  ⏸️  Rate limited! Waiting longer...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s for rate limit
              }
              
              // Exponential backoff: 2s, 4s
              if (retryCount < MAX_RETRIES) {
                const backoffMs = Math.pow(2, retryCount + 1) * 1000;
                console.log(`  ⏳ Backoff ${backoffMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
              }
              
              retryCount++;
            } catch (fetchError) {
              console.error(`  ❌ Fetch error (attempt ${retryCount + 1}):`, fetchError);
              retryCount++;
              if (retryCount <= MAX_RETRIES) {
                const backoffMs = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
              }
            }
          }

          // If all retries failed
          if (!scanData) {
            console.error(`  ❌ All retries failed for ${indicator.indicator}`);
            batchFailed++;
            totalFailed++;
            
            await supabase
              .from('dynamic_raw_indicators')
              .update({
                cloudflare_urlscan_checked: true,
                cloudflare_urlscan_verdict: 'error',
              })
              .eq('id', indicator.id);
            
            continue;
          }

          const scanUuid = scanData.result.uuid;
          console.log(`  ✓ Scan submitted, UUID: ${scanUuid}`);

          // Poll for results (max 24s)
          let result: ScanResult | null = null;

          for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
            await new Promise(resolve => setTimeout(resolve, POLLING_DELAY_MS));

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
                console.log(`  ✓ Scan completed`);
                break;
              } else if (resultData.result.status === 'failed') {
                console.error(`  ❌ Scan failed`);
                break;
              }
            }
          }

          if (!result || !result.task?.success) {
            console.error(`  ⏱️  Scan timeout/failed for ${indicator.indicator}`);
            batchFailed++;
            totalFailed++;
            
            await supabase
              .from('dynamic_raw_indicators')
              .update({
                cloudflare_urlscan_checked: true,
                cloudflare_urlscan_verdict: 'timeout',
              })
              .eq('id', indicator.id);
            
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

          console.log(`  ✓ Result: ${verdict} (score: ${score})`);

          // Upsert cache
          await supabase
            .from('cloudflare_urlscan_cache')
            .upsert({
              indicator: indicator.indicator,
              kind: indicator.kind,
              scan_id: result.uuid,
              verdict,
              score,
              malicious,
              categories,
              technologies: result.scan?.technologies || null,
              certificates: result.scan?.certificates || null,
              raw_response: result,
              checked_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            });

          // Use RPC to merge validator results atomically
          await supabase.rpc('merge_validator_result', {
            p_indicator: indicator.indicator,
            p_kind: indicator.kind,
            p_new_source: 'cloudflare_urlscan',
            p_confidence: 60,
            p_validator_fields: {
              cloudflare_urlscan_checked: true,
              cloudflare_urlscan_score: score,
              cloudflare_urlscan_malicious: malicious,
              cloudflare_urlscan_categories: categories,
              cloudflare_urlscan_verdict: verdict
            }
          });

          batchScanned++;
          totalScanned++;

          // OPTIMIZED DELAY: 2.5s between scans (rate limit protection)
          await new Promise(resolve => setTimeout(resolve, SCAN_DELAY_MS));

        } catch (error) {
          console.error(`  ❌ Error processing ${indicator.indicator}:`, error);
          batchFailed++;
          totalFailed++;
          
          // Mark as checked to avoid reprocessing
          await supabase
            .from('dynamic_raw_indicators')
            .update({
              cloudflare_urlscan_checked: true,
              cloudflare_urlscan_verdict: 'error',
            })
            .eq('id', indicator.id);
        }
      }

      // Batch summary
      console.log(`\n📊 Batch ${batchCount} Summary:`);
      console.log(`   - Scanned: ${batchScanned}`);
      console.log(`   - Cached: ${batchCached}`);
      console.log(`   - Failed: ${batchFailed}`);
      console.log(`📈 TOTAL Progress: ${totalScanned + totalCached + totalFailed} processed`);
    }

    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const finalSummary = {
      success: true,
      batches_processed: batchCount,
      total_processed: totalScanned + totalCached + totalFailed,
      scanned: totalScanned,
      cached: totalCached,
      failed: totalFailed,
      duration_seconds: totalDuration,
    };

    console.log('\n✅ ===== RUN COMPLETE =====');
    console.log('📊 Final Summary:', finalSummary);
    console.log(`⏱️  Total duration: ${totalDuration}s`);

    return new Response(
      JSON.stringify(finalSummary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
