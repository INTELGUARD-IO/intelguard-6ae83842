import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const BGPVIEW_BASE_URL = 'https://api.bgpview.io';
const MAX_CONCURRENT_REQUESTS = 2;
const REQUEST_DELAY_MS = 2000; // 2 seconds between batches (0.5 req/s)
const RETRY_ATTEMPTS = 4;
const RETRY_DELAYS = [500, 1000, 2000, 3000]; // ms
const BATCH_SIZE = 50; // Process 50 indicators per run

interface BGPViewIPResponse {
  status: string;
  status_message?: string;
  data?: {
    ptr_record?: string;
    prefixes?: Array<{
      prefix?: string;
      cidr?: number;
      asn?: {
        asn?: number;
        name?: string;
        description?: string;
        country_code?: string;
      };
    }>;
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
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authentication: Support both CRON and manual UI calls
    const authHeader = req.headers.get('Authorization');
    const cronSecretHeader = req.headers.get('x-cron-secret');
    
    const isCronCall = cronSecretHeader === cronSecret;
    const isAuthenticatedUser = authHeader?.startsWith('Bearer ');
    
    if (!isCronCall && !isAuthenticatedUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[bgpview-enrich] Starting BGPview enrichment run...');
    const startTime = Date.now();
    
    // Step 1: Clean expired cache
    console.log('[bgpview-enrich] Cleaning expired cache...');
    await supabase.rpc('clean_expired_bgpview_cache');
    
    // Step 2: Fetch IPv4 indicators to enrich (prioritize validated_indicators)
    console.log('[bgpview-enrich] Fetching indicators to enrich...');
    
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
      console.log('[bgpview-enrich] No indicators to enrich');
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
    
    console.log(`[bgpview-enrich] Found ${indicators.length} indicators`);
    
    // Step 3: Filter out already enriched (not expired)
    const indicatorList = indicators.map(i => i.indicator);
    const { data: existingEnrichments } = await supabase
      .from('bgpview_enrichment')
      .select('indicator')
      .in('indicator', indicatorList)
      .gt('expires_at', new Date().toISOString());
    
    const enrichedSet = new Set(existingEnrichments?.map(e => e.indicator) || []);
    const toEnrich = indicators.filter(i => !enrichedSet.has(i.indicator));
    
    console.log(`[bgpview-enrich] ${toEnrich.length} indicators need enrichment (${enrichedSet.size} already cached)`);
    
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
    
    // Step 4: Enrich in batches with strict rate limiting
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < toEnrich.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = toEnrich.slice(i, i + MAX_CONCURRENT_REQUESTS);
      console.log(`[bgpview-enrich] Processing batch ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1}/${Math.ceil(toEnrich.length / MAX_CONCURRENT_REQUESTS)}`);
      
      const results = await Promise.allSettled(
        batch.map(ind => enrichIndicator(ind.indicator, supabase))
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          successCount++;
        } else {
          failureCount++;
        }
      });
      
      // Delay between batches to respect rate limit (0.5 req/s)
      if (i + MAX_CONCURRENT_REQUESTS < toEnrich.length) {
        console.log(`[bgpview-enrich] Waiting ${REQUEST_DELAY_MS}ms before next batch...`);
        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[bgpview-enrich] Enrichment completed: ${successCount} success, ${failureCount} failures in ${duration}ms`);
    
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
    console.error('[bgpview-enrich] Error:', error);
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

async function enrichIndicator(ip: string, supabase: any): Promise<boolean> {
  try {
    const data = await fetchWithRetry(ip);
    if (!data) return false;
    
    const bestPrefix = pickBestPrefix(data.data?.prefixes || []);
    
    const { error } = await supabase.from('bgpview_enrichment').upsert({
      indicator: ip,
      kind: 'ipv4',
      ptr_record: data.data?.ptr_record || null,
      prefix: bestPrefix?.prefix || null,
      cidr: bestPrefix?.cidr || null,
      asn: bestPrefix?.asn?.asn || null,
      asn_name: bestPrefix?.asn?.name || null,
      asn_description: bestPrefix?.asn?.description || null,
      country_code: bestPrefix?.asn?.country_code || null,
      raw_response: data.data || {},
      checked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }, { onConflict: 'indicator,kind' });
    
    if (error) {
      console.warn(`[bgpview-enrich] Failed to upsert ${ip}:`, error.message);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.warn(`[bgpview-enrich] Error enriching ${ip}:`, error.message);
    return false;
  }
}

async function fetchWithRetry(ip: string): Promise<BGPViewIPResponse | null> {
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const url = `${BGPVIEW_BASE_URL}/ip/${encodeURIComponent(ip)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (response.status === 429) {
        // Rate limited - retry with backoff
        const delay = RETRY_DELAYS[attempt] || 3000;
        console.warn(`[bgpview-enrich] Rate limited for ${ip}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      if (!response.ok) {
        console.warn(`[bgpview-enrich] BGPview returned ${response.status} for ${ip}`);
        return null;
      }
      
      const json = await response.json() as BGPViewIPResponse;
      if (json.status !== 'ok') {
        console.warn(`[bgpview-enrich] BGPview error for ${ip}: ${json.status_message}`);
        return null;
      }
      
      return json;
    } catch (error: any) {
      console.warn(`[bgpview-enrich] Attempt ${attempt + 1}/${RETRY_ATTEMPTS} failed for ${ip}:`, error.message);
      if (attempt < RETRY_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 1000));
      }
    }
  }
  return null;
}

function pickBestPrefix(prefixes: any[]): any {
  // Choose the prefix with highest CIDR (most specific)
  return prefixes
    .filter(p => p?.cidr != null)
    .sort((a, b) => (b.cidr || 0) - (a.cidr || 0))[0];
}
