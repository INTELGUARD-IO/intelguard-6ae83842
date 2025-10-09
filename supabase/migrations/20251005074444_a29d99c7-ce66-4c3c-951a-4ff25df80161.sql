-- ========================================
-- FASE 1: TRUSTED DOMAINS (WHITELIST)
-- ========================================

-- Tabella per domini trusted (Cisco Umbrella Top 1M, Cloudflare Radar Top 1M, etc)
CREATE TABLE IF NOT EXISTS public.trusted_domains (
  domain TEXT PRIMARY KEY,
  source TEXT NOT NULL, -- 'cisco_umbrella', 'cloudflare_radar', 'manual'
  rank INTEGER,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Indice per ricerca veloce
CREATE INDEX IF NOT EXISTS idx_trusted_domains_source ON public.trusted_domains(source);

-- RLS policies
ALTER TABLE public.trusted_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_trusted_domains"
ON public.trusted_domains
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_trusted_domains"
ON public.trusted_domains
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
  )
);

-- ========================================
-- FASE 2: CRON JOB MONITORING VIEW
-- ========================================

-- Vista per monitorare lo stato dei cron job
CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT 
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.database,
  jr.status AS last_status,
  jr.start_time AS last_run_start,
  jr.end_time AS last_run_end,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time))::INTEGER AS last_duration_seconds,
  jr.return_message AS last_error,
  -- Calcola il prossimo run previsto
  (SELECT start_time FROM cron.job_run_details 
   WHERE jobid = j.jobid 
   ORDER BY start_time DESC 
   LIMIT 1) + INTERVAL '1 hour' * 
   CASE 
     WHEN j.schedule LIKE '%*/8%' THEN 8
     WHEN j.schedule LIKE '%*/6%' THEN 6
     WHEN j.schedule LIKE '%*/4%' THEN 4
     WHEN j.schedule LIKE '%*/12%' THEN 12
     ELSE 1
   END AS next_run_estimated
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT * FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC
  LIMIT 1
) jr ON true
ORDER BY j.jobid;

-- Grant per super admin
GRANT SELECT ON public.cron_job_status TO authenticated;

-- ========================================
-- FASE 3: FIX CRON JOB CLOUDFLARE URLSCAN
-- ========================================

-- Prima eliminiamo eventuali job esistenti con lo stesso nome
SELECT cron.unschedule('cloudflare-urlscan-domains');

-- Ricreiamo il cron job con sintassi corretta
SELECT cron.schedule(
  'cloudflare-urlscan-domains',
  '0 */8 * * *', -- Ogni 8 ore
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/cloudflare-urlscan-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'timestamp', now(),
      'triggered_by', 'cron'
    )
  );
  $$
);

-- Verifica che il job sia stato creato
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cloudflare-urlscan-domains'
  ) THEN
    RAISE EXCEPTION 'CRON JOB cloudflare-urlscan-domains NON CREATO!';
  ELSE
    RAISE NOTICE 'CRON JOB cloudflare-urlscan-domains creato con successo!';
  END IF;
END $$;