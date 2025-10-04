-- Create cloudflare_radar_enrichment table
CREATE TABLE public.cloudflare_radar_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator text NOT NULL,
  kind text NOT NULL DEFAULT 'ipv4',
  
  -- ASN info
  asn bigint,
  asn_name text,
  
  -- Geolocation
  country_code text, -- ISO-2
  
  -- Network info
  prefix text,
  
  -- Raw JSON for debugging
  raw_response jsonb,
  
  -- Timestamps
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  
  UNIQUE(indicator, kind)
);

-- Create indexes for performance
CREATE INDEX idx_cf_radar_indicator ON public.cloudflare_radar_enrichment(indicator);
CREATE INDEX idx_cf_radar_expires ON public.cloudflare_radar_enrichment(expires_at);
CREATE INDEX idx_cf_radar_country ON public.cloudflare_radar_enrichment(country_code) WHERE country_code IS NOT NULL;

-- Enable RLS
ALTER TABLE public.cloudflare_radar_enrichment ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "super_admin_full_access_cf_radar"
  ON public.cloudflare_radar_enrichment FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_cf_radar"
  ON public.cloudflare_radar_enrichment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid()
  ));

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION public.clean_expired_cf_radar_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.cloudflare_radar_enrichment WHERE expires_at < NOW();
END;
$$;

-- CRON job: every 6 hours (better rate limit than BGPview)
SELECT cron.schedule(
  'cloudflare-radar-enrich-job',
  '0 */6 * * *',
  $$
  SELECT public._call_edge('cloudflare-radar-enrich');
  $$
);