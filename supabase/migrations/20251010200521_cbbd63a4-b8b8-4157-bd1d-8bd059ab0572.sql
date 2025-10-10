-- Add IPQualityScore columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators
ADD COLUMN ipqs_checked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN ipqs_score INTEGER,
ADD COLUMN ipqs_malicious BOOLEAN,
ADD COLUMN ipqs_risk_score INTEGER,
ADD COLUMN ipqs_category TEXT,
ADD COLUMN ipqs_metadata JSONB;

-- Create ipqualityscore_cache table
CREATE TABLE public.ipqualityscore_cache (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  risk_score INTEGER,
  malware BOOLEAN,
  phishing BOOLEAN,
  spamming BOOLEAN,
  suspicious BOOLEAN,
  adult BOOLEAN,
  category TEXT,
  raw_response JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  PRIMARY KEY (indicator, kind)
);

CREATE INDEX idx_ipqs_cache_expires ON public.ipqualityscore_cache(expires_at);

-- Enable RLS on ipqualityscore_cache
ALTER TABLE public.ipqualityscore_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_ipqs_cache" 
ON public.ipqualityscore_cache
FOR ALL 
USING (is_super_admin(auth.uid())) 
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_ipqs_cache" 
ON public.ipqualityscore_cache
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM tenant_members WHERE user_id = auth.uid()
));

-- Create ipqs_monthly_usage table
CREATE TABLE public.ipqs_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  api_calls_count INTEGER NOT NULL DEFAULT 0,
  monthly_limit INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on ipqs_monthly_usage
ALTER TABLE public.ipqs_monthly_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_ipqs_usage" 
ON public.ipqs_monthly_usage
FOR ALL 
USING (is_super_admin(auth.uid())) 
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_ipqs_usage" 
ON public.ipqs_monthly_usage
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM tenant_members WHERE user_id = auth.uid()
));

-- Create function to increment IPQS usage
CREATE OR REPLACE FUNCTION public.increment_ipqs_usage(calls_count INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month_date DATE;
BEGIN
  current_month_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  INSERT INTO ipqs_monthly_usage (month, api_calls_count)
  VALUES (current_month_date, calls_count)
  ON CONFLICT (month)
  DO UPDATE SET 
    api_calls_count = ipqs_monthly_usage.api_calls_count + calls_count,
    updated_at = NOW();
END;
$$;

-- Create function to get current month IPQS quota
CREATE OR REPLACE FUNCTION public.get_current_month_ipqs_quota()
RETURNS TABLE(
  id UUID,
  month DATE,
  api_calls_count INTEGER,
  remaining_calls INTEGER,
  monthly_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month_date DATE;
  usage_record RECORD;
BEGIN
  current_month_date := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  SELECT * INTO usage_record
  FROM ipqs_monthly_usage
  WHERE ipqs_monthly_usage.month = current_month_date;
  
  IF NOT FOUND THEN
    INSERT INTO ipqs_monthly_usage (month, api_calls_count, monthly_limit)
    VALUES (current_month_date, 0, 1000)
    RETURNING * INTO usage_record;
  END IF;
  
  RETURN QUERY
  SELECT 
    usage_record.id::UUID,
    usage_record.month::DATE,
    usage_record.api_calls_count::INTEGER,
    GREATEST(0, usage_record.monthly_limit - usage_record.api_calls_count)::INTEGER,
    usage_record.monthly_limit::INTEGER;
END;
$$;

-- Create trigger for auto-update updated_at
CREATE TRIGGER set_updated_at_ipqs_monthly_usage
BEFORE UPDATE ON ipqs_monthly_usage
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create index for high-priority domain candidates
CREATE INDEX idx_dynamic_raw_ipqs_candidates 
ON public.dynamic_raw_indicators(confidence DESC, last_validated DESC) 
WHERE kind = 'domain' AND ipqs_checked = false AND confidence >= 70;

-- Schedule cron job for daily validation
SELECT cron.schedule(
  'ipqualityscore-validator-daily',
  '0 5 * * *',
  'SELECT _call_edge(''ipqualityscore-validator'')'
);