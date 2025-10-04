-- Create bgpview_enrichment table
CREATE TABLE public.bgpview_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator text NOT NULL,
  kind text NOT NULL DEFAULT 'ipv4',
  
  -- rDNS info
  ptr_record text,
  
  -- Prefix info (from best/most specific prefix)
  prefix text,
  cidr integer,
  
  -- ASN info
  asn bigint,
  asn_name text,
  asn_description text,
  country_code text, -- ISO-2
  
  -- Raw JSON for debugging
  raw_response jsonb,
  
  -- Timestamps
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  
  UNIQUE(indicator, kind)
);

-- Create indexes for performance
CREATE INDEX idx_bgpview_indicator ON public.bgpview_enrichment(indicator);
CREATE INDEX idx_bgpview_expires ON public.bgpview_enrichment(expires_at);
CREATE INDEX idx_bgpview_country ON public.bgpview_enrichment(country_code) WHERE country_code IS NOT NULL;

-- Enable RLS
ALTER TABLE public.bgpview_enrichment ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "super_admin_full_access_bgpview"
  ON public.bgpview_enrichment FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_bgpview"
  ON public.bgpview_enrichment FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid()
  ));

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION public.clean_expired_bgpview_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.bgpview_enrichment WHERE expires_at < NOW();
END;
$$;

-- CRON job: every 12 hours (slower than RIPEstat due to rate limits)
SELECT cron.schedule(
  'bgpview-enrich-job',
  '0 */12 * * *',
  $$
  SELECT public._call_edge('bgpview-enrich');
  $$
);