import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IPQS_API_KEY = Deno.env.get('IPQS_API_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 30; // 30 domains/day = ~900/month
const BASE_URL = 'https://www.ipqualityscore.com/api/json/url';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      console.log('❌ Unauthorized: Invalid cron secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🔍 IPQualityScore Validator started');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check monthly quota
    const { data: quotaData, error: quotaError } = await supabase.rpc('get_current_month_ipqs_quota');
    
    if (quotaError) {
      console.error('❌ Error fetching quota:', quotaError);
      throw new Error(`Quota error: ${quotaError.message}`);
    }

    const quota = quotaData?.[0];
    
    if (!quota || quota.remaining_calls < BATCH_SIZE) {
      console.log(`⚠️ Insufficient quota: ${quota?.remaining_calls || 0} remaining (need ${BATCH_SIZE})`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Quota exhausted for this month',
        remaining: quota?.remaining_calls || 0,
        needed: BATCH_SIZE
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`✅ Quota check passed: ${quota.remaining_calls} calls remaining`);

    // 2. Fetch high-priority domains (confidence >= 70, not yet checked by IPQS)
    const { data: domains, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('id, indicator, confidence, last_validated')
      .eq('kind', 'domain')
      .eq('ipqs_checked', false)
      .gte('confidence', 70)
      .order('confidence', { ascending: false })
      .order('last_validated', { ascending: false })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('❌ Error fetching domains:', fetchError);
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!domains || domains.length === 0) {
      console.log('✅ No domains to validate');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        message: 'No domains need IPQS validation'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Processing ${domains.length} domains`);
    let processed = 0;
    let cached = 0;
    let errors = 0;

    for (const domain of domains) {
      try {
        console.log(`\n🔄 Processing domain: ${domain.indicator} (confidence: ${domain.confidence})`);

        // 3. Check cache (24h TTL)
        const { data: cacheHit } = await supabase
          .from('ipqualityscore_cache')
          .select('*')
          .eq('indicator', domain.indicator)
          .eq('kind', 'domain')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        let result;
        let finalScore;
        let isMalicious;
        let category;

        if (cacheHit) {
          console.log(`💾 Cache hit for ${domain.indicator}`);
          
          // Calculate score from cache
          const riskScore = cacheHit.risk_score || 0;
          const penalties = 
            (cacheHit.malware ? 30 : 0) +
            (cacheHit.phishing ? 30 : 0) +
            (cacheHit.spamming ? 10 : 0) +
            (cacheHit.suspicious ? 10 : 0);
          
          finalScore = Math.min(100, riskScore + penalties);
          isMalicious = finalScore >= 70;
          category = cacheHit.category || 'unknown';
          result = cacheHit.raw_response;
          cached++;
        } else {
          // 4. Call IPQS API
          const encodedDomain = encodeURIComponent(domain.indicator);
          const apiUrl = `${BASE_URL}/${IPQS_API_KEY}/${encodedDomain}`;
          
          console.log(`🌐 Calling IPQS API for: ${domain.indicator}`);
          const response = await fetch(apiUrl);
          const data = await response.json();

          if (!data.success) {
            console.error(`❌ API error for ${domain.indicator}: ${data.message}`);
            errors++;
            continue;
          }

          console.log(`✅ API response for ${domain.indicator}: risk_score=${data.risk_score}, malware=${data.malware}, phishing=${data.phishing}`);

          // 5. Calculate malicious score
          const riskScore = data.risk_score || 0;
          const penalties = 
            (data.malware ? 30 : 0) +
            (data.phishing ? 30 : 0) +
            (data.spamming ? 10 : 0) +
            (data.suspicious ? 10 : 0);
          
          finalScore = Math.min(100, riskScore + penalties);
          isMalicious = finalScore >= 70;

          // Determine category
          if (data.malware) category = 'malware';
          else if (data.phishing) category = 'phishing';
          else if (data.parking) category = 'parking';
          else if (data.suspicious) category = 'suspicious';
          else category = 'unknown';

          console.log(`📊 Calculated score: ${finalScore} (malicious: ${isMalicious}, category: ${category})`);

          // 6. Cache result
          const cacheRecord = {
            indicator: domain.indicator,
            kind: 'domain',
            risk_score: riskScore,
            malware: data.malware || false,
            phishing: data.phishing || false,
            spamming: data.spamming || false,
            suspicious: data.suspicious || false,
            adult: data.adult || false,
            category,
            raw_response: data
          };

          const { error: cacheError } = await supabase
            .from('ipqualityscore_cache')
            .upsert(cacheRecord);

          if (cacheError) {
            console.error(`⚠️ Failed to cache ${domain.indicator}:`, cacheError.message);
          } else {
            console.log(`💾 Cached result for ${domain.indicator}`);
          }

          result = data;

          // 7. Increment usage counter
          const { error: usageError } = await supabase.rpc('increment_ipqs_usage', { calls_count: 1 });
          
          if (usageError) {
            console.error(`⚠️ Failed to increment usage:`, usageError.message);
          }

          processed++;
        }

        // 8. Update dynamic_raw_indicators
        const { error: updateError } = await supabase
          .from('dynamic_raw_indicators')
          .update({
            ipqs_checked: true,
            ipqs_score: finalScore,
            ipqs_malicious: isMalicious,
            ipqs_risk_score: result?.risk_score || 0,
            ipqs_category: category,
            ipqs_metadata: result
          })
          .eq('id', domain.id);

        if (updateError) {
          console.error(`❌ Failed to update ${domain.indicator}:`, updateError.message);
          errors++;
        } else {
          console.log(`✅ Updated ${domain.indicator} in database`);
        }

      } catch (err) {
        console.error(`❌ Error processing ${domain.indicator}:`, err);
        errors++;
      }
    }

    const summary = {
      success: true,
      processed: processed,
      cached: cached,
      errors: errors,
      total: domains.length,
      quota_remaining: quota.remaining_calls - processed
    };

    console.log(`\n📊 Summary:`);
    console.log(`   - API calls: ${processed}`);
    console.log(`   - From cache: ${cached}`);
    console.log(`   - Errors: ${errors}`);
    console.log(`   - Total processed: ${domains.length}`);
    console.log(`   - Quota remaining: ${summary.quota_remaining}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
