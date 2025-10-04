import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Whitelist Cross-Validator: Starting...\n');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Load whitelists
    console.log('📥 Loading whitelists...');
    const [ciscoData, cloudflareData] = await Promise.all([
      supabase.from('cisco_umbrella_top_domains').select('domain'),
      supabase.from('cloudflare_radar_top_domains').select('domain')
    ]);

    const ciscoSet = new Set(ciscoData.data?.map(d => d.domain.toLowerCase()) || []);
    const cloudflareSet = new Set(cloudflareData.data?.map(d => d.domain.toLowerCase()) || []);
    
    console.log(`📊 Loaded whitelists: Cisco=${ciscoSet.size}, Cloudflare=${cloudflareSet.size}`);

    // Create unified set
    const unifiedWhitelist = new Set([...ciscoSet, ...cloudflareSet]);
    console.log(`✅ Unified whitelist: ${unifiedWhitelist.size} unique domains\n`);

    // Step 2: Fetch raw indicators without confidence or not whitelisted
    console.log('🔎 Fetching raw indicators to validate...');
    const startTime = Date.now();
    const { data: indicators, error: fetchError } = await supabase
      .from('dynamic_raw_indicators')
      .select('id, indicator, kind')
      .or('whitelisted.is.null,whitelisted.eq.false')
      .in('kind', ['domain'])
      .limit(50000);

    if (fetchError) throw fetchError;
    if (!indicators || indicators.length === 0) {
      console.log('✅ No indicators to cross-validate');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No indicators to validate',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`📋 Found ${indicators.length} indicators to validate\n`);

    // Step 3: Cross-validate
    let ciscoMatches = 0;
    let cloudflareMatches = 0;
    let bothMatches = 0;
    let totalWhitelisted = 0;

    const batchSize = 100;
    for (let i = 0; i < indicators.length; i += batchSize) {
      const batch = indicators.slice(i, i + batchSize);
      
      for (const indicator of batch) {
        const domain = indicator.indicator.toLowerCase();
        const inCisco = ciscoSet.has(domain);
        const inCloudflare = cloudflareSet.has(domain);

        if (inCisco || inCloudflare) {
          totalWhitelisted++;
          
          let source = '';
          if (inCisco && inCloudflare) {
            bothMatches++;
            source = 'both';
          } else if (inCisco) {
            ciscoMatches++;
            source = 'cisco';
          } else {
            cloudflareMatches++;
            source = 'cloudflare';
          }

          // Update dynamic_raw_indicators
          await supabase
            .from('dynamic_raw_indicators')
            .update({
              confidence: 0,
              whitelisted: true,
              whitelist_source: source,
              last_validated: new Date().toISOString()
            })
            .eq('id', indicator.id);

          // Insert into validated_indicators
          await supabase
            .from('validated_indicators')
            .upsert({
              indicator: indicator.indicator,
              kind: indicator.kind,
              confidence: 0,
              last_validated: new Date().toISOString()
            }, {
              onConflict: 'indicator,kind'
            });
        }
      }

      console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(indicators.length / batchSize)}`);
    }

    const executionTime = Date.now() - startTime;
    const processingRate = Math.round(indicators.length / (executionTime / 1000));
    
    console.log('\n🎉 Cross-validation completed!');
    console.log(`📊 Results:`);
    console.log(`   - Total whitelisted: ${totalWhitelisted}`);
    console.log(`   - Cisco only: ${ciscoMatches}`);
    console.log(`   - Cloudflare only: ${cloudflareMatches}`);
    console.log(`   - Both lists: ${bothMatches}`);
    console.log(`   - API quota saved: ~${totalWhitelisted * 10} calls`);
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log(`📈 Processing rate: ${processingRate} indicators/sec`);

    return new Response(JSON.stringify({
      success: true,
      processed: indicators.length,
      whitelisted: totalWhitelisted,
      breakdown: {
        ciscoOnly: ciscoMatches,
        cloudflareOnly: cloudflareMatches,
        both: bothMatches
      },
      quotaSaved: totalWhitelisted * 10
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Error in whitelist-cross-validator:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
