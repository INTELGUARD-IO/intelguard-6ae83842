-- ========================================
-- OPTIMIZATION PLAN: Performance Indexes + Separate Cron Jobs
-- ========================================

-- Step 1: Create performance index on dynamic_raw_indicators
CREATE INDEX IF NOT EXISTS idx_dynamic_indicators_validation_priority 
ON dynamic_raw_indicators (kind, confidence DESC, last_validated ASC NULLS FIRST)
WHERE whitelisted = false AND confidence >= 50;

-- Step 2: Drop existing intelligent-validator-hourly job (if exists)
SELECT cron.unschedule('intelligent-validator-hourly');

-- Step 3: Create DOMAIN validation job (runs at minute 0 every hour)
SELECT cron.schedule(
  'intelligent-validator-domains',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/intelligent-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'timestamp', now()::text,
      'triggered_by', 'cron',
      'kind', 'domain'
    )
  ) as request_id;
  $$
);

-- Step 4: Create IP validation job (runs at minute 30 every hour)
SELECT cron.schedule(
  'intelligent-validator-ips',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/intelligent-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'timestamp', now()::text,
      'triggered_by', 'cron',
      'kind', 'ipv4'
    )
  ) as request_id;
  $$
);