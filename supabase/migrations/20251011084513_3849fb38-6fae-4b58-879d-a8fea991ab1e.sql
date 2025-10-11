-- Crea cron job per ingest automatico ogni 6 ore
SELECT cron.schedule(
  'auto-ingest-sources',
  '0 */6 * * *', -- Ogni 6 ore
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/ingest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y", "x-cron-secret": "INTELGUARD_Cr0N2025@2025"}'::jsonb,
    body := jsonb_build_object('timestamp', NOW(), 'triggered_by', 'cron')
  ) as request_id;
  $$
);