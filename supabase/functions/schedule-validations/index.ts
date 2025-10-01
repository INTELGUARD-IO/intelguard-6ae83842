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

    console.log('[schedule-validations] Starting scheduling run...');

    // TODO: Query raw_indicators for items updated in last 24 hours
    // that don't already have a PENDING job in validation_jobs
    //
    // Steps:
    // 1. SELECT DISTINCT indicator, kind FROM raw_indicators
    //    WHERE last_seen > now() - interval '24 hours'
    // 2. LEFT JOIN validation_jobs vj ON (indicator, kind) 
    //    WHERE vj.id IS NULL OR vj.status != 'PENDING'
    // 3. Deduplicate to ensure one job per (indicator, kind)
    // 4. Cap to 100 jobs per run (rate limiting)
    // 5. INSERT INTO validation_jobs (indicator, kind, status, scheduled_at)
    //
    // Example query structure:
    // const { data: candidates, error: fetchError } = await supabase
    //   .from('raw_indicators')
    //   .select('indicator, kind')
    //   .gte('last_seen', new Date(Date.now() - 24*60*60*1000).toISOString())
    //   .limit(100);

    const candidates: Array<{ indicator: string; kind: string }> = [];
    
    console.log('[schedule-validations] TODO: Query raw_indicators for candidates');

    // Create validation jobs
    if (candidates.length > 0) {
      const jobs = candidates.map(c => ({
        indicator: c.indicator,
        kind: c.kind,
        status: 'PENDING',
        scheduled_at: new Date().toISOString(),
        attempts: 0,
      }));

      const { error } = await supabase
        .from('validation_jobs')
        .insert(jobs);

      if (error) {
        console.error('[schedule-validations] Error inserting jobs:', error);
        throw error;
      }

      console.log(`[schedule-validations] Scheduled ${jobs.length} validation jobs`);
    } else {
      console.log('[schedule-validations] No new jobs to schedule');
    }

    return new Response(
      JSON.stringify({ success: true, scheduled: candidates.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[schedule-validations] Error:', error);
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
