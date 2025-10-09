-- Create optimized RPC function for raw indicator stats
CREATE OR REPLACE FUNCTION public.get_raw_indicator_stats()
RETURNS TABLE (
  total_count bigint,
  ipv4_count bigint,
  domain_count bigint,
  unique_ipv4_count bigint,
  unique_domain_count bigint,
  unique_sources_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (WHERE removed_at IS NULL) as total_count,
    COUNT(*) FILTER (WHERE kind = 'ipv4' AND removed_at IS NULL) as ipv4_count,
    COUNT(*) FILTER (WHERE kind = 'domain' AND removed_at IS NULL) as domain_count,
    COUNT(DISTINCT indicator) FILTER (WHERE kind = 'ipv4' AND removed_at IS NULL) as unique_ipv4_count,
    COUNT(DISTINCT indicator) FILTER (WHERE kind = 'domain' AND removed_at IS NULL) as unique_domain_count,
    COUNT(DISTINCT source) FILTER (WHERE removed_at IS NULL) as unique_sources_count
  FROM public.raw_indicators;
$function$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_raw_indicators_kind_removed 
ON public.raw_indicators(kind, removed_at);

CREATE INDEX IF NOT EXISTS idx_raw_indicators_source_removed 
ON public.raw_indicators(source) 
WHERE removed_at IS NULL;