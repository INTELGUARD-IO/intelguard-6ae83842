import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🚀 Starting priority domain validation pipeline...');

    // 1. Backfill domains first
    console.log('📥 Step 1: Backfilling domains...');
    const { data: backfillResult, error: backfillError } = await supabase.rpc('priority_backfill_domains', {
      batch_size: 10000
    });
    
    if (backfillError) {
      console.error('❌ Backfill error:', backfillError);
    } else {
      console.log('✅ Backfilled:', backfillResult);
    }

    // 2. Get unvalidated domains
    const { data: domains, error: domainsError } = await supabase
      .from('dynamic_raw_indicators')
      .select('indicator')
      .eq('kind', 'domain')
      .or('otx_checked.eq.false,virustotal_checked.eq.false,urlscan_checked.eq.false,cloudflare_urlscan_checked.eq.false')
      .limit(500);

    if (domainsError) throw domainsError;

    console.log(`🎯 Found ${domains?.length || 0} domains needing validation`);

    // 3. Trigger validators in parallel
    const validators = [
      'otx-validator',
      'virustotal-validator', 
      'urlscan-validator',
      'cloudflare-urlscan-validator',
      'google-safebrowsing-validator'
    ];

    const validationPromises = validators.map(async (validator) => {
      try {
        console.log(`🔄 Invoking ${validator}...`);
        const { error } = await supabase.functions.invoke(validator, {
          body: { indicators: domains?.slice(0, 100).map(d => d.indicator) }
        });
        if (error) console.error(`❌ ${validator} error:`, error);
        return { validator, success: !error };
      } catch (e) {
        console.error(`❌ ${validator} failed:`, e);
        return { validator, success: false };
      }
    });

    const validationResults = await Promise.allSettled(validationPromises);
    console.log('📊 Validation results:', validationResults);

    // 4. Run intelligent validator to promote validated domains
    console.log('🧠 Running intelligent validator...');
    const { error: intelligentError } = await supabase.functions.invoke('intelligent-validator');
    if (intelligentError) {
      console.error('❌ Intelligent validator error:', intelligentError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        backfill: backfillResult,
        domains_targeted: domains?.length || 0,
        validation_results: validationResults,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
