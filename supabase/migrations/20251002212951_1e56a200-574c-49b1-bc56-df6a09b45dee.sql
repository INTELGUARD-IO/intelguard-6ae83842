-- Step 1: Create function to retrieve real CRON jobs
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean,
  jobname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobid,
    j.schedule,
    j.command,
    j.nodename,
    j.nodeport,
    j.database,
    j.username,
    j.active,
    j.jobname
  FROM cron.job j
  ORDER BY j.jobid;
END;
$$;

-- Step 2: Clean up duplicate CRON jobs (remove old ones without 'invoke-' prefix)
-- Keep only the newer 'invoke-*' jobs
DO $$
BEGIN
  -- Remove old duplicate jobs if they exist
  PERFORM cron.unschedule('ingest-hourly');
  PERFORM cron.unschedule('run-validations-every-30-minutes');
  PERFORM cron.unschedule('schedule-validations-every-5-minutes');
  PERFORM cron.unschedule('abuse-ch-validator-hourly');
  PERFORM cron.unschedule('abuseipdb-validator-every-6-hours');
  PERFORM cron.unschedule('urlscan-validator-hourly');
  PERFORM cron.unschedule('daily-delta-midnight');
EXCEPTION
  WHEN OTHERS THEN
    -- Job might not exist, continue
    NULL;
END;
$$;

-- Step 3: Improve _call_edge function with better logging and error handling
CREATE OR REPLACE FUNCTION public._call_edge(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  function_url text;
  project_url text;
  service_role_key text;
  cron_secret_val text;
  request_id bigint;
  response_status integer;
  response_body text;
BEGIN
  -- Log the start of execution
  RAISE LOG 'Starting _call_edge for function: %', function_name;
  
  -- Hardcode the project-specific values
  project_url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co';
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y';
  cron_secret_val := 'INTELGUARD_Cr0N2025@2025';
  
  function_url := project_url || '/' || function_name;
  
  RAISE LOG 'Calling edge function URL: %', function_url;

  -- Make the HTTP POST request and capture the response
  SELECT INTO request_id
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'x-cron-secret', cron_secret_val
      ),
      body := jsonb_build_object(
        'timestamp', now(),
        'triggered_by', 'cron'
      )
    );
  
  RAISE LOG 'Edge function call completed. Request ID: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error calling edge function %: % - %', function_name, SQLERRM, SQLSTATE;
    -- Re-raise the exception so CRON knows it failed
    RAISE;
END;
$function$;

-- Grant execute permission on get_cron_jobs to authenticated users
GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO authenticated;