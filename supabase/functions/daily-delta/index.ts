import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Enforce CRON_SECRET only if provided (for cron jobs)
  const secret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  
  // If a secret is provided, validate it
  if (providedSecret && providedSecret !== secret) {
    console.error('[daily-delta] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }
  
  // If no secret provided, allow manual testing
  if (!providedSecret) {
    console.log('[daily-delta] Manual test invocation (no cron secret provided)');
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[daily-delta] Starting daily delta calculation...');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];

    console.log(`[daily-delta] Processing delta for ${today}, comparing with ${yesterday}`);

    // Step 1: Create today's snapshot from current raw_indicators
    const { data: currentIndicators, error: fetchError } = await supabase
      .from('raw_indicators')
      .select('indicator, kind, source')
      .is('removed_at', null);

    if (fetchError) {
      console.error('[daily-delta] Error fetching current indicators:', fetchError);
      throw fetchError;
    }

    console.log(`[daily-delta] Found ${currentIndicators?.length || 0} current indicators`);

    // Insert today's snapshot
    if (currentIndicators && currentIndicators.length > 0) {
      const snapshotRecords = currentIndicators.map(ind => ({
        snapshot_date: today,
        indicator: ind.indicator,
        kind: ind.kind,
        source: ind.source
      }));

      // Insert in batches of 1000
      for (let i = 0; i < snapshotRecords.length; i += 1000) {
        const batch = snapshotRecords.slice(i, i + 1000);
        const { error: snapshotError } = await supabase
          .from('indicator_snapshots')
          .upsert(batch, { onConflict: 'snapshot_date,indicator,source' });

        if (snapshotError) {
          console.error(`[daily-delta] Error inserting snapshot batch ${i}:`, snapshotError);
        }
      }
      console.log(`[daily-delta] Created snapshot for ${today}`);
    }

    // Step 2: Get yesterday's snapshot
    const { data: yesterdaySnapshot, error: yesterdayError } = await supabase
      .from('indicator_snapshots')
      .select('indicator, kind, source')
      .eq('snapshot_date', yesterday);

    if (yesterdayError) {
      console.error('[daily-delta] Error fetching yesterday snapshot:', yesterdayError);
      throw yesterdayError;
    }

    console.log(`[daily-delta] Found ${yesterdaySnapshot?.length || 0} indicators in yesterday's snapshot`);

    // Step 3: Calculate deltas per kind
    const deltas: { run_date: string; kind: string; added: number; removed: number }[] = [];

    for (const kind of ['ipv4', 'domain']) {
      const todaySet = new Set(
        currentIndicators
          ?.filter(ind => ind.kind === kind)
          .map(ind => ind.indicator) || []
      );

      const yesterdaySet = new Set(
        yesterdaySnapshot
          ?.filter(ind => ind.kind === kind)
          .map(ind => ind.indicator) || []
      );

      // Added: in today but not in yesterday
      const added = [...todaySet].filter(ind => !yesterdaySet.has(ind)).length;

      // Removed: in yesterday but not in today
      const removed = [...yesterdaySet].filter(ind => !todaySet.has(ind)).length;

      deltas.push({
        run_date: today,
        kind,
        added,
        removed
      });

      console.log(`[daily-delta] ${kind}: +${added} -${removed}`);

      // Step 4: Mark removed indicators in raw_indicators
      if (removed > 0) {
        const removedIndicators = [...yesterdaySet].filter(ind => !todaySet.has(ind));
        
        for (let i = 0; i < removedIndicators.length; i += 100) {
          const batch = removedIndicators.slice(i, i + 100);
          const { error: updateError } = await supabase
            .from('raw_indicators')
            .update({ removed_at: new Date().toISOString() })
            .in('indicator', batch)
            .eq('kind', kind)
            .is('removed_at', null);

          if (updateError) {
            console.error(`[daily-delta] Error marking indicators as removed:`, updateError);
          }
        }
        console.log(`[daily-delta] Marked ${removed} ${kind} indicators as removed`);
      }
    }

    // Step 5: Insert deltas into daily_deltas
    const { error: insertError } = await supabase
      .from('daily_deltas')
      .insert(deltas);

    if (insertError) {
      console.error('[daily-delta] Error inserting deltas:', insertError);
      throw insertError;
    }

    console.log(`[daily-delta] Successfully calculated and stored deltas for ${today}`);

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
