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
    console.error('[schedule-validations] Invalid cron secret');
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }
  
  // If no secret provided, allow manual testing
  if (!providedSecret) {
    console.log('[schedule-validations] Manual test invocation (no cron secret provided)');
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[schedule-validations] Starting scheduling run...');

    // Step 1: Get distinct indicators from last 24h that are not removed
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentIndicators, error: fetchError } = await supabase
      .from('raw_indicators')
      .select('indicator, kind')
      .gte('last_seen', twentyFourHoursAgo)
      .is('removed_at', null);

    if (fetchError) {
      console.error('[schedule-validations] Error fetching recent indicators:', fetchError);
      throw fetchError;
    }

    console.log(`[schedule-validations] Found ${recentIndicators?.length || 0} recent indicators`);

    if (!recentIndicators || recentIndicators.length === 0) {
      console.log('[schedule-validations] No recent indicators to validate');
      return new Response(
        JSON.stringify({ success: true, scheduled: 0, message: 'No recent indicators found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Deduplicate indicators
    const uniqueIndicators = new Map<string, { indicator: string; kind: string }>();
    for (const item of recentIndicators) {
      const key = `${item.indicator}::${item.kind}`;
      if (!uniqueIndicators.has(key)) {
        uniqueIndicators.set(key, item);
      }
    }

    console.log(`[schedule-validations] Deduplicated to ${uniqueIndicators.size} unique indicators`);

    // Step 3: Filter out indicators that already have PENDING jobs
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('validation_jobs')
      .select('indicator, kind')
      .eq('status', 'PENDING');

    if (jobsError) {
      console.error('[schedule-validations] Error fetching pending jobs:', jobsError);
      throw jobsError;
    }

    const pendingSet = new Set<string>();
    if (pendingJobs) {
      for (const job of pendingJobs) {
        pendingSet.add(`${job.indicator}::${job.kind}`);
      }
    }

    console.log(`[schedule-validations] Found ${pendingSet.size} existing PENDING jobs`);

    // Step 4: Create candidates list excluding pending jobs
    const candidates: Array<{ indicator: string; kind: string }> = [];
    for (const [key, value] of uniqueIndicators.entries()) {
      if (!pendingSet.has(key)) {
        candidates.push(value);
      }
    }

    // Step 5: Cap to 100 jobs per run for rate limiting
    const maxJobsPerRun = 100;
    const jobsToSchedule = candidates.slice(0, maxJobsPerRun);
    
    console.log(`[schedule-validations] Scheduling ${jobsToSchedule.length} new validation jobs (${candidates.length} total candidates, capped at ${maxJobsPerRun})`);

    // Create validation jobs
    if (jobsToSchedule.length > 0) {
      const jobs = jobsToSchedule.map(c => ({
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
      JSON.stringify({ success: true, scheduled: jobsToSchedule.length }),
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
