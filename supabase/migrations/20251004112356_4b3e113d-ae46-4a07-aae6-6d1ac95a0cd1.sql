-- Create cloudflare_radar_top_domains table for Top 100K whitelist
CREATE TABLE public.cloudflare_radar_top_domains (
  domain text NOT NULL PRIMARY KEY,
  rank integer,
  bucket text NOT NULL DEFAULT 'top_100000',
  dataset_id text,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Create indices for performance
CREATE INDEX idx_cf_radar_domains_expires_at ON public.cloudflare_radar_top_domains(expires_at);
CREATE INDEX idx_cf_radar_domains_bucket ON public.cloudflare_radar_top_domains(bucket);

-- Enable RLS
ALTER TABLE public.cloudflare_radar_top_domains ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "super_admin_full_access_cf_radar_domains"
ON public.cloudflare_radar_top_domains
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_cf_radar_domains"
ON public.cloudflare_radar_top_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
  )
);

-- Function to clean expired domains
CREATE OR REPLACE FUNCTION public.clean_expired_cf_radar_domains()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.cloudflare_radar_top_domains
  WHERE expires_at < NOW();
END;
$$;

-- CRON job for domain sync (every Monday at 02:00 UTC)
SELECT cron.schedule(
  'cloudflare-radar-domains-sync-job',
  '0 2 * * 1',
  $$
  SELECT public._call_edge('cloudflare-radar-domains-sync');
  $$
);

-- CRON job for domain validation (every day at 03:00 UTC)
SELECT cron.schedule(
  'cloudflare-radar-domain-validator-job',
  '0 3 * * *',
  $$
  SELECT public._call_edge('cloudflare-radar-domain-validator');
  $$
);
