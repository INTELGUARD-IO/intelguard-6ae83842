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

    // Step 1: Load whitelists from Storage
    console.log('📥 Loading whitelists from Storage...');
    
    const loadDomainsFromStorage = async (fileName: string): Promise<Set<string>> => {
      const { data, error } = await supabase.storage
        .from('whitelists')
        .download(fileName);
      
      if (error) {
        console.warn(`⚠️ Failed to load ${fileName}: ${error.message}`);
        return new Set();
      }
      
      const csvText = await data.text();
      const lines = csvText.split('\n').slice(1); // Skip header
      const domains = new Set<string>();
      
      lines.forEach(line => {
        const domain = line.split(',')[0]?.trim().toLowerCase();
        if (domain) domains.add(domain);
      });
      
      return domains;
    };

    const [ciscoSet, cloudflareSet] = await Promise.all([
      loadDomainsFromStorage('cisco-umbrella-latest.csv'),
      loadDomainsFromStorage('cloudflare-radar-latest.csv')
    ]);
    
    console.log(`📊 Loaded whitelists from Storage: Cisco=${ciscoSet.size}, Cloudflare=${cloudflareSet.size}`);

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

    // Step 3: Cross-validate with optimized batch updates
    console.log('\n🔍 Step 3: Cross-validating indicators against whitelists...');
    const performanceStart = Date.now();
    
    let ciscoMatches = 0;
    let cloudflareMatches = 0;
    let bothMatches = 0;
    let totalWhitelisted = 0;

    // Collect all whitelisted indicators first (in-memory, fast)
    const whitelistedIndicators: Array<{id: number, indicator: string, kind: string, source: string}> = [];
    
    for (const indicator of indicators) {
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

        whitelistedIndicators.push({
          id: indicator.id,
          indicator: indicator.indicator,
          kind: indicator.kind,
          source
        });
      }
    }

    console.log(`📊 Found ${totalWhitelisted} whitelisted indicators (Cisco: ${ciscoMatches}, Cloudflare: ${cloudflareMatches}, Both: ${bothMatches})`);

    if (whitelistedIndicators.length === 0) {
      console.log('✅ No whitelisted indicators found, skipping batch updates');
    } else {
      // Batch update dynamic_raw_indicators (100 at a time, grouped by source)
      console.log(`\n🔄 Updating ${whitelistedIndicators.length} indicators in dynamic_raw_indicators...`);
      const batchSize = 100;
      const updateStart = Date.now();
      let totalUpdated = 0;

      for (const source of ['cisco', 'cloudflare', 'both']) {
        const sourceIndicators = whitelistedIndicators.filter(ind => ind.source === source);
        if (sourceIndicators.length === 0) continue;

        for (let i = 0; i < sourceIndicators.length; i += batchSize) {
          const batch = sourceIndicators.slice(i, i + batchSize);
          const ids = batch.map(ind => ind.id);
          
          const { error } = await supabase
            .from('dynamic_raw_indicators')
            .update({
              confidence: 0,
              whitelisted: true,
              whitelist_source: source,
              last_validated: new Date().toISOString()
            })
            .in('id', ids);

          if (error) {
            console.error(`❌ Error updating batch for source ${source}:`, error);
          } else {
            totalUpdated += batch.length;
            console.log(`   ✅ Updated ${batch.length} indicators (source: ${source})`);
          }
        }
      }

      console.log(`✅ Batch update completed: ${totalUpdated} indicators in ${Date.now() - updateStart}ms`);

      // Batch upsert validated_indicators (100 at a time)
      console.log(`\n🔄 Upserting ${whitelistedIndicators.length} indicators to validated_indicators...`);
      const upsertStart = Date.now();
      let totalUpserted = 0;

      for (let i = 0; i < whitelistedIndicators.length; i += batchSize) {
        const batch = whitelistedIndicators.slice(i, i + batchSize);
        const validatedData = batch.map(ind => ({
          indicator: ind.indicator,
          kind: ind.kind,
          confidence: 0,
          last_validated: new Date().toISOString()
        }));
        
        const { error } = await supabase
          .from('validated_indicators')
          .upsert(validatedData, {
            onConflict: 'indicator,kind'
          });

        if (error) {
          console.error(`❌ Error upserting batch:`, error);
        } else {
          totalUpserted += batch.length;
          console.log(`   ✅ Upserted ${batch.length} indicators`);
        }
      }

      console.log(`✅ Batch upsert completed: ${totalUpserted} indicators in ${Date.now() - upsertStart}ms`);
    }

    const performanceTotal = Date.now() - performanceStart;
    console.log(`\n⚡ Cross-validation performance: ${performanceTotal}ms (${Math.round(indicators.length / (performanceTotal / 1000))} indicators/sec)`);
    console.log(`💰 API quota saved: ~${totalWhitelisted * 10} validator calls\n`);

    // Step 3: Call intelligent-validator for smart promotion
    console.log('\n🎯 Step 3: Calling intelligent-validator for multi-source consensus...');
    
    let promoted = 0;
    try {
      const { data: validationResult, error: validationError } = await supabase.functions.invoke('intelligent-validator');
      
      if (validationError) {
        console.warn('⚠️ Intelligent validator error:', validationError.message);
      } else if (validationResult) {
        promoted = validationResult.promoted || 0;
        console.log(`🎉 Intelligent validator promoted: ${promoted} indicators`);
        if (validationResult.breakdown) {
          console.log(`   - IPv4: ${validationResult.breakdown.ipv4}`);
          console.log(`   - Domains: ${validationResult.breakdown.domains}`);
          console.log(`   - Skipped: ${validationResult.breakdown.skipped}`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to call intelligent-validator:', err);
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
      validated: promoted,
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
