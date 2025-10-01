import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET
  const secret = Deno.env.get('CRON_SECRET');
  if (req.headers.get('x-cron-secret') !== secret) {
    console.error('Invalid cron secret');
    return new Response('forbidden', { status: 403 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[daily-delta] Starting daily delta calculation...');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];

    // TODO: Compare validated_indicators against yesterday's snapshot
    // 
    // Approach 1: Store daily snapshots
    //   - Create validated_indicators_snapshots table
    //   - Store (run_date, indicator, kind)
    //   - Compare current vs yesterday
    //
    // Approach 2: Use last_validated timestamp
    //   - Added: indicators where last_validated >= yesterday
    //   - Removed: Check if indicators from yesterday no longer exist
    //     (this requires a snapshot or tracking deletions)
    //
    // For now, calculate per kind (ipv4, domain):
    // const { data: todayIpv4 } = await supabase
    //   .from('validated_indicators')
    //   .select('indicator')
    //   .eq('kind', 'ipv4');
    //
    // Compare with yesterday's data (TODO: implement snapshot logic)

    const deltas = [
      { run_date: today, kind: 'ipv4', added: 0, removed: 0 },
      { run_date: today, kind: 'domain', added: 0, removed: 0 },
    ];

    console.log('[daily-delta] TODO: Implement snapshot comparison logic');

    // Insert into daily_deltas
    const { error } = await supabase
      .from('daily_deltas')
      .insert(deltas);

    if (error) {
      console.error('[daily-delta] Error inserting deltas:', error);
      throw error;
    }

    console.log(`[daily-delta] Inserted deltas for ${today}`);

    return new Response(
      JSON.stringify({ success: true, date: today, deltas }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[daily-delta] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
