-- Create VirusTotal cache table
CREATE TABLE IF NOT EXISTS public.virustotal_cache (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  last_analysis_stats JSONB,
  reputation INTEGER,
  malicious_count INTEGER DEFAULT 0,
  suspicious_count INTEGER DEFAULT 0,
  harmless_count INTEGER DEFAULT 0,
  undetected_count INTEGER DEFAULT 0,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  PRIMARY KEY (indicator, kind)
);

-- Enable RLS
ALTER TABLE public.virustotal_cache ENABLE ROW LEVEL SECURITY;

-- Policies for virustotal_cache
CREATE POLICY "super_admin_full_access_virustotal_cache"
ON public.virustotal_cache
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_virustotal_cache"
ON public.virustotal_cache
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tenant_members
  WHERE tenant_members.user_id = auth.uid()
));

-- Add VirusTotal columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS virustotal_checked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS virustotal_score INTEGER,
ADD COLUMN IF NOT EXISTS virustotal_malicious BOOLEAN;

-- Function to clean expired VirusTotal cache
CREATE OR REPLACE FUNCTION public.clean_expired_virustotal_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM virustotal_cache
  WHERE expires_at < NOW();
END;
$$;