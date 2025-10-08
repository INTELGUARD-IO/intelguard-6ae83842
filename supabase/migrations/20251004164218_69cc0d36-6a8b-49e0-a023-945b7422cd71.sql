-- Step 1: Add Cloudflare URLScan columns to dynamic_raw_indicators
ALTER TABLE dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS cloudflare_urlscan_checked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cloudflare_urlscan_score integer,
ADD COLUMN IF NOT EXISTS cloudflare_urlscan_malicious boolean,
ADD COLUMN IF NOT EXISTS cloudflare_urlscan_categories text[],
ADD COLUMN IF NOT EXISTS cloudflare_urlscan_verdict text;

-- Step 2: Create cloudflare_urlscan_cache table
CREATE TABLE IF NOT EXISTS cloudflare_urlscan_cache (
  indicator text NOT NULL,
  kind text NOT NULL DEFAULT 'domain',
  scan_id uuid,
  verdict text,
  score integer,
  malicious boolean DEFAULT false,
  categories text[],
  technologies jsonb,
  certificates jsonb,
  raw_response jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  PRIMARY KEY (indicator, kind)
);

-- Step 3: Enable RLS on cloudflare_urlscan_cache
ALTER TABLE cloudflare_urlscan_cache ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for cloudflare_urlscan_cache
CREATE POLICY super_admin_full_access_cloudflare_urlscan_cache
ON cloudflare_urlscan_cache
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY tenant_members_can_view_cloudflare_urlscan_cache
ON cloudflare_urlscan_cache
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
  )
);

-- Step 5: Create index for expires_at for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_cloudflare_urlscan_cache_expires ON cloudflare_urlscan_cache(expires_at);

-- Step 6: Create cleanup function
CREATE OR REPLACE FUNCTION clean_expired_cloudflare_urlscan_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM cloudflare_urlscan_cache WHERE expires_at < NOW();
END;
$$;
