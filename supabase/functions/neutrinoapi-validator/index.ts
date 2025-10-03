import { supabaseQuery } from '../_shared/supabase-rest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeutrinoBlocklistEntry {
  ip: string;
  category: string;
}

interface NeutrinoHostReputationResponse {
  'is-listed': boolean;
  'list-count': number;
  lists?: Record<string, any>;
  zones?: string[];
}

interface NeutrinoIPProbeResponse {
  valid: boolean;
  'is-vpn': boolean;
  'is-proxy': boolean;
  'is-hosting': boolean;
  'is-bogon': boolean;
  'vpn-domain'?: string;
  'provider-type'?: string;
  'as-cidr'?: string;
  asn?: string;
  country?: string;
  'country-code'?: string;
  city?: string;
  region?: string;
  hostname?: string;
  'provider-description'?: string;
  'as-description'?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting NeutrinoAPI validator...\n');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const neutrinoUserId = Deno.env.get('NEUTRINOAPI_USER_ID');
    const neutrinoApiKey = Deno.env.get('NEUTRINOAPI_API_KEY');

    if (!neutrinoUserId || !neutrinoApiKey) {
      throw new Error('NeutrinoAPI credentials not configured');
    }

    console.log('Testing NeutrinoAPI credentials with IP Probe...');
    console.log('Using User-ID:', neutrinoUserId);
    const testResponse = await fetch('https://neutrinoapi.net/ip-probe', {
      method: 'POST',
      headers: {
        'User-ID': neutrinoUserId,
        'API-Key': neutrinoApiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ ip: '8.8.8.8' }),
    });

    const testData = await testResponse.json();
    console.log('Credential test response:', testResponse.status, JSON.stringify(testData));
    
    if (!testResponse.ok) {
      console.error('Credential test failed:', testResponse.status, JSON.stringify(testData));
      if (testData['api-error']) {
        throw new Error(`NeutrinoAPI Error ${testData['api-error']}: ${testData['api-error-msg']}`);
      }
      throw new Error(`Invalid NeutrinoAPI credentials: ${testResponse.statusText}`);
    }
    console.log('✓ Credentials validated\n');

    // Step 1: Clean expired blocklist entries
    console.log('Step 1: Cleaning expired NeutrinoAPI blocklist entries...');
    await supabaseQuery(supabaseUrl, supabaseServiceKey, 'rpc/clean_expired_neutrinoapi_blocklist', 'POST');
    console.log('✓ Expired entries cleaned\n');

    // Step 2: Download IP Blocklist (with fallback)
    let blocklistEntries: NeutrinoBlocklistEntry[] = [];
    try {
      console.log('Step 2: Downloading NeutrinoAPI IP Blocklist...');
      
      // Try with GET method and query parameters
      const blocklistUrl = new URL('https://neutrinoapi.net/ip-blocklist-download');
      blocklistUrl.searchParams.append('user-id', neutrinoUserId);
      blocklistUrl.searchParams.append('api-key', neutrinoApiKey);
      blocklistUrl.searchParams.append('format', 'csv');
      blocklistUrl.searchParams.append('cidr', 'false');
      blocklistUrl.searchParams.append('ip6', 'false');
      blocklistUrl.searchParams.append('category', 'all');
      blocklistUrl.searchParams.append('checksum', 'false');

      console.log('Trying GET method with query params...');
      const blocklistResponse = await fetch(blocklistUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/csv, text/plain, */*',
        },
      });

      console.log(`Response status: ${blocklistResponse.status}`);
      console.log(`Response headers:`, Object.fromEntries(blocklistResponse.headers.entries()));

      if (!blocklistResponse.ok) {
        const responseText = await blocklistResponse.text();
        console.error(`Blocklist download failed: ${blocklistResponse.status}`);
        console.error(`Response body:`, responseText);
        throw new Error(`Failed to download blocklist: ${blocklistResponse.statusText}`);
      }

      const blocklistText = await blocklistResponse.text();
      console.log(`Raw response length: ${blocklistText.length} chars`);
      console.log(`First 500 chars:`, blocklistText.substring(0, 500));
      
      const blocklistLines = blocklistText.trim().split('\n').filter(line => line && !line.startsWith('#'));
      console.log(`Downloaded ${blocklistLines.length} blocklist entries\n`);

      // Parse blocklist
      for (const line of blocklistLines) {
        const parts = line.split(',');
        if (parts.length >= 1) {
          const ip = parts[0].trim();
          const category = parts[1]?.trim() || 'unknown';
          if (ip) {
            blocklistEntries.push({ ip, category });
          }
        }
      }

      // Batch insert blocklist (1000 per batch)
      const batchSize = 1000;
      for (let i = 0; i < blocklistEntries.length; i += batchSize) {
        const batch = blocklistEntries.slice(i, i + batchSize);
        const insertData = batch.map(entry => ({
          indicator: entry.ip,
          kind: 'ipv4',
          category: entry.category,
          added_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }));

        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'neutrinoapi_blocklist',
          'POST',
          insertData
        );
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(blocklistEntries.length / batchSize)}`);
      }
      console.log('✓ Blocklist updated\n');
      
    } catch (error) {
      console.warn('Blocklist download failed, continuing with validation anyway:', error);
      console.log('Will use Host Reputation and IP Probe only\n');
    }

    // Step 3: Fetch IPv4 indicators to validate
    console.log('Step 3: Fetching IPv4 indicators to validate...');
    const indicators = await supabaseQuery(
      supabaseUrl,
      supabaseServiceKey,
      'dynamic_raw_indicators',
      'GET',
      undefined,
      '?select=indicator,kind&kind=eq.ipv4&removed_at=is.null&neutrinoapi_checked=eq.false&limit=100'
    );

    if (!indicators || indicators.length === 0) {
      console.log('No indicators to validate\n');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No indicators to validate',
          blocklist_entries: blocklistEntries.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${indicators.length} IPv4 indicators to validate\n`);

    // Step 4: Validate each IP
    let validated = 0;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const indicator of indicators) {
      const ip = indicator.indicator;
      
      try {
        console.log(`Validating ${ip}...`);

        // Check if IP is in blocklist
        const inBlocklist = await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'neutrinoapi_blocklist',
          'GET',
          undefined,
          `?select=indicator&indicator=eq.${ip}&limit=1`
        );

        // Call Host Reputation API
        const hostRepResponse = await fetch('https://neutrinoapi.net/host-reputation', {
          method: 'POST',
          headers: {
            'User-ID': neutrinoUserId,
            'API-Key': neutrinoApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            host: ip,
            'list-rating': '3',
          }),
        });

        let hostRep: NeutrinoHostReputationResponse | null = null;
        if (hostRepResponse.ok) {
          hostRep = await hostRepResponse.json();
        } else {
          console.warn(`Host reputation failed for ${ip}: ${hostRepResponse.status}`);
        }

        // Rate limiting delay
        await delay(500);

        // Call IP Probe API
        const ipProbeResponse = await fetch('https://neutrinoapi.net/ip-probe', {
          method: 'POST',
          headers: {
            'User-ID': neutrinoUserId,
            'API-Key': neutrinoApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            ip: ip,
          }),
        });

        let ipProbe: NeutrinoIPProbeResponse | null = null;
        if (ipProbeResponse.ok) {
          ipProbe = await ipProbeResponse.json();
        } else {
          console.warn(`IP probe failed for ${ip}: ${ipProbeResponse.status}`);
        }

        // Update dynamic_raw_indicators
        const updateData = {
          neutrinoapi_checked: true,
          neutrinoapi_in_blocklist: inBlocklist && inBlocklist.length > 0,
          neutrinoapi_host_reputation_score: hostRep ? (hostRep['list-count'] || 0) * 10 : null,
          neutrinoapi_is_proxy: ipProbe ? ipProbe['is-proxy'] : null,
          neutrinoapi_is_vpn: ipProbe ? ipProbe['is-vpn'] : null,
          neutrinoapi_is_hosting: ipProbe ? ipProbe['is-hosting'] : null,
          neutrinoapi_metadata: {
            vpn_domain: ipProbe?.['vpn-domain'] || null,
            provider_type: ipProbe?.['provider-type'] || null,
            asn: ipProbe?.asn || null,
            country: ipProbe?.country || null,
            country_code: ipProbe?.['country-code'] || null,
            city: ipProbe?.city || null,
            region: ipProbe?.region || null,
            as_cidr: ipProbe?.['as-cidr'] || null,
            as_description: ipProbe?.['as-description'] || null,
            host_reputation: hostRep ? {
              is_listed: hostRep['is-listed'],
              list_count: hostRep['list-count'],
              zones: hostRep.zones?.slice(0, 5) || [],
            } : null,
          },
          last_validated: new Date().toISOString(),
        };

        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'dynamic_raw_indicators',
          'PATCH',
          updateData,
          `?indicator=eq.${ip}&kind=eq.ipv4`
        );

        validated++;
        console.log(`✓ Validated ${ip} (${validated}/${indicators.length})`);

        // Rate limiting delay between requests
        await delay(500);

      } catch (error) {
        console.error(`Error validating ${ip}:`, error);
        // Mark as checked even on error to avoid retrying immediately
        await supabaseQuery(
          supabaseUrl,
          supabaseServiceKey,
          'dynamic_raw_indicators',
          'PATCH',
          { neutrinoapi_checked: true },
          `?indicator=eq.${ip}&kind=eq.ipv4`
        );
      }
    }

    console.log(`\n✓ NeutrinoAPI validation completed!`);
    console.log(`  Blocklist entries: ${blocklistEntries.length}`);
    console.log(`  Validated indicators: ${validated}/${indicators.length}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        blocklist_entries: blocklistEntries.length,
        indicators_validated: validated,
        total_indicators: indicators.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in neutrinoapi-validator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
