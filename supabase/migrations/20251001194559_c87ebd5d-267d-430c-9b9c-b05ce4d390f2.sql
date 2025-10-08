-- Update the _call_edge function with the correct CRON_SECRET
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
  project_url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co';
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y';
  
  -- Use the actual CRON_SECRET value
  cron_secret_val := 'INTELGUARD_Cr0N2025@2025';
  
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
