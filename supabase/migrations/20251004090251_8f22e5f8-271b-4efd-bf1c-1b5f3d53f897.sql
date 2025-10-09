-- Schedule Censys validator to run on the 1st of each month at 3:00 AM
-- This ensures we use our 100 monthly API calls efficiently
SELECT cron.schedule(
  'censys-monthly-validation',
  '0 3 1 * *', -- At 03:00 on day-of-month 1
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/censys-validator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y", "x-cron-secret": "INTELGUARD_Cr0N2025@2025"}'::jsonb,
    body := jsonb_build_object('timestamp', now(), 'triggered_by', 'cron')
  ) as request_id;
  $$
);