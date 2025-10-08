-- ============================================================================
-- BACKFILL BATCH FUNCTION: Process raw_indicators in chunks
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_dynamic_raw_indicators(batch_size INT DEFAULT 5000)
RETURNS TABLE(
  processed_count INT,
  total_batches INT,
  execution_time_ms INT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch_num INT := 0;
  rows_processed INT := 0;
  start_time TIMESTAMP;
  total_rows BIGINT;
BEGIN
  start_time := clock_timestamp();
  
  -- Get total count estimate
  SELECT COUNT(DISTINCT (indicator, kind)) INTO total_rows
  FROM raw_indicators 
  WHERE removed_at IS NULL;
  
  -- Process in batches
  LOOP
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
    
    GET DIAGNOSTICS rows_processed = ROW_COUNT;
    EXIT WHEN rows_processed = 0;
    
    batch_num := batch_num + 1;
    RAISE NOTICE 'Processed batch % (% rows)', batch_num, rows_processed;
  END LOOP;
  
  -- Create indexes if not exist
  CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_sources_confidence 
  ON dynamic_raw_indicators (source_count DESC, confidence DESC) 
  WHERE whitelisted = false;
  
  CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_validated 
  ON dynamic_raw_indicators (last_validated DESC) 
  WHERE confidence >= 50 AND whitelisted = false;
  
  RETURN QUERY SELECT 
    rows_processed::INT,
    batch_num::INT,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INT;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION backfill_dynamic_raw_indicators TO authenticated;
