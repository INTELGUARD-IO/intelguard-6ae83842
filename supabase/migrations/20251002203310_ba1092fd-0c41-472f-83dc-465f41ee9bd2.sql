-- Add URLScan tracking columns to dynamic_raw_indicators
ALTER TABLE dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS urlscan_checked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS urlscan_score INTEGER,
ADD COLUMN IF NOT EXISTS urlscan_malicious BOOLEAN;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_urlscan 
ON dynamic_raw_indicators(kind, urlscan_checked, confidence DESC, source_count DESC);

-- Configure URLScan Validator (every 4 hours - 6 runs/day = 4998 calls)
SELECT cron.schedule(
  'urlscan-validator-4h',
  '0 */4 * * *',
  $$SELECT public._call_edge('urlscan-validator')$$
);