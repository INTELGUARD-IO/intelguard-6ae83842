-- ============================================================================
-- FASE 3: Creare Validation Jobs per Domini Non Controllati da VirusTotal
-- ============================================================================
-- Inserisci job distribuiti su 24 ore per evitare rate limit
INSERT INTO public.validation_jobs (indicator, kind, status, scheduled_at, attempts)
SELECT DISTINCT 
  indicator, 
  kind, 
  'PENDING',
  now() + (random() * interval '24 hours'),  -- Distribuzione uniforme su 24h
  0
FROM public.dynamic_raw_indicators
WHERE kind = 'domain' 
  AND whitelisted = false
  AND NOT virustotal_checked
  AND NOT EXISTS (
    SELECT 1 FROM validation_jobs vj 
    WHERE vj.indicator = dynamic_raw_indicators.indicator 
      AND vj.kind = dynamic_raw_indicators.kind
  );

-- ============================================================================
-- FASE 2: Trigger Immediato Ingest URLhaus (già esistente, forza re-sync)
-- ============================================================================
SELECT net.http_post(
  url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/ingest',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
    'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
  ),
  body := jsonb_build_object(
    'timestamp', now(),
    'triggered_by', 'manual-urlhaus-resync'
  )
) as request_id;