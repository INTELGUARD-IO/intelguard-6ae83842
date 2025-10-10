import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_CONCURRENT_REQUESTS = 4; // Cloudflare: ~4 req/s safe (1200/5min = 240/min = 4/s)
const REQUEST_DELAY_MS = 1500; // 1.5 seconds between batches
const RETRY_ATTEMPTS = 4;
const RETRY_DELAYS = [500, 1000, 2000, 3000]; // ms
const BATCH_SIZE = 100; // Process 100 indicators per run (better rate limit than BGPview)

interface CloudflareRadarResponse {
  success: boolean;
  errors?: any[];
  result?: {
    asn?: number;
    as_name?: string;
    as?: {
      asn?: number;
      name?: string;
    };
    country?: string;
    country_code?: string;
    prefix?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cfRadarToken = Deno.env.get('CF_RADAR_TOKEN');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (!cfRadarToken) {
      throw new Error('CF_RADAR_TOKEN not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authentication: Support both CRON and manual UI calls
    const authHeader = req.headers.get('Authorization');
    const cronSecretHeader = req.headers.get('x-cron-secret');
    
    const isCronCall = cronSecretHeader === cronSecret;
    
    // Verify JWT for manual UI calls
    let isAuthenticatedUser = false;
    if (!isCronCall && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        isAuthenticatedUser = !error && !!user;
      } catch (error) {
        console.error('JWT verification error:', error);
      }
    }
    
    if (!isCronCall && !isAuthenticatedUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[cf-radar-enrich] Starting Cloudflare Radar enrichment run...');
    const startTime = Date.now();
    
    // Step 1: Clean expired cache
    console.log('[cf-radar-enrich] Cleaning expired cache...');
    await supabase.rpc('clean_expired_cf_radar_cache');
    
    // Step 2: Fetch IPv4 indicators to enrich (prioritize validated_indicators)
    console.log('[cf-radar-enrich] Fetching indicators to enrich...');
    
    // First, fetch validated_indicators missing country/ASN
    const { data: validatedIndicators } = await supabase
      .from('validated_indicators')
      .select('indicator, kind')
      .eq('kind', 'ipv4')
      .or('country.is.null,asn.is.null')
      .limit(BATCH_SIZE);
    
    let indicators = validatedIndicators || [];
    
    // If we have less than BATCH_SIZE, supplement with high-confidence raw indicators
    if (indicators.length < BATCH_SIZE) {
      const remaining = BATCH_SIZE - indicators.length;
      const { data: dynamicIndicators } = await supabase
        .from('dynamic_raw_indicators')
        .select('indicator, kind, confidence')
        .eq('kind', 'ipv4')
        .gte('confidence', 50)
        .order('confidence', { ascending: false })
        .limit(remaining);
      
      indicators = [...indicators, ...(dynamicIndicators || [])];
    }
    
    if (!indicators || indicators.length === 0) {
      console.log('[cf-radar-enrich] No indicators to enrich');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No indicators to enrich',
          processed: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[cf-radar-enrich] Found ${indicators.length} indicators`);
    
    // Step 3: Filter out already enriched (not expired)
    const indicatorList = indicators.map(i => i.indicator);
    const { data: existingEnrichments } = await supabase
      .from('cloudflare_radar_enrichment')
      .select('indicator')
      .in('indicator', indicatorList)
      .gt('expires_at', new Date().toISOString());
    
    const enrichedSet = new Set(existingEnrichments?.map(e => e.indicator) || []);
    const toEnrich = indicators.filter(i => !enrichedSet.has(i.indicator));
    
    console.log(`[cf-radar-enrich] ${toEnrich.length} indicators need enrichment (${enrichedSet.size} already cached)`);
    
    if (toEnrich.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All indicators already enriched',
          processed: 0,
          cached: enrichedSet.size,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Step 4: Enrich in batches with rate limiting
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < toEnrich.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = toEnrich.slice(i, i + MAX_CONCURRENT_REQUESTS);
      console.log(`[cf-radar-enrich] Processing batch ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1}/${Math.ceil(toEnrich.length / MAX_CONCURRENT_REQUESTS)}`);
      
      const results = await Promise.allSettled(
        batch.map(ind => enrichIndicator(ind.indicator, cfRadarToken, supabase))
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          successCount++;
        } else {
          failureCount++;
        }
      });
      
      // Delay between batches to respect rate limit (~4 req/s)
      if (i + MAX_CONCURRENT_REQUESTS < toEnrich.length) {
        console.log(`[cf-radar-enrich] Waiting ${REQUEST_DELAY_MS}ms before next batch...`);
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[cf-radar-enrich] Enrichment completed: ${successCount} success, ${failureCount} failures in ${duration}ms`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        processed: successCount,
        failed: failureCount,
        total: toEnrich.length,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('[cf-radar-enrich] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function enrichIndicator(ip: string, token: string, supabase: any): Promise<boolean> {
  try {
    const data = await fetchWithRetry(ip, token);
    if (!data) return false;
    
    const result = data.result || {};
    
    const { error } = await supabase.from('cloudflare_radar_enrichment').upsert({
      indicator: ip,
      kind: 'ipv4',
      asn: result.asn || result.as?.asn || null,
      asn_name: result.as_name || result.as?.name || null,
      country_code: result.country || result.country_code || null,
      prefix: result.prefix || null,
      raw_response: result,
      checked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours
    }, { onConflict: 'indicator,kind' });
    
    if (error) {
      console.warn(`[cf-radar-enrich] Failed to upsert ${ip}:`, error.message);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.warn(`[cf-radar-enrich] Error enriching ${ip}:`, error.message);
    return false;
  }
}

async function fetchWithRetry(ip: string, token: string): Promise<CloudflareRadarResponse | null> {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const url = `${CF_API_BASE}/radar/entities/ip?ip=${encodeURIComponent(ip)}`;
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (response.status === 429) {
        // Rate limited - retry with backoff
        const delay = RETRY_DELAYS[attempt] || 3000;
        console.warn(`[cf-radar-enrich] Rate limited for ${ip}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      if (!response.ok) {
        console.warn(`[cf-radar-enrich] Cloudflare Radar returned ${response.status} for ${ip}`);
        return null;
      }
      
      const json = await response.json() as CloudflareRadarResponse;
      if (!json.success) {
        console.warn(`[cf-radar-enrich] Cloudflare Radar error for ${ip}:`, json.errors);
        return null;
      }
      
      return json;
    } catch (error: any) {
      console.warn(`[cf-radar-enrich] Attempt ${attempt + 1}/${RETRY_ATTEMPTS} failed for ${ip}:`, error.message);
      if (attempt < RETRY_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 1000));
      }
    }
  }
  return null;
}
