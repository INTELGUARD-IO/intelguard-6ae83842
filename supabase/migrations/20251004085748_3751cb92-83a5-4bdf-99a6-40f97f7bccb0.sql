-- Add Censys validation columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS censys_checked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS censys_score integer,
ADD COLUMN IF NOT EXISTS censys_malicious boolean;

-- Create table to track monthly API usage for Censys
CREATE TABLE IF NOT EXISTS public.censys_monthly_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE, -- First day of the month (e.g., 2025-01-01)
  api_calls_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on censys_monthly_usage
ALTER TABLE public.censys_monthly_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for censys_monthly_usage
CREATE POLICY "super_admin_full_access_censys_monthly_usage"
ON public.censys_monthly_usage
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_censys_monthly_usage"
ON public.censys_monthly_usage
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tenant_members
  WHERE user_id = auth.uid()
));

-- Add trigger to update updated_at on censys_monthly_usage
CREATE TRIGGER update_censys_monthly_usage_updated_at
BEFORE UPDATE ON public.censys_monthly_usage
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create function to get or create current month usage record
CREATE OR REPLACE FUNCTION public.get_current_month_censys_usage()
RETURNS TABLE(id uuid, month date, api_calls_count integer, remaining_calls integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_month_date date;
  usage_record RECORD;
BEGIN
  -- Get the first day of the current month
  current_month_date := date_trunc('month', CURRENT_DATE)::date;
  
  -- Try to get existing record
  SELECT * INTO usage_record
  FROM censys_monthly_usage
  WHERE month = current_month_date;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO censys_monthly_usage (month, api_calls_count)
    VALUES (current_month_date, 0)
    RETURNING * INTO usage_record;
  END IF;
  
  -- Return the record with calculated remaining calls
  RETURN QUERY
  SELECT 
    usage_record.id,
    usage_record.month,
    usage_record.api_calls_count,
    GREATEST(0, 100 - usage_record.api_calls_count) AS remaining_calls;
END;
$$;

-- Create function to increment Censys API usage
CREATE OR REPLACE FUNCTION public.increment_censys_usage(calls_count integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_month_date date;
BEGIN
  current_month_date := date_trunc('month', CURRENT_DATE)::date;
  
  -- Insert or update the usage count
  INSERT INTO censys_monthly_usage (month, api_calls_count)
  VALUES (current_month_date, calls_count)
  ON CONFLICT (month)
  DO UPDATE SET 
    api_calls_count = censys_monthly_usage.api_calls_count + calls_count,
    updated_at = now();
END;
$$;