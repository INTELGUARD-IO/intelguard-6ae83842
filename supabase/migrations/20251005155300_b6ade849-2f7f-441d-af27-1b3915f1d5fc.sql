-- Optimize database for handling large datasets

-- Increase work_mem for better query performance on large tables
ALTER DATABASE postgres SET work_mem = '256MB';

-- Create function to safely backfill in smaller batches with timeout protection
CREATE OR REPLACE FUNCTION public.safe_backfill_batch(batch_size INTEGER DEFAULT 1000)
RETURNS TABLE(processed INTEGER, success BOOLEAN, error_msg TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '30s'
AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  -- Process one batch with timeout protection
  BEGIN
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

-- Schedule continuous backfill (every 2 minutes, small batches)
SELECT cron.schedule(
  'continuous-backfill',
  '*/2 * * * *',
  $$SELECT safe_backfill_batch(1000)$$
);