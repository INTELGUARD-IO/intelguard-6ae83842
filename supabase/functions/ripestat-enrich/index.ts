import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const RIPESTAT_BASE_URL = 'https://stat.ripe.net/data';
const MAX_CONCURRENT_REQUESTS = 8; // RIPEstat limit
const REQUEST_DELAY_MS = 150; // Small delay between batches

interface RIPEStatNetworkInfo {
  prefix?: string;
  asns?: number[];
}

interface RIPEStatGeoLocation {
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface RIPEStatAbuseContact {
  abuse_c?: string;
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');

    const isCronCall = cronSecret && cronSecret === expectedCronSecret;
    const hasAuthToken = authHeader && authHeader.startsWith('Bearer ');

    if (!isCronCall && !hasAuthToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting RIPEstat enrichment process...');

    // Step 1: Clean expired cache
    console.log('Step 1: Cleaning expired RIPEstat cache...');
    const { error: cleanError } = await supabase.rpc('clean_expired_ripestat_cache');
    
    if (cleanError) {
      console.error('Error cleaning expired cache:', cleanError);
    } else {
      console.log('✓ Expired cache cleaned');
    }

    // Step 2: Fetch indicators that need enrichment (IPv4 only for now)
    console.log('Step 2: Fetching indicators to enrich...');
    
    const { data: indicators, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('indicator, kind, confidence')
      .eq('kind', 'ipv4')
      .gte('confidence', 50) // Only enrich high-confidence indicators
      .order('confidence', { ascending: false })
      .limit(100); // Process in batches

    if (fetchError) {
      throw new Error(`Error fetching indicators: ${fetchError.message}`);
    }

    if (!indicators || indicators.length === 0) {
      console.log('No indicators to enrich');
      return new Response(
        JSON.stringify({ success: true, enriched: 0, message: 'No indicators to enrich' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${indicators.length} indicators to enrich`);

    // Step 3: Filter out already enriched indicators (not expired)
    const { data: existingEnrichments } = await supabase
      .from('ripestat_enrichment')
      .select('indicator')
      .in('indicator', indicators.map(i => i.indicator))
      .gt('expires_at', new Date().toISOString());

    const enrichedSet = new Set(existingEnrichments?.map(e => e.indicator) || []);
    const toEnrich = indicators.filter(i => !enrichedSet.has(i.indicator));

    console.log(`${toEnrich.length} indicators need enrichment (${enrichedSet.size} already cached)`);

    if (toEnrich.length === 0) {
      return new Response(
        JSON.stringify({ success: true, enriched: 0, message: 'All indicators already enriched' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Enrich indicators in batches
    let enrichedCount = 0;
    const batchSize = MAX_CONCURRENT_REQUESTS;

    for (let i = 0; i < toEnrich.length; i += batchSize) {
      const batch = toEnrich.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toEnrich.length / batchSize)}...`);

      const enrichmentPromises = batch.map(indicator => enrichIndicator(indicator.indicator, supabase));
      await Promise.all(enrichmentPromises);

      enrichedCount += batch.length;

      // Small delay between batches to respect rate limits
      if (i + batchSize < toEnrich.length) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
      }
    }

    console.log(`✓ Enrichment completed: ${enrichedCount} indicators enriched`);

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedCount,
        total: indicators.length,
        skipped: enrichedSet.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ripestat-enrich:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function enrichIndicator(ip: string, supabase: any): Promise<void> {
  try {
    console.log(`Enriching ${ip}...`);

    // Fetch data from RIPEstat endpoints
    const [networkInfo, geoData, reverseData, abuseData, whoisData] = await Promise.all([
      fetchRIPEStatData('network-info', ip),
      fetchRIPEStatData('maxmind-geo-lite', ip),
      fetchRIPEStatData('reverse-dns-ip', ip),
      fetchRIPEStatData('abuse-contact-finder', ip),
      fetchRIPEStatData('whois', ip)
    ]);

    // Parse network info
    const prefix = networkInfo?.data?.prefix || null;
    const asns = networkInfo?.data?.asns || [];
    const asn = asns.length > 0 ? asns[0] : null;
    const asnHolder = networkInfo?.data?.holder || null;

    // Parse geolocation
    const geoLocations = geoData?.data?.located_resources || [];
    const firstGeo = geoLocations.length > 0 ? geoLocations[0] : null;
    const countryCode = firstGeo?.location || null;
    const city = firstGeo?.city || null;
    const latitude = firstGeo?.latitude || null;
    const longitude = firstGeo?.longitude || null;

    // Parse reverse DNS
    const ptrRecord = reverseData?.data?.result || null;

    // Parse abuse contact
    const abuseEmail = abuseData?.data?.abuse_contacts?.[0] || null;

    // Get routing status if we have a prefix
    let routingData = null;
    if (prefix) {
      routingData = await fetchRIPEStatData('routing-status', prefix);
    }

    // Upsert enrichment data
    const { error: upsertError } = await supabase
      .from('ripestat_enrichment')
      .upsert({
        indicator: ip,
        kind: 'ipv4',
        prefix,
        asn,
        asn_holder: asnHolder,
        country_code: countryCode,
        country_name: null, // Could map from country code if needed
        city,
        latitude,
        longitude,
        ptr_record: ptrRecord,
        abuse_email: abuseEmail,
        network_info: networkInfo?.data || {},
        geolocation_data: geoData?.data || {},
        whois_data: whoisData?.data || {},
        routing_status: routingData?.data || {},
        checked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }, {
        onConflict: 'indicator,kind'
      });

    if (upsertError) {
      console.error(`Error upserting enrichment for ${ip}:`, upsertError);
    } else {
      console.log(`✓ Enriched ${ip} (ASN: ${asn}, Country: ${countryCode})`);
    }

  } catch (error) {
    console.error(`Error enriching ${ip}:`, error);
  }
}

async function fetchRIPEStatData(endpoint: string, resource: string): Promise<any> {
  try {
    const url = `${RIPESTAT_BASE_URL}/${endpoint}/data.json?resource=${encodeURIComponent(resource)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`RIPEstat ${endpoint} returned ${response.status} for ${resource}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Error fetching ${endpoint} for ${resource}:`, errorMessage);
    return null;
  }
}
