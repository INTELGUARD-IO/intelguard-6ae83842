import { logNetworkCall, updateNetworkLog } from '../_shared/network-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface HoneyDBBadHost {
  remote_host: string;
  count: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET or JWT authorization
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');
    
    // Allow if valid CRON_SECRET is provided
    const validCronSecret = expectedSecret && cronSecret === expectedSecret;
    // Allow if valid JWT authorization is provided
    const validAuth = authHeader && authHeader.startsWith('Bearer ');
    
    if (!validCronSecret && !validAuth) {
      console.error('Unauthorized: Invalid CRON_SECRET and no valid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const honeydbApiId = Deno.env.get('HONEYDB_API_ID');
    const honeydbApiKey = Deno.env.get('HONEYDB_API_KEY');

    if (!honeydbApiId || !honeydbApiKey) {
      throw new Error('HoneyDB API credentials not configured');
    }

    console.log('Starting HoneyDB validator...');

    // Step 1: Fetch bad hosts from HoneyDB API
    console.log('Fetching bad hosts from HoneyDB...');
    
    const networkLogId = await logNetworkCall(supabaseUrl, supabaseServiceKey, {
      call_type: 'validator',
      target_url: 'https://honeydb.io/api/bad-hosts',
      target_name: 'HoneyDB Bad Hosts API',
      method: 'GET',
      edge_function_name: 'honeydb-validator'
    });
    
    const startTime = Date.now();
    const honeydbResponse = await fetch('https://honeydb.io/api/bad-hosts', {
      method: 'GET',
      headers: {
        'X-HoneyDb-ApiId': honeydbApiId,
        'X-HoneyDb-ApiKey': honeydbApiKey,
      },
    });

    if (!honeydbResponse.ok) {
      const errorText = await honeydbResponse.text();
      throw new Error(`HoneyDB API error (${honeydbResponse.status}): ${errorText}`);
    }

    const badHosts: HoneyDBBadHost[] = await honeydbResponse.json();
    const duration = Date.now() - startTime;
    console.log(`Fetched ${badHosts.length} bad hosts from HoneyDB`);
    
    if (networkLogId) {
      await updateNetworkLog(supabaseUrl, supabaseServiceKey, networkLogId, {
        status: 'completed',
        status_code: honeydbResponse.status,
        response_time_ms: duration,
        items_processed: badHosts.length
      });
    }

    if (badHosts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No bad hosts from HoneyDB', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch candidate IPs from dynamic_raw_indicators that need HoneyDB validation
    const needsCheckQuery = `?kind=eq.ipv4&or=(honeydb_checked.is.false,and(honeydb_checked.eq.true,last_validated.lt.${new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()}))&limit=1000`;
    
    const candidatesResponse = await fetch(
      `${supabaseUrl}/rest/v1/dynamic_raw_indicators${needsCheckQuery}`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!candidatesResponse.ok) {
      throw new Error(`Failed to fetch candidates: ${candidatesResponse.statusText}`);
    }

    const candidates = await candidatesResponse.json();
    console.log(`Found ${candidates.length} IPv4 indicators to validate against HoneyDB`);

    // Step 3: Create a map of bad IPs for quick lookup
    const badIpMap = new Map<string, number>();
    badHosts.forEach(host => {
      badIpMap.set(host.remote_host, host.count);
    });

    // Step 4: Update honeydb_blacklist table
    console.log('Updating honeydb_blacklist table...');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    for (const host of badHosts) {
      const upsertBody = {
        indicator: host.remote_host,
        last_seen: now,
        expires_at: expiresAt,
        threat_score: Math.min(host.count, 100), // Cap at 100
      };

      await fetch(`${supabaseUrl}/rest/v1/honeydb_blacklist`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(upsertBody),
      });
    }

    console.log('HoneyDB blacklist updated');

    // Step 5: Update dynamic_raw_indicators
    let updated = 0;
    for (const candidate of candidates) {
      const isInBlacklist = badIpMap.has(candidate.indicator);
      const threatScore = isInBlacklist ? badIpMap.get(candidate.indicator)! : null;

      // Use stored procedure to merge sources atomically
      const rpcResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/merge_validator_result`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_indicator: candidate.indicator,
            p_kind: candidate.kind,
            p_new_source: 'honeydb',
            p_confidence: 60,
            p_validator_fields: {
              honeydb_checked: true,
              honeydb_in_blacklist: isInBlacklist,
              honeydb_threat_score: threatScore
            }
          }),
        }
      );

      if (rpcResponse.ok) {
        updated++;
        if (isInBlacklist) {
          console.log(`✓ ${candidate.indicator} - Found in HoneyDB (score: ${threatScore})`);
        }
      }
    }

    console.log(`HoneyDB validation completed: ${updated} indicators updated`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: updated,
        honeydb_bad_hosts: badHosts.length,
        message: `Validated ${updated} indicators against ${badHosts.length} HoneyDB bad hosts`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('HoneyDB validator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
