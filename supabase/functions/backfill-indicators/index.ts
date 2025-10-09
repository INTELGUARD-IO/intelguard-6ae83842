import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting backfill process...');
    const startTime = Date.now();
    
    // Execute backfill function with 5000 batch size
    const { data, error } = await supabase.rpc('backfill_dynamic_raw_indicators', {
      batch_size: 5000
    });
    
    if (error) {
      console.error('Backfill error:', error);
      throw error;
    }
    
    const duration = Date.now() - startTime;
    
    console.log('Backfill completed:', data);
    console.log(`Duration: ${duration}ms`);
    
    // Refresh materialized view after backfill
    await supabase.rpc('refresh_validator_stats_mv');
    
    return new Response(
      JSON.stringify({
        success: true,
        data,
        duration_ms: duration,
        message: 'Backfill completed successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: any) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});