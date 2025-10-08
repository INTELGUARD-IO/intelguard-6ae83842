-- Drop existing function to allow type change
DROP FUNCTION IF EXISTS public.get_raw_indicator_stats();

-- Create optimized RPC function for raw indicator stats
CREATE OR REPLACE FUNCTION public.get_raw_indicator_stats()
RETURNS TABLE (
  total_count BIGINT,
  ipv4_count BIGINT,
  domain_count BIGINT,
  unique_sources_count BIGINT,
  unique_ipv4_count BIGINT,
  unique_domain_count BIGINT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE kind = 'ipv4')::BIGINT as ipv4_count,
    COUNT(*) FILTER (WHERE kind = 'domain')::BIGINT as domain_count,
    COUNT(DISTINCT source)::BIGINT as unique_sources_count,
    COUNT(DISTINCT indicator) FILTER (WHERE kind = 'ipv4')::BIGINT as unique_ipv4_count,
    COUNT(DISTINCT indicator) FILTER (WHERE kind = 'domain')::BIGINT as unique_domain_count
  FROM public.raw_indicators
  WHERE removed_at IS NULL;
END;
$$;

-- Create indexes to optimize the stats query if not exists
CREATE INDEX IF NOT EXISTS idx_raw_indicators_kind_removed ON public.raw_indicators(kind, removed_at);
CREATE INDEX IF NOT EXISTS idx_raw_indicators_source_removed ON public.raw_indicators(source, removed_at);
CREATE INDEX IF NOT EXISTS idx_raw_indicators_indicator_kind_removed ON public.raw_indicators(indicator, kind, removed_at);
