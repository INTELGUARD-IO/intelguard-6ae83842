-- Add removed_at column to raw_indicators for tracking removals
ALTER TABLE raw_indicators ADD COLUMN removed_at TIMESTAMP WITH TIME ZONE;

-- Create indicator_snapshots table for daily delta detection
CREATE TABLE IF NOT EXISTS indicator_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date, indicator, source)
);

CREATE INDEX idx_snapshots_date ON indicator_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_indicator ON indicator_snapshots(indicator);
CREATE INDEX idx_snapshots_kind ON indicator_snapshots(kind);

-- Create cron job for ingest (every 12 hours at 00:00 and 12:00)
SELECT cron.schedule(
  'ingest-indicators',
  '0 */12 * * *',
  $$SELECT public._call_edge('ingest')$$
);

-- Create cron job for daily-delta (every day at 01:00)
SELECT cron.schedule(
  'daily-delta-calculation',
  '0 1 * * *',
  $$SELECT public._call_edge('daily-delta')$$
);