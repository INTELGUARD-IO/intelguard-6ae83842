-- Create cron job for intelligent-validator to run hourly
-- Use DO block to safely handle job creation
DO $$
BEGIN
  -- Try to unschedule if exists, ignore error if it doesn't
  BEGIN
    PERFORM cron.unschedule('intelligent-validator-hourly');
  EXCEPTION
    WHEN OTHERS THEN
      -- Job doesn't exist, continue
      NULL;
  END;
END $$;

-- Create the hourly intelligent-validator cron job
SELECT cron.schedule(
  'intelligent-validator-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/intelligent-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'timestamp', now(),
      'triggered_by', 'cron'
    )
  ) AS request_id;
  $$
);