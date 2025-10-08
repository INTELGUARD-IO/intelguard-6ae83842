-- Create table for Abuse.Ch False Positive List cache
CREATE TABLE IF NOT EXISTS public.abuse_ch_fplist (
  indicator TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_abuse_ch_fplist_expires ON abuse_ch_fplist(expires_at);

-- Create intermediate table for validated indicators (high confidence)
CREATE TABLE IF NOT EXISTS public.dynamic_raw_indicators (
  id BIGSERIAL PRIMARY KEY,
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  sources TEXT[] NOT NULL, -- Array of sources that reported this indicator
  source_count INTEGER NOT NULL DEFAULT 1,
  first_validated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_validated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  abuse_ch_checked BOOLEAN NOT NULL DEFAULT FALSE,
  abuse_ch_is_fp BOOLEAN DEFAULT NULL, -- NULL if not checked, FALSE if not FP, TRUE if is FP
  UNIQUE(indicator, kind)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_kind ON dynamic_raw_indicators(kind);
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_confidence ON dynamic_raw_indicators(confidence);
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_last_validated ON dynamic_raw_indicators(last_validated);
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_abuse_ch ON dynamic_raw_indicators(abuse_ch_checked, abuse_ch_is_fp);

-- RLS policies for dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_can_view_dynamic_raw_indicators"
ON public.dynamic_raw_indicators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
  )
);

-- RLS policies for abuse_ch_fplist (super admin only for management)
ALTER TABLE public.abuse_ch_fplist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_abuse_ch_fplist"
ON public.abuse_ch_fplist
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_abuse_ch_fplist"
ON public.abuse_ch_fplist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
  )
);

-- Function to clean expired FP list entries
CREATE OR REPLACE FUNCTION clean_expired_abuse_ch_fplist()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM abuse_ch_fplist
  WHERE expires_at < NOW();
END;
$$;
