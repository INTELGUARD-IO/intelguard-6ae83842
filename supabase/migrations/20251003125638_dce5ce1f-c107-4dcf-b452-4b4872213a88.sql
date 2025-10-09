-- Schedule VirusTotal validator to run twice daily (02:00 and 13:00)
-- This ensures 500 API calls per day are distributed across two sessions

-- Morning execution at 02:00 (processes up to 250 indicators)
SELECT cron.schedule(
  'virustotal-validator-morning',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/virustotal-validator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y", "x-cron-secret": "INTELGUARD_Cr0N2025@2025"}'::jsonb,
    body := '{"triggered_by": "cron", "time": "morning"}'::jsonb
  ) as request_id;
  $$
);

-- Afternoon execution at 13:00 (processes up to 250 indicators)
SELECT cron.schedule(
  'virustotal-validator-afternoon',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/virustotal-validator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y", "x-cron-secret": "INTELGUARD_Cr0N2025@2025"}'::jsonb,
    body := '{"triggered_by": "cron", "time": "afternoon"}'::jsonb
  ) as request_id;
  $$
);