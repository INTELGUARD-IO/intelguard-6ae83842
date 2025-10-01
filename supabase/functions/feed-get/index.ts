import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // TODO: Implement rate limiting
    // Approach 1: Query feed_access_logs for recent accesses
    //   - Count accesses from this token in last hour/day
    //   - Store rate_limit in feed_tokens table
    //   - Reject if exceeded
    //
    // Approach 2: Use Redis/Upstash for distributed rate limiting
    //   - Store: `rate:${token}` with TTL
    //   - Increment on each access
    //   - Reject if > threshold

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

    // Fetch indicators from validated_indicators
    const { data: indicators, error: indicatorsError } = await supabase
      .from('validated_indicators')
      .select('indicator')
      .eq('kind', kind)
      .order('indicator', { ascending: true });

    if (indicatorsError) {
      console.error('[feed-get] Error fetching indicators:', indicatorsError);
      return new Response('Internal error', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`[feed-get] Returning ${indicators?.length || 0} indicators`);

    // Format response as text with one indicator per line + trailing newline
    const feedText = indicators && indicators.length > 0
      ? indicators.map((i: { indicator: string }) => i.indicator).join('\n') + '\n'
      : '\n';

    return new Response(feedText, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // 5 minutes
      }
    });

  } catch (error) {
    console.error('[feed-get] Unexpected error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
