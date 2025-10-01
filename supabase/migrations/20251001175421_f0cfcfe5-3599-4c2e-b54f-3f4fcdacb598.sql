-- Drop extensions from public schema and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Recreate the _call_edge function with proper schema reference
DROP FUNCTION IF EXISTS public._call_edge(text);

CREATE FUNCTION public._call_edge(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  edge_base text;
  jwt_token text;
  cron_secret text;
  function_url text;
BEGIN
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

-- Schedule cron jobs (no need to unschedule since extension was recreated)
SELECT cron.schedule(
  'ingest-hourly',
  '0 * * * *',
  $$SELECT public._call_edge('ingest')$$
);

SELECT cron.schedule(
  'schedule-validations-hourly',
  '5 * * * *',
  $$SELECT public._call_edge('schedule-validations')$$
);

SELECT cron.schedule(
  'run-validations-10min',
  '*/10 * * * *',
  $$SELECT public._call_edge('run-validations')$$
);

SELECT cron.schedule(
  'daily-delta-1am',
  '0 1 * * *',
  $$SELECT public._call_edge('daily-delta')$$
);

SELECT cron.schedule(
  'email-dispatch-2am',
  '0 2 * * *',
  $$SELECT public._call_edge('email-dispatch')$$
);