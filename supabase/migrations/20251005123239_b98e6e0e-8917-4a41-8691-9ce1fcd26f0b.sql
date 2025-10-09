-- Create AbuseIPDB quota tracking table
CREATE TABLE IF NOT EXISTS public.abuseipdb_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  daily_limit INTEGER NOT NULL DEFAULT 1000,
  used_count INTEGER NOT NULL DEFAULT 0,
  remaining_count INTEGER GENERATED ALWAYS AS (daily_limit - used_count) STORED,
  last_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.abuseipdb_quota ENABLE ROW LEVEL SECURITY;

-- RLS policies for super admin and tenant members
CREATE POLICY "super_admin_full_access_abuseipdb_quota"
  ON public.abuseipdb_quota
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_abuseipdb_quota"
  ON public.abuseipdb_quota
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_members WHERE user_id = auth.uid()
  ));

-- Function to increment AbuseIPDB usage
CREATE OR REPLACE FUNCTION public.increment_abuseipdb_usage(calls_count INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_date_val DATE;
BEGIN
  current_date_val := CURRENT_DATE;
  
  -- Insert or update the usage count for today
  INSERT INTO abuseipdb_quota (date, used_count, last_reset_at)
  VALUES (current_date_val, calls_count, NOW())
  ON CONFLICT (date)
  DO UPDATE SET 
    used_count = abuseipdb_quota.used_count + calls_count,
    updated_at = NOW();
END;
$$;

-- Function to get current AbuseIPDB quota
CREATE OR REPLACE FUNCTION public.get_current_day_abuseipdb_quota()
RETURNS TABLE (
  id UUID,
  date DATE,
  daily_limit INTEGER,
  used_count INTEGER,
  remaining_count INTEGER,
  last_reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_date_val DATE;
  quota_record RECORD;
BEGIN
  current_date_val := CURRENT_DATE;
  
  -- Try to get existing record for today
  SELECT * INTO quota_record
  FROM abuseipdb_quota
  WHERE abuseipdb_quota.date = current_date_val;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO abuseipdb_quota (date, used_count, daily_limit)
    VALUES (current_date_val, 0, 1000)
    RETURNING * INTO quota_record;
  END IF;
  
  -- Return the record
  RETURN QUERY
  SELECT 
    quota_record.id::UUID,
    quota_record.date::DATE,
    quota_record.daily_limit::INTEGER,
    quota_record.used_count::INTEGER,
    (quota_record.daily_limit - quota_record.used_count)::INTEGER AS remaining_count,
    quota_record.last_reset_at::TIMESTAMP WITH TIME ZONE;
END;
$$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_abuseipdb_quota_date ON public.abuseipdb_quota(date DESC);