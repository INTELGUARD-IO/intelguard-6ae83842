-- Disable duplicate IPsum source (keep only levels/3.txt)
UPDATE ingest_sources 
SET enabled = false 
WHERE url = 'https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt';

-- Schedule source health check every 2 hours
SELECT cron.schedule(
  'source-health-check-every-2h',
  '0 */2 * * *',  -- Every 2 hours at minute 0
  $$
  SELECT _call_edge('source-health-check');
  $$
);
