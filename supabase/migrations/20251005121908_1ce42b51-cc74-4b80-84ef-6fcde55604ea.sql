-- Create Materialized View for Raw Indicator Statistics
-- This pre-calculates expensive COUNT operations to avoid timeouts on large datasets
CREATE MATERIALIZED VIEW IF NOT EXISTS raw_indicator_stats_mv AS
SELECT 
  COUNT(*)::BIGINT as total_count,
  COUNT(*) FILTER (WHERE kind = 'ipv4')::BIGINT as ipv4_count,
  COUNT(*) FILTER (WHERE kind = 'domain')::BIGINT as domain_count,
  COUNT(DISTINCT source)::BIGINT as unique_sources_count,
  COUNT(DISTINCT indicator) FILTER (WHERE kind = 'ipv4')::BIGINT as unique_ipv4_count,
  COUNT(DISTINCT indicator) FILTER (WHERE kind = 'domain')::BIGINT as unique_domain_count,
  NOW() as last_updated
FROM public.raw_indicators
WHERE removed_at IS NULL;

-- Create unique index to enable CONCURRENT refresh (non-blocking)
CREATE UNIQUE INDEX IF NOT EXISTS raw_indicator_stats_mv_unique_idx ON raw_indicator_stats_mv ((true));

-- Refresh the materialized view immediately after creation
REFRESH MATERIALIZED VIEW raw_indicator_stats_mv;

-- Replace the existing function to read from the materialized view
CREATE OR REPLACE FUNCTION public.get_raw_indicator_stats()
RETURNS TABLE (
  total_count BIGINT,
  ipv4_count BIGINT,
  domain_count BIGINT,
  unique_sources_count BIGINT,
  unique_ipv4_count BIGINT,
  unique_domain_count BIGINT
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    total_count,
    ipv4_count,
    domain_count,
    unique_sources_count,
    unique_ipv4_count,
    unique_domain_count
  FROM raw_indicator_stats_mv;
$$;

-- Schedule automatic refresh every 5 minutes using pg_cron
-- This keeps statistics up-to-date without blocking queries
SELECT cron.schedule(
  'refresh-raw-indicator-stats-mv',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY raw_indicator_stats_mv$$
);