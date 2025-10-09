import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createPerfTracker, addPerfHeaders } from '../_shared/perf-logger.ts';
import { feedCache } from '../_shared/feed-cache.ts';
import { serializeToText } from '../_shared/serializers.ts';
import { rateLimiter } from '../_shared/rate-limiter.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const perf = createPerfTracker('feed-get', 'GET');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse URL to extract token from path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    if (!token) {
      console.log('[feed-get] No token provided');
      return new Response('Token required', { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Parse query parameters
    const type = url.searchParams.get('type') || 'ipv4';
    const format = url.searchParams.get('format');

    if (format !== 'txt') {
      return new Response('format=txt is required', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`[feed-get] Request - token: ${token}, type: ${type}, format: ${format}`);

    // Verify token is valid and enabled
    const { data: feedToken, error: tokenError } = await supabase
      .from('feed_tokens')
      .select('*')
      .eq('token', token)
      .eq('enabled', true)
      .single();

    if (tokenError || !feedToken) {
      console.log('[feed-get] Invalid or disabled token:', tokenError?.message);
      return new Response('Invalid token', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`[feed-get] Valid token - type: ${feedToken.type}`);

    // Rate limiting
    const rateCheck = rateLimiter.checkLimit(token);
    if (!rateCheck.allowed) {
      console.log(`[feed-get] Rate limit exceeded for token: ${token}`);
      perf.logPerf(429);
      
      const rateLimitHeaders = rateLimiter.getRateLimitHeaders(rateCheck);
      
      return new Response('Rate limit exceeded. Please wait before retrying.', {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Extract client info for logging
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';

    // Log access
    const { error: logError } = await supabase
      .from('feed_access_logs')
      .insert({
        token,
        kind: type,
        ip,
        ua
      });

    if (logError) {
      console.error('[feed-get] Failed to log access:', logError);
      // Continue anyway
    }

    // Map type to database kind
    const kind = type === 'domains' ? 'domain' : 'ipv4';

    // Layer 1: Check in-memory cache
    const cacheKey = feedCache.generateKey({ kind, format, token });
    const cachedData = perf.trackCache(() => feedCache.get<string>(cacheKey));

    if (cachedData) {
      console.log('[feed-get] [CACHE HIT]', { kind, format });
      const timings = perf.logPerf(200);
      
      const rateLimitHeaders = rateLimiter.getRateLimitHeaders(rateCheck);
      const headers = new Headers({
        ...corsHeaders,
        ...rateLimitHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Cache-Status': 'HIT'
      });
      
      addPerfHeaders(headers, perf.requestId, timings.total);
      
      return new Response(cachedData, { status: 200, headers });
    }

    // Layer 2: Fetch from DB cache
    console.log('[feed-get] [CACHE MISS] Fetching from DB cache...');
    const { data: indicators, error: indicatorsError } = await perf.trackDbQuery(async () => {
      return await supabase.rpc('get_feed_indicators', { p_kind: kind });
    });

    if (indicatorsError) {
      console.error('[feed-get] Error fetching indicators:', indicatorsError);
      perf.logPerf(500);
      return new Response('Internal error', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`[feed-get] Returning ${indicators?.length || 0} indicators`);

    // Serialize
    const feedText = perf.trackSerialization(() => {
      return indicators && indicators.length > 0
        ? serializeToText(indicators.map((i: { indicator: string }) => i.indicator))
        : '\n';
    });

    // Store in cache
    feedCache.set(cacheKey, feedText);

    const timings = perf.logPerf(200);

    const rateLimitHeaders = rateLimiter.getRateLimitHeaders(rateCheck);
    const headers = new Headers({
      ...corsHeaders,
      ...rateLimitHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'X-Cache-Status': 'MISS'
    });
    
    addPerfHeaders(headers, perf.requestId, timings.total);

    return new Response(feedText, { status: 200, headers });

  } catch (error) {
    console.error('[feed-get] Unexpected error:', error);
    perf.logPerf(500);
    return new Response('Internal server error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
