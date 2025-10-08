-- Schedule admin control log email to send hourly from 8:00 to 23:00
-- This provides hourly system health reports to administrators
SELECT cron.schedule(
  'admin-hourly-control-log',
  '0 8-23 * * *', -- Every hour from 8:00 to 23:00 (16 emails per day)
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/admin-control-log',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y", "x-cron-secret": "INTELGUARD_Cr0N2025@2025"}'::jsonb,
    body := jsonb_build_object('timestamp', now(), 'triggered_by', 'cron')
  ) as request_id;
  $$
);
