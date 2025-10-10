// IP API Enrichment Service - Auto-deployed
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const BATCH_SIZE = 100; // Max batch size per ip-api.com
const REQUESTS_PER_RUN = 15; // 15 batch requests = 1500 IPs per run
const API_ENDPOINT = 'http://ip-api.com/batch';

interface IpApiResponse {
  status: string;
  message?: string;
  continent?: string;
  continentCode?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  district?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string; // Format: "AS15169 Google LLC"
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  query?: string; // Echo back IP
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      console.warn('⚠️ Unauthorized access attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🌐 ip-api.com Enricher started');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch high-priority IPs (confidence >= 60, not yet enriched)
    const { data: indicators, error: fetchError } = await supabase
      .from('validated_indicators')
      .select('indicator, kind, confidence')
      .eq('kind', 'ipv4')
      .gte('confidence', 60)
      .order('confidence', { ascending: false })
      .limit(BATCH_SIZE * REQUESTS_PER_RUN); // 1500 IPs

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!indicators || indicators.length === 0) {
      console.log('✅ No IPs to enrich (all high-confidence IPs already processed)');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${indicators.length} candidate IPs (confidence >= 60)`);

    // 2. Filter out already cached IPs (3-day TTL)
    const { data: cachedIPs } = await supabase
      .from('ip_api_enrichment')
      .select('indicator')
      .in('indicator', indicators.map(i => i.indicator))
      .gt('expires_at', new Date().toISOString());

    const cachedSet = new Set(cachedIPs?.map(c => c.indicator) || []);
    const toEnrich = indicators.filter(i => !cachedSet.has(i.indicator));

    console.log(`📊 Total: ${indicators.length}, Cached: ${cachedSet.size}, To Enrich: ${toEnrich.length}`);

    if (toEnrich.length === 0) {
      console.log('✅ All IPs already cached (3-day TTL active)');
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        cached: cachedSet.size,
        message: 'All high-confidence IPs already enriched'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Process in batches of 100
    let totalProcessed = 0;
    let totalErrors = 0;
    const batchCount = Math.ceil(toEnrich.length / BATCH_SIZE);

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const batch = toEnrich.slice(i, i + BATCH_SIZE);
      const ipList = batch.map(item => item.indicator);
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

      try {
        console.log(`🔄 Batch ${currentBatch}/${batchCount}: Processing ${ipList.length} IPs`);

        // 4. Call ip-api.com batch endpoint
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ipList.map(ip => ({
            query: ip,
            fields: 'status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting'
          })))
        });

        if (!response.ok) {
          console.error(`❌ API error: ${response.status} ${response.statusText}`);
          totalErrors += ipList.length;
          continue;
        }

        const results: IpApiResponse[] = await response.json();
        console.log(`📥 Received ${results.length} responses from ip-api.com`);

        // 5. Parse and upsert results
        const enrichedData = results
          .filter(r => {
            if (r.status !== 'success') {
              console.warn(`⚠️ Failed to enrich ${r.query}: ${r.message || 'unknown error'}`);
              return false;
            }
            return true;
          })
          .map(r => {
            // Parse ASN from "AS15169 Google LLC" format
            let asNumber: number | null = null;
            let asName: string | null = null;
            if (r.as) {
              const asMatch = r.as.match(/^AS(\d+)\s+(.+)$/);
              if (asMatch) {
                asNumber = parseInt(asMatch[1], 10);
                asName = asMatch[2];
              }
            }

            return {
              indicator: r.query!,
              kind: 'ipv4',
              continent: r.continent || null,
              continent_code: r.continentCode || null,
              country: r.country || null,
              country_code: r.countryCode || null,
              region: r.region || null,
              region_name: r.regionName || null,
              city: r.city || null,
              district: r.district || null,
              zip: r.zip || null,
              lat: r.lat || null,
              lon: r.lon || null,
              timezone: r.timezone || null,
              isp: r.isp || null,
              org: r.org || null,
              as_number: asNumber,
              as_name: asName,
              is_mobile: r.mobile || false,
              is_proxy: r.proxy || false,
              is_hosting: r.hosting || false,
              raw_response: r
            };
          });

        if (enrichedData.length > 0) {
          const { error: upsertError } = await supabase
            .from('ip_api_enrichment')
            .upsert(enrichedData, { onConflict: 'indicator,kind' });

          if (upsertError) {
            console.error(`❌ Upsert error:`, upsertError);
            totalErrors += enrichedData.length;
          } else {
            totalProcessed += enrichedData.length;
            console.log(`✅ Batch ${currentBatch}/${batchCount}: Enriched ${enrichedData.length} IPs successfully`);
          }
        }

        // 6. Rate limiting: wait 4 seconds between batches (15 req/min = 1 req/4s)
        if (i + BATCH_SIZE < toEnrich.length) {
          console.log('⏳ Waiting 4 seconds (rate limit compliance)...');
          await new Promise(resolve => setTimeout(resolve, 4000));
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`❌ Batch ${currentBatch}/${batchCount} error:`, errorMessage);
        totalErrors += batch.length;
      }
    }

    const successRate = ((totalProcessed / toEnrich.length) * 100).toFixed(1);
    console.log(`✅ Enrichment completed: ${totalProcessed}/${toEnrich.length} processed (${successRate}%), ${totalErrors} errors`);

    return new Response(JSON.stringify({
      success: true,
      processed: totalProcessed,
      errors: totalErrors,
      cached: cachedSet.size,
      total_candidates: indicators.length,
      success_rate: `${successRate}%`,
      batches_processed: batchCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Fatal error:', errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
