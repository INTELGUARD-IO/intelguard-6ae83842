import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DomainToResolve {
  indicator: string;
  kind: string;
}

interface DNSResponse {
  Status: number;
  Answer?: Array<{
    data: string;
    TTL: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting domain DNS resolution process...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch domains that need resolution (batch of 100)
    const { data: domains, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('indicator, kind')
      .eq('kind', 'domain')
      .limit(100);

    if (fetchError) {
      console.error('❌ Error fetching domains:', fetchError);
      throw fetchError;
    }

    if (!domains || domains.length === 0) {
      console.log('✅ No domains to resolve');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No domains to resolve',
          resolved: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${domains.length} domains to process`);

    let resolvedCount = 0;
    let cachedCount = 0;
    let failedCount = 0;

    for (const domain of domains) {
      try {
        // Check if we have a valid cached resolution
        const { data: cached, error: cacheError } = await supabase
          .from('domain_resolutions')
          .select('*')
          .eq('domain', domain.indicator)
          .gt('expires_at', new Date().toISOString())
          .order('resolved_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached && !cacheError) {
          console.log(`✅ Cache hit for ${domain.indicator}`);
          cachedCount++;
          continue;
        }

        // Perform DNS resolution via Cloudflare DoH
        console.log(`🔍 Resolving DNS for ${domain.indicator}...`);
        const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain.indicator)}&type=A`;
        
        const dnsResponse = await fetch(dnsUrl, {
          headers: {
            'Accept': 'application/dns-json',
          },
        });

        if (!dnsResponse.ok) {
          console.error(`❌ DNS lookup failed for ${domain.indicator}: ${dnsResponse.status}`);
          failedCount++;
          continue;
        }

        const dnsData: DNSResponse = await dnsResponse.json();

        if (dnsData.Status !== 0 || !dnsData.Answer || dnsData.Answer.length === 0) {
          console.error(`❌ No DNS answer for ${domain.indicator}`);
          failedCount++;
          continue;
        }

        // Get the first A record
        const aRecord = dnsData.Answer.find(answer => answer.data);
        if (!aRecord) {
          console.error(`❌ No A record found for ${domain.indicator}`);
          failedCount++;
          continue;
        }

        const resolvedIp = aRecord.data;
        const ttl = aRecord.TTL || 3600; // Default 1 hour if TTL missing

        console.log(`✅ Resolved ${domain.indicator} -> ${resolvedIp} (TTL: ${ttl}s)`);

        // Get enrichment data for the resolved IP
        const { data: enrichment, error: enrichError } = await supabase
          .from('enrichment_summary')
          .select('country, asn, asn_name')
          .eq('indicator', resolvedIp)
          .eq('kind', 'ipv4')
          .maybeSingle();

        if (enrichError) {
          console.error(`⚠️ Error fetching enrichment for ${resolvedIp}:`, enrichError);
        }

        const country = enrichment?.country || null;
        const asn = enrichment?.asn || null;

        // Calculate expires_at
        const resolvedAt = new Date();
        const expiresAt = new Date(resolvedAt.getTime() + (ttl * 1000));

        // Upsert into domain_resolutions
        const { error: upsertError } = await supabase
          .from('domain_resolutions')
          .upsert({
            domain: domain.indicator,
            resolved_ip: resolvedIp,
            country,
            asn,
            resolved_at: resolvedAt.toISOString(),
            ttl,
            expires_at: expiresAt.toISOString(),
            resolver_source: 'cloudflare-doh',
          }, {
            onConflict: 'domain,resolved_at',
          });

        if (upsertError) {
          console.error(`❌ Error upserting resolution for ${domain.indicator}:`, upsertError);
          failedCount++;
          continue;
        }

        // Update dynamic_raw_indicators with resolved IP in metadata
        const { error: updateError } = await supabase
          .from('dynamic_raw_indicators')
          .update({
            neutrinoapi_metadata: {
              resolved_ip: resolvedIp,
              country,
              asn,
              resolved_at: resolvedAt.toISOString(),
            },
          })
          .eq('indicator', domain.indicator)
          .eq('kind', 'domain');

        if (updateError) {
          console.error(`⚠️ Error updating dynamic_raw_indicators for ${domain.indicator}:`, updateError);
        }

        console.log(`✅ Resolved and enriched ${domain.indicator} - IP: ${resolvedIp}, Country: ${country || 'N/A'}, ASN: ${asn || 'N/A'}`);
        resolvedCount++;

      } catch (error) {
        console.error(`❌ Error processing ${domain.indicator}:`, error);
        failedCount++;
      }
    }

    const summary = {
      success: true,
      processed: domains.length,
      resolved: resolvedCount,
      cached: cachedCount,
      failed: failedCount,
      message: `Resolved ${resolvedCount} domains, ${cachedCount} from cache, ${failedCount} failed`,
    };

    console.log('📈 Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in domain-resolver-validator:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
