-- Migration: Schedule IPsum Level 7 cron job
-- Description: Add cron schedule for existing IPsum Level 7 source

-- Schedule daily cron job at 04:00 UTC
SELECT cron.schedule(
  'ipsum-level7-daily-sync',
  '0 4 * * *',
  'SELECT _call_edge(''ipsum-level7-sync'')'
);

-- Trigger immediate ingest
SELECT net.http_post(
  url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/ipsum-level7-sync',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
    'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
  ),
  body := jsonb_build_object(
    'timestamp', now(),
    'triggered_by', 'cron_schedule_setup'
  )
);