-- Create table for RIPEstat enrichment data
CREATE TABLE IF NOT EXISTS public.ripestat_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  
  -- Network info
  prefix text,
  asn bigint,
  asn_holder text,
  
  -- Geolocation
  country_code text,
  country_name text,
  city text,
  latitude numeric,
  longitude numeric,
  
  -- DNS
  ptr_record text,
  
  -- Contact
  abuse_email text,
  
  -- Raw data from various endpoints (for reference)
  network_info jsonb,
  geolocation_data jsonb,
  whois_data jsonb,
  routing_status jsonb,
  
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  
  UNIQUE(indicator, kind)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ripestat_enrichment_indicator ON public.ripestat_enrichment(indicator, kind);
CREATE INDEX IF NOT EXISTS idx_ripestat_enrichment_expires ON public.ripestat_enrichment(expires_at);

-- Enable RLS
ALTER TABLE public.ripestat_enrichment ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "super_admin_full_access_ripestat_enrichment"
  ON public.ripestat_enrichment
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_ripestat_enrichment"
  ON public.ripestat_enrichment
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.user_id = auth.uid()
    )
  );

-- Function to clean expired RIPEstat cache
CREATE OR REPLACE FUNCTION public.clean_expired_ripestat_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM ripestat_enrichment
  WHERE expires_at < NOW();
END;
$$;