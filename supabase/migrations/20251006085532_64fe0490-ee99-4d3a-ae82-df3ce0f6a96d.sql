-- ============================================================================
-- TRIGGER IMMEDIATO: Intelligent Validator per Domini Abuse.ch
-- ============================================================================
-- Questo trigger invocherà immediatamente intelligent-validator per processare
-- i ~45,000 domini da abuse.ch sources con confidence >= 60%

SELECT net.http_post(
  url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/intelligent-validator',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
    'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
  ),
  body := jsonb_build_object(
    'timestamp', now(),
    'triggered_by', 'manual-abuse-ch-direct-promotion'
  )
) as request_id;
