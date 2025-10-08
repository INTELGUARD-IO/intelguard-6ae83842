-- Create priority backfill function that processes domains first
CREATE OR REPLACE FUNCTION public.priority_backfill_domains(batch_size INTEGER DEFAULT 5000)
RETURNS TABLE(processed INTEGER, success BOOLEAN, error_msg TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  BEGIN
    -- Prioritize domains first with larger batches
    WITH batch AS (
      SELECT 
        indicator,
        kind,
        ARRAY_AGG(DISTINCT source ORDER BY source) AS sources,
        COUNT(DISTINCT source) AS source_count,
        MIN(first_seen) AS first_validated,
        MAX(last_seen) AS last_validated
      FROM raw_indicators
      WHERE removed_at IS NULL
        AND kind = 'domain'
        AND (indicator, kind) NOT IN (
          SELECT indicator, kind 
          FROM dynamic_raw_indicators
        )
      GROUP BY indicator, kind
      LIMIT batch_size
    )
    INSERT INTO dynamic_raw_indicators (
      indicator, kind, confidence, sources, source_count, 
      first_validated, last_validated
    )
    SELECT 
      indicator, kind, 60.0, sources, source_count,
      first_validated, last_validated
    FROM batch
    ON CONFLICT (indicator, kind) DO NOTHING;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    RETURN QUERY SELECT rows_affected, TRUE, NULL::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 0, FALSE, SQLERRM;
  END;
END;
$$;

-- Update cron to process domains aggressively every minute
SELECT cron.unschedule('continuous-backfill');

SELECT cron.schedule(
  'priority-domain-backfill',
  '* * * * *',
  $$SELECT priority_backfill_domains(5000)$$
);

-- Keep the original for IPv4 but reduce frequency
SELECT cron.schedule(
  'ipv4-backfill',
  '*/3 * * * *',
  $$SELECT safe_backfill_batch(2000)$$
);
