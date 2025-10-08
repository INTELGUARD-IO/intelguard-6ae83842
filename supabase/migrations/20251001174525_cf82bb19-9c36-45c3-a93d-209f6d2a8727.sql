-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create helper function to call edge functions
-- This function uses GUC parameters set at database level:
--   app.settings.edge_base           (e.g., https://qmsidlazqaqwcptpsjqh.functions.supabase.co)
--   app.settings.edge_function_jwt   (Bearer token for Authorization header)
--   app.settings.cron_secret         (x-cron-secret header value)
CREATE OR REPLACE FUNCTION public._call_edge(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_base text;
  jwt_token text;
  cron_secret text;
  function_url text;
BEGIN
  -- Read settings from database parameters (set via Dashboard -> Settings -> Database -> Parameters)
  edge_base := current_setting('app.settings.edge_base', true);
  jwt_token := current_setting('app.settings.edge_function_jwt', true);
  cron_secret := current_setting('app.settings.cron_secret', true);

  IF edge_base IS NULL OR jwt_token IS NULL OR cron_secret IS NULL THEN
    RAISE EXCEPTION 'Missing GUC parameters: app.settings.edge_base, edge_function_jwt, or cron_secret';
  END IF;

  function_url := edge_base || '/' || function_name;

  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || jwt_token,
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule cron jobs
-- Note: These jobs will fail until GUC parameters are set in Dashboard

-- 1. Ingest: Run every hour at minute 0
SELECT cron.schedule(
  'ingest-hourly',
  '0 * * * *',
  $$SELECT public._call_edge('ingest')$$
);

-- 2. Schedule validations: Run every hour at minute 5
SELECT cron.schedule(
  'schedule-validations-hourly',
  '5 * * * *',
  $$SELECT public._call_edge('schedule-validations')$$
);

-- 3. Run validations: Run every 10 minutes
SELECT cron.schedule(
  'run-validations-10min',
  '*/10 * * * *',
  $$SELECT public._call_edge('run-validations')$$
);

-- 4. Daily delta: Run daily at 1:00 AM UTC
SELECT cron.schedule(
  'daily-delta-1am',
  '0 1 * * *',
  $$SELECT public._call_edge('daily-delta')$$
);

-- 5. Email dispatch: Run daily at 2:00 AM UTC
SELECT cron.schedule(
  'email-dispatch-2am',
  '0 2 * * *',
  $$SELECT public._call_edge('email-dispatch')$$
);
