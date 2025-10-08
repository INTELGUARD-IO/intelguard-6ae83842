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

    console.log('🔄 Starting validated indicators cache snapshot...');

    // Call the database function to create snapshot
    const { error } = await supabase.rpc('snapshot_validated_indicators_to_cache');

    if (error) {
      console.error('❌ Error creating snapshot:', error);
      throw error;
    }

    // Get cache stats
    const { count: cacheCount } = await supabase
      .from('validated_indicators_cache')
      .select('*', { count: 'exact', head: true });

    const { count: liveCount } = await supabase
      .from('validated_indicators')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Cache snapshot completed`);
    console.log(`📊 Cache: ${cacheCount} indicators | Live: ${liveCount} indicators`);

    return new Response(
      JSON.stringify({
        success: true,
        cache_count: cacheCount,
        live_count: liveCount,
        timestamp: new Date().toISOString(),
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
