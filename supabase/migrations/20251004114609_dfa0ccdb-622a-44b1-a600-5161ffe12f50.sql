-- Create OTX enrichment cache table
CREATE TABLE IF NOT EXISTS public.otx_enrichment (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  verdict TEXT,
  pulses_count INTEGER DEFAULT 0,
  authors_count INTEGER DEFAULT 0,
  latest_pulse TIMESTAMPTZ,
  country TEXT,
  asn TEXT,
  tags TEXT[],
  reasons TEXT[],
  raw_otx JSONB,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_seconds INTEGER DEFAULT 86400,
  PRIMARY KEY (indicator, kind)
);

-- Enable RLS
ALTER TABLE public.otx_enrichment ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "super_admin_full_access_otx_enrichment"
ON public.otx_enrichment
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_otx_enrichment"
ON public.otx_enrichment
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
  )
);

-- Index for TTL checks
CREATE INDEX idx_otx_enrichment_ttl ON public.otx_enrichment (refreshed_at, ttl_seconds);

-- Cleanup function for expired cache
CREATE OR REPLACE FUNCTION public.clean_expired_otx_cache()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM otx_enrichment
  WHERE (EXTRACT(EPOCH FROM (NOW() - refreshed_at))::INTEGER) > ttl_seconds;
END;
$$;
