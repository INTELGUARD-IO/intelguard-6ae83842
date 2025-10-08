-- Fix ambiguous column reference in get_current_month_censys_usage function
CREATE OR REPLACE FUNCTION public.get_current_month_censys_usage()
 RETURNS TABLE(id uuid, month date, api_calls_count integer, remaining_calls integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_month_date date;
  usage_record RECORD;
BEGIN
  -- Get the first day of the current month
  current_month_date := date_trunc('month', CURRENT_DATE)::date;
  
  -- Try to get existing record
  SELECT * INTO usage_record
  FROM censys_monthly_usage
  WHERE censys_monthly_usage.month = current_month_date;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO censys_monthly_usage (month, api_calls_count)
    VALUES (current_month_date, 0)
    RETURNING * INTO usage_record;
  END IF;
  
  -- Return the record with calculated remaining calls
  RETURN QUERY
  SELECT 
    usage_record.id::uuid,
    usage_record.month::date,
    usage_record.api_calls_count::integer,
    GREATEST(0, 100 - usage_record.api_calls_count)::integer AS remaining_calls;
END;
$function$;
