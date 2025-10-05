import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting enrichment backfill for validated indicators...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch validated indicators missing country or ASN (batch of 100)
    const { data: indicators, error: fetchError } = await supabase
      .from('validated_indicators')
      .select('indicator, kind')
      .or('country.is.null,asn.is.null')
      .limit(100);

    if (fetchError) {
      console.error('❌ Error fetching indicators:', fetchError);
      throw fetchError;
    }

    if (!indicators || indicators.length === 0) {
      console.log('✅ No indicators need enrichment');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No indicators need enrichment',
          updated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${indicators.length} indicators to enrich`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each indicator
    for (const indicator of indicators) {
      // Use enrichment_summary view for unified enrichment data
      const { data: enrichment, error: enrichError } = await supabase
        .from('enrichment_summary')
        .select('country, asn, asn_name')
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind)
        .maybeSingle();

      if (enrichError) {
        console.error(`⚠️ Error fetching enrichment for ${indicator.indicator}:`, enrichError);
        continue;
      }

      if (!enrichment || (!enrichment.country && !enrichment.asn)) {
        console.log(`⏭️ No enrichment data available for ${indicator.indicator}`);
        skippedCount++;
        continue;
      }

      // Update validated_indicators with enrichment data
      const { error: updateError } = await supabase
        .from('validated_indicators')
        .update({
          country: enrichment.country,
          asn: enrichment.asn,
        })
        .eq('indicator', indicator.indicator)
        .eq('kind', indicator.kind);

      if (updateError) {
        console.error(`❌ Error updating ${indicator.indicator}:`, updateError);
        continue;
      }

      console.log(`✅ Enriched ${indicator.indicator} - Country: ${enrichment.country || 'N/A'}, ASN: ${enrichment.asn || 'N/A'}`);
      updatedCount++;
    }

    const summary = {
      success: true,
      processed: indicators.length,
      updated: updatedCount,
      skipped: skippedCount,
      message: `Enriched ${updatedCount} indicators, skipped ${skippedCount}`
    };

    console.log('📈 Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in enrich-validated-indicators:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
