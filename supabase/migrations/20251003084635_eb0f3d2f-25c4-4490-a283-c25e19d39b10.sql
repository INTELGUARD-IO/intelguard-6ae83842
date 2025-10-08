-- Create honeydb_blacklist table
CREATE TABLE IF NOT EXISTS public.honeydb_blacklist (
  indicator text PRIMARY KEY,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  threat_score integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.honeydb_blacklist ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "super_admin_full_access_honeydb_blacklist"
  ON public.honeydb_blacklist
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Tenant members can view
CREATE POLICY "tenant_members_can_view_honeydb_blacklist"
  ON public.honeydb_blacklist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );

-- Add HoneyDB columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS honeydb_checked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS honeydb_in_blacklist boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS honeydb_threat_score integer DEFAULT NULL;

-- Create function to clean expired HoneyDB entries
CREATE OR REPLACE FUNCTION public.clean_expired_honeydb_blacklist()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM honeydb_blacklist
  WHERE expires_at < NOW();
END;
$$;
