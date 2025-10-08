-- Recreate the _call_edge function without GUC parameters
-- Instead, use hardcoded values for the project configuration
DROP FUNCTION IF EXISTS public._call_edge(text);

CREATE FUNCTION public._call_edge(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  function_url text;
  project_url text;
  service_role_key text;
  cron_secret_val text;
BEGIN
  -- Hardcode the project-specific values
  -- These are known at migration time and don't change
  project_url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co';
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y';
  
  -- For cron_secret, try to read from a config table, or use a default
  -- You should update this value to match your CRON_SECRET
  cron_secret_val := 'your-cron-secret-here';
  
  function_url := project_url || '/' || function_name;

  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'x-cron-secret', cron_secret_val
    ),
    body := '{}'::jsonb
  );
END;
$$;
