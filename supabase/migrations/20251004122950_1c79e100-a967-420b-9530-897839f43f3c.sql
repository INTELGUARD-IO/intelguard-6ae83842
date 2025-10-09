-- =====================================================
-- Google Safe Browsing API Validator Migration
-- =====================================================

-- 1. Create cache table for Safe Browsing results
CREATE TABLE IF NOT EXISTS public.google_safebrowsing_cache (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  threat_types TEXT[] DEFAULT '{}',
  platform_types TEXT[] DEFAULT '{}',
  threat_entry_types TEXT[] DEFAULT '{}',
  is_threat BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'clean',
  raw_response JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  PRIMARY KEY (indicator, kind)
);

CREATE INDEX IF NOT EXISTS idx_gsb_cache_expires ON public.google_safebrowsing_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_gsb_cache_verdict ON public.google_safebrowsing_cache(verdict, is_threat);
CREATE INDEX IF NOT EXISTS idx_gsb_cache_kind ON public.google_safebrowsing_cache(kind, checked_at DESC);

-- 2. Add Safe Browsing columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS safebrowsing_checked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS safebrowsing_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS safebrowsing_verdict TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_dynamic_safebrowsing 
ON public.dynamic_raw_indicators(kind, safebrowsing_checked, confidence DESC);

-- 3. Create cleanup function for expired cache
CREATE OR REPLACE FUNCTION public.clean_expired_safebrowsing_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM google_safebrowsing_cache WHERE expires_at < NOW();
END;
$$;

-- 4. Enable RLS on cache table
ALTER TABLE public.google_safebrowsing_cache ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for cache table
CREATE POLICY "super_admin_full_access_safebrowsing_cache"
ON public.google_safebrowsing_cache FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_safebrowsing_cache"
ON public.google_safebrowsing_cache FOR SELECT
USING (EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid()));

-- 6. Create CRON job for automatic validation (every 12 hours)
SELECT cron.schedule(
  'google-safebrowsing-validator',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/google-safebrowsing-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object('timestamp', now(), 'triggered_by', 'cron')
  ) as request_id;
  $$
);