-- Create table for AbuseIPDB Blacklist cache
CREATE TABLE IF NOT EXISTS public.abuseipdb_blacklist (
  indicator TEXT PRIMARY KEY,
  abuse_confidence_score INTEGER NOT NULL CHECK (abuse_confidence_score >= 0 AND abuse_confidence_score <= 100),
  last_reported_at TIMESTAMP WITH TIME ZONE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_abuseipdb_blacklist_expires ON abuseipdb_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_abuseipdb_blacklist_score ON abuseipdb_blacklist(abuse_confidence_score DESC);

-- Add AbuseIPDB tracking columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators 
ADD COLUMN IF NOT EXISTS abuseipdb_checked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS abuseipdb_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS abuseipdb_in_blacklist BOOLEAN DEFAULT NULL;

-- RLS Policies for abuseipdb_blacklist
ALTER TABLE public.abuseipdb_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_full_access_abuseipdb_blacklist" ON public.abuseipdb_blacklist;
CREATE POLICY "super_admin_full_access_abuseipdb_blacklist"
ON public.abuseipdb_blacklist
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tenant_members_can_view_abuseipdb_blacklist" ON public.abuseipdb_blacklist;
CREATE POLICY "tenant_members_can_view_abuseipdb_blacklist"
ON public.abuseipdb_blacklist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
  )
);

-- Function to clean expired AbuseIPDB blacklist entries
CREATE OR REPLACE FUNCTION clean_expired_abuseipdb_blacklist()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM abuseipdb_blacklist
  WHERE expires_at < NOW();
END;
$$;