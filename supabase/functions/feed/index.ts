import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedToken {
  id: string;
  enabled: boolean;
  type: string;
  customer_id: string | null;
  tenant_id: string | null;
}

interface ValidatedIndicator {
  indicator: string;
  kind: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse URL to extract token from path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    if (!token) {
      console.log('No token provided in URL');
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

    console.log(`Feed request - token: ${token}, type: ${type}, format: ${format}`);

    // Verify token is valid and enabled
    const { data: feedToken, error: tokenError } = await supabase
      .from('feed_tokens')
      .select('*')
      .eq('token', token)
      .eq('enabled', true)
      .single();

    if (tokenError || !feedToken) {
      console.log('Invalid or disabled token:', tokenError?.message);
      return new Response('Invalid token', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`Valid token found - type: ${feedToken.type}`);

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
      console.error('Failed to log access:', logError);
      // Continue anyway, logging failure shouldn't block the feed
    }

    // Map type to database kind
    const kind = type === 'domains' ? 'domain' : 'ipv4';

    // Fetch indicators from validated_indicators
    const { data: indicators, error: indicatorsError } = await supabase
      .from('validated_indicators')
      .select('indicator, kind')
      .eq('kind', kind)
      .order('indicator', { ascending: true });

    if (indicatorsError) {
      console.error('Error fetching indicators:', indicatorsError);
      return new Response('Internal error', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`Found ${indicators?.length || 0} indicators of type ${kind}`);

    // Format response as text with one indicator per line
    const feedText = indicators
      ? indicators.map((i: ValidatedIndicator) => i.indicator).join('\n') + '\n'
      : '\n';

    // TODO: Implement rate-limiting based on token
    // Could use a combination of:
    // - Redis/Upstash for distributed rate limiting
    // - Query feed_access_logs to count recent accesses
    // - Store rate limit config in feed_tokens table

    return new Response(feedText, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
