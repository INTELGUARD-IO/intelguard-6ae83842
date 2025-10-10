-- Create ip_api_enrichment table with 3-day TTL
CREATE TABLE public.ip_api_enrichment (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ipv4',
  
  -- Geolocation data
  continent TEXT,
  continent_code TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  region_name TEXT,
  city TEXT,
  district TEXT,
  zip TEXT,
  lat NUMERIC,
  lon NUMERIC,
  timezone TEXT,
  
  -- Network data
  isp TEXT,
  org TEXT,
  as_number INTEGER,
  as_name TEXT,
  
  -- Flags
  is_mobile BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,
  is_hosting BOOLEAN DEFAULT false,
  
  -- Metadata
  raw_response JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  
  PRIMARY KEY (indicator, kind)
);

-- Indexes for performance
CREATE INDEX idx_ip_api_enrichment_expires ON public.ip_api_enrichment(expires_at);
CREATE INDEX idx_ip_api_enrichment_asn ON public.ip_api_enrichment(as_number) WHERE as_number IS NOT NULL;
CREATE INDEX idx_ip_api_enrichment_country ON public.ip_api_enrichment(country_code) WHERE country_code IS NOT NULL;

-- RLS Policies
ALTER TABLE public.ip_api_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_ip_api_enrichment"
  ON public.ip_api_enrichment FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_ip_api_enrichment"
  ON public.ip_api_enrichment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid()
  ));

COMMENT ON TABLE public.ip_api_enrichment IS 'IP enrichment data from ip-api.com (free tier, 3-day TTL)';

-- Cleanup function
CREATE OR REPLACE FUNCTION public.clean_expired_ip_api_cache()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.ip_api_enrichment WHERE expires_at < NOW();
END;
$$;

COMMENT ON FUNCTION public.clean_expired_ip_api_cache IS 'Removes expired ip-api.com cache entries (3-day TTL)';

-- Update get_paginated_indicators to prioritize ip-api.com
CREATE OR REPLACE FUNCTION public.get_paginated_indicators(
  p_kind text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  indicator text,
  kind text,
  confidence numeric,
  threat_type text,
  country text,
  asn text,
  last_validated timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM validated_indicators v
  WHERE (p_kind IS NULL OR v.kind = p_kind);
  
  RETURN QUERY
  SELECT 
    v.indicator,
    v.kind,
    v.confidence,
    v.threat_type,
    COALESCE(
      e_ipapi.country_code,
      e_ripe.country_code,
      e_bgp.country_code,
      e_cf.country_code
    ) as country,
    COALESCE(
      e_ipapi.as_number::TEXT,
      e_ripe.asn::TEXT,
      e_bgp.asn::TEXT,
      e_cf.asn::TEXT
    ) as asn,
    v.last_validated,
    v_total_count as total_count
  FROM validated_indicators v
  LEFT JOIN ip_api_enrichment e_ipapi 
    ON e_ipapi.indicator = v.indicator AND e_ipapi.kind = v.kind
  LEFT JOIN ripestat_enrichment e_ripe 
    ON e_ripe.indicator = v.indicator AND e_ripe.kind = v.kind
  LEFT JOIN bgpview_enrichment e_bgp 
    ON e_bgp.indicator = v.indicator AND e_bgp.kind = v.kind
  LEFT JOIN cloudflare_radar_enrichment e_cf 
    ON e_cf.indicator = v.indicator AND e_cf.kind = v.kind
  WHERE (p_kind IS NULL OR v.kind = p_kind)
  ORDER BY v.last_validated DESC
  LIMIT p_limit
  OFFSET (p_page - 1) * p_limit;
END;
$$;

-- Schedule cron jobs
SELECT cron.schedule(
  'ip-api-enrich-job',
  '0 */6 * * *',
  'SELECT public._call_edge(''ip-api-enrich'')'
);

SELECT cron.schedule(
  'ip-api-cache-cleanup',
  '0 3 * * *',
  'SELECT public.clean_expired_ip_api_cache()'
);

-- Immediate trigger to populate data now
SELECT net.http_post(
  url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/ip-api-enrich',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
    'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
  ),
  body := jsonb_build_object(
    'timestamp', NOW(),
    'triggered_by', 'migration_initial_run'
  )
);