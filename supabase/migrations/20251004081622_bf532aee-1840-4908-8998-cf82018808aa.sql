-- Create function to count unique indicators efficiently
CREATE OR REPLACE FUNCTION public.count_unique_indicators(p_kind text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COUNT(DISTINCT indicator)
  FROM public.raw_indicators
  WHERE kind = p_kind
    AND removed_at IS NULL
$$;