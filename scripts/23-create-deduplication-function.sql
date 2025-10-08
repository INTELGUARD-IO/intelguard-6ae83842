-- Create function for global deduplication
-- This function groups indicators by value and type, merges additional columns

CREATE OR REPLACE FUNCTION deduplicate_staging_indicators()
RETURNS TABLE (
  indicator_value TEXT,
  indicator_type TEXT,
  source_names TEXT[],
  source_urls TEXT[],
  column_2_values TEXT[],
  column_3_values TEXT[],
  column_4_values TEXT[],
  column_5_values TEXT[],
  occurrences BIGINT,
  first_seen TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ris.indicator_value,
    ris.indicator_type,
    ARRAY_AGG(DISTINCT ris.source_name) as source_names,
    ARRAY_AGG(DISTINCT ris.source_url) as source_urls,
    ARRAY_AGG(DISTINCT ris.column_2) FILTER (WHERE ris.column_2 IS NOT NULL) as column_2_values,
    ARRAY_AGG(DISTINCT ris.column_3) FILTER (WHERE ris.column_3 IS NOT NULL) as column_3_values,
    ARRAY_AGG(DISTINCT ris.column_4) FILTER (WHERE ris.column_4 IS NOT NULL) as column_4_values,
    ARRAY_AGG(DISTINCT ris.column_5) FILTER (WHERE ris.column_5 IS NOT NULL) as column_5_values,
    COUNT(*)::BIGINT as occurrences,
    MIN(ris.created_at) as first_seen,
    MAX(ris.created_at) as last_seen
  FROM raw_indicators_staging ris
  GROUP BY ris.indicator_value, ris.indicator_type;
END;
$$ LANGUAGE plpgsql;

-- Move deduplicated indicators to ingest_buffer
CREATE OR REPLACE FUNCTION move_deduplicated_to_buffer()
RETURNS INTEGER AS $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  -- Insert deduplicated indicators into ingest_buffer
  WITH deduplicated AS (
    SELECT * FROM deduplicate_staging_indicators()
  )
  INSERT INTO ingest_buffer (
    indicator_value,
    indicator_type,
    source_name,
    source_url,
    occurrences,
    first_seen,
    last_seen,
    extra_data,
    status,
    priority,
    created_at
  )
  SELECT 
    d.indicator_value,
    d.indicator_type,
    d.source_names[1], -- First source name
    d.source_urls[1],  -- First source URL
    d.occurrences,
    d.first_seen,
    d.last_seen,
    jsonb_build_object(
      'sources', d.source_names,
      'source_urls', d.source_urls,
      'column_2', d.column_2_values,
      'column_3', d.column_3_values,
      'column_4', d.column_4_values,
      'column_5', d.column_5_values
    ) as extra_data,
    'pending' as status,
    5 as priority,
    NOW() as created_at
  FROM deduplicated d
  ON CONFLICT (indicator_value, indicator_type) 
  DO UPDATE SET
    occurrences = ingest_buffer.occurrences + EXCLUDED.occurrences,
    last_seen = EXCLUDED.last_seen,
    extra_data = ingest_buffer.extra_data || EXCLUDED.extra_data;
  
  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  
  -- Clear staging table after moving
  DELETE FROM raw_indicators_staging;
  
  RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;
