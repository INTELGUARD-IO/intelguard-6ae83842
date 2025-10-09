-- ============================================================================
-- Cron Job: Execute intelligent-validator every hour
-- Analyzes validator results and promotes indicators to validated_indicators
-- ============================================================================

-- Create cron job to run intelligent-validator every hour at minute 15
SELECT cron.schedule(
  'intelligent-validator-hourly',
  '15 * * * *', -- Every hour at minute 15 (e.g., 00:15, 01:15, 02:15, etc.)
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/intelligent-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'timestamp', now(),
      'triggered_by', 'cron'
    )
  ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT jobid, schedule, command, active, jobname 
FROM cron.job 
WHERE jobname = 'intelligent-validator-hourly';