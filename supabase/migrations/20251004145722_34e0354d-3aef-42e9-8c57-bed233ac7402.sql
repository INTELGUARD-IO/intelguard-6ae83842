-- Create table for Cisco Umbrella Top Domains
CREATE TABLE public.cisco_umbrella_top_domains (
  domain TEXT PRIMARY KEY,
  rank INTEGER,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Enable Row Level Security
ALTER TABLE public.cisco_umbrella_top_domains ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "super_admin_full_access_cisco_umbrella_domains"
ON public.cisco_umbrella_top_domains
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_cisco_umbrella_domains"
ON public.cisco_umbrella_top_domains
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
  )
);

-- Create RPC function to clean expired domains
CREATE OR REPLACE FUNCTION public.clean_expired_cisco_umbrella_domains()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.cisco_umbrella_top_domains
  WHERE expires_at < NOW();
END;
$$;

-- Enhance OTX enrichment table to store more data
ALTER TABLE public.otx_enrichment 
ADD COLUMN IF NOT EXISTS pulse_info JSONB,
ADD COLUMN IF NOT EXISTS passive_dns JSONB,
ADD COLUMN IF NOT EXISTS url_list JSONB,
ADD COLUMN IF NOT EXISTS malware_samples JSONB;
