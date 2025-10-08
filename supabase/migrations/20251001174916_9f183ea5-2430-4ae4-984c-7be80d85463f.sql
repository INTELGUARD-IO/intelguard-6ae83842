-- Fix function search path security warning
DROP FUNCTION IF EXISTS public._call_edge(text);

CREATE FUNCTION public._call_edge(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Move extensions to extensions schema (if not already there)
-- Note: pg_cron and pg_net may already be in extensions schema
-- This is just to ensure they're not in public
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
