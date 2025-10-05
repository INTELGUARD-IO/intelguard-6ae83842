-- Create watchdog logs table to track auto-recovery actions
CREATE TABLE IF NOT EXISTS public.cron_watchdog_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jobid BIGINT NOT NULL,
  jobname TEXT NOT NULL,
  action TEXT NOT NULL, -- 'detected_stuck', 'unscheduled', 'rescheduled'
  runtime_minutes INTEGER,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on watchdog logs
ALTER TABLE public.cron_watchdog_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can view watchdog logs
CREATE POLICY "super_admin_full_access_cron_watchdog_logs"
ON public.cron_watchdog_logs FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Tenant members can view watchdog logs
CREATE POLICY "tenant_members_can_view_cron_watchdog_logs"
ON public.cron_watchdog_logs FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM tenant_members 
  WHERE user_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cron_watchdog_logs_created_at 
ON public.cron_watchdog_logs(created_at DESC);

-- Watchdog function to detect and recover stuck jobs
CREATE OR REPLACE FUNCTION public.watchdog_check_stuck_jobs()
RETURNS TABLE(
  action TEXT,
  jobid BIGINT,
  jobname TEXT,
  runtime_minutes INTEGER,
  message TEXT
) AS $$
DECLARE
  stuck_job RECORD;
  job_schedule TEXT;
  job_command TEXT;
BEGIN
  -- Find jobs running longer than 30 minutes
  FOR stuck_job IN
    SELECT 
      j.jobid,
      j.jobname,
      j.schedule,
      j.command,
      EXTRACT(EPOCH FROM (NOW() - jrd.start_time)) / 60 AS runtime_minutes
    FROM cron.job j
    JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
    WHERE jrd.status = 'starting'
      AND jrd.start_time < NOW() - INTERVAL '30 minutes'
      AND jrd.end_time IS NULL
    ORDER BY jrd.start_time ASC
  LOOP
    -- Log detection
    INSERT INTO public.cron_watchdog_logs (jobid, jobname, action, runtime_minutes, details)
    VALUES (
      stuck_job.jobid,
      stuck_job.jobname,
      'detected_stuck',
      stuck_job.runtime_minutes::INTEGER,
      format('Job stuck for %s minutes', stuck_job.runtime_minutes::INTEGER)
    );

    -- Store schedule and command for re-scheduling
    job_schedule := stuck_job.schedule;
    job_command := stuck_job.command;

    -- Unschedule the stuck job
    BEGIN
      PERFORM cron.unschedule(stuck_job.jobid);
      
      -- Log unschedule action
      INSERT INTO public.cron_watchdog_logs (jobid, jobname, action, runtime_minutes, details)
      VALUES (
        stuck_job.jobid,
        stuck_job.jobname,
        'unscheduled',
        stuck_job.runtime_minutes::INTEGER,
        'Job unscheduled to prevent deadlock'
      );

      -- Re-schedule with less aggressive interval
      -- Change '* * * * *' to '*/10 * * * *' (every 10 minutes)
      IF job_schedule = '* * * * *' THEN
        job_schedule := '*/10 * * * *';
      END IF;

      PERFORM cron.schedule(
        stuck_job.jobname,
        job_schedule,
        job_command
      );

      -- Log re-schedule action
      INSERT INTO public.cron_watchdog_logs (jobid, jobname, action, runtime_minutes, details)
      VALUES (
        stuck_job.jobid,
        stuck_job.jobname,
        'rescheduled',
        stuck_job.runtime_minutes::INTEGER,
        format('Job rescheduled with interval: %s', job_schedule)
      );

      -- Return success info
      RETURN QUERY SELECT 
        'recovered'::TEXT,
        stuck_job.jobid,
        stuck_job.jobname,
        stuck_job.runtime_minutes::INTEGER,
        format('Job %s recovered after %s minutes', stuck_job.jobname, stuck_job.runtime_minutes::INTEGER);

    EXCEPTION WHEN OTHERS THEN
      -- Log error
      INSERT INTO public.cron_watchdog_logs (jobid, jobname, action, runtime_minutes, details)
      VALUES (
        stuck_job.jobid,
        stuck_job.jobname,
        'error',
        stuck_job.runtime_minutes::INTEGER,
        format('Error recovering job: %s', SQLERRM)
      );

      -- Return error info
      RETURN QUERY SELECT 
        'error'::TEXT,
        stuck_job.jobid,
        stuck_job.jobname,
        stuck_job.runtime_minutes::INTEGER,
        format('Failed to recover job: %s', SQLERRM);
    END;
  END LOOP;

  -- If no stuck jobs found, return status
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'healthy'::TEXT,
      NULL::BIGINT,
      'All jobs'::TEXT,
      0::INTEGER,
      'No stuck jobs detected'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedule watchdog to run every 5 minutes
SELECT cron.schedule(
  'watchdog-auto-recovery',
  '*/5 * * * *',
  'SELECT public.watchdog_check_stuck_jobs()'
);

-- Also create a manual trigger function for emergency use
CREATE OR REPLACE FUNCTION public.manual_unstuck_job(p_jobname TEXT)
RETURNS TEXT AS $$
DECLARE
  target_job RECORD;
  result TEXT;
BEGIN
  -- Find the job by name
  SELECT jobid, schedule, command 
  INTO target_job
  FROM cron.job 
  WHERE jobname = p_jobname;

  IF NOT FOUND THEN
    RETURN format('Job "%s" not found', p_jobname);
  END IF;

  -- Unschedule
  PERFORM cron.unschedule(target_job.jobid);
  
  -- Log action
  INSERT INTO public.cron_watchdog_logs (jobid, jobname, action, runtime_minutes, details)
  VALUES (
    target_job.jobid,
    p_jobname,
    'manual_unstuck',
    0,
    'Manually triggered by admin'
  );

  -- Re-schedule with safer interval
  PERFORM cron.schedule(
    p_jobname,
    CASE 
      WHEN target_job.schedule = '* * * * *' THEN '*/10 * * * *'
      ELSE target_job.schedule
    END,
    target_job.command
  );

  RETURN format('Job "%s" successfully unstuck and rescheduled', p_jobname);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;