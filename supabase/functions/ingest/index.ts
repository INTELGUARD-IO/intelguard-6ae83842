import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET
  const secret = Deno.env.get('CRON_SECRET');
  if (req.headers.get('x-cron-secret') !== secret) {
    console.error('Invalid cron secret');
    return new Response('forbidden', { status: 403 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ingest] Starting ingestion run...');

    // TODO: Fetch indicators from all configured sources
    // Sources to implement:
    // 1. blocklist.de (IPs)
    // 2. urlhaus.abuse.ch (domains)
    // 3. feodotracker.abuse.ch (IPs)
    // 4. openphish.com (domains)
    // 5. phishtank.org (domains)
    // 
    // For each source:
    //   - Fetch the feed (handle rate limits, parse format)
    //   - Normalize indicators (lowercase domains, validate IPs)
    //   - Determine kind: 'ipv4' or 'domain'
    //   - Determine source name
    //
    // Example structure:
    // const indicators = [
    //   { indicator: '1.2.3.4', kind: 'ipv4', source: 'blocklist.de' },
    //   { indicator: 'evil.com', kind: 'domain', source: 'urlhaus' }
    // ];

    const indicators: Array<{ indicator: string; kind: string; source: string }> = [];
    
    // TODO: Implement source fetching here
    console.log('[ingest] TODO: Fetch from external sources');

    // Upsert into raw_indicators
    // On conflict (indicator, kind, source), update last_seen
    if (indicators.length > 0) {
      const { error } = await supabase
        .from('raw_indicators')
        .upsert(
          indicators.map(i => ({
            indicator: i.indicator,
            kind: i.kind,
            source: i.source,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          })),
          {
            onConflict: 'indicator,kind,source',
            ignoreDuplicates: false,
          }
        );

      if (error) {
        console.error('[ingest] Error upserting indicators:', error);
        throw error;
      }

      console.log(`[ingest] Upserted ${indicators.length} indicators`);
    } else {
      console.log('[ingest] No indicators fetched (TODO: implement sources)');
    }

    return new Response(
      JSON.stringify({ success: true, count: indicators.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ingest] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
