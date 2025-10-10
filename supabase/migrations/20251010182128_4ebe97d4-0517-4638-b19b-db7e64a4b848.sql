-- Schedule IPsum Level 7 sync (every 6 hours)
SELECT cron.schedule(
  'ipsum-level7-sync',
  '0 */6 * * *',
  'SELECT _call_edge(''ipsum-level7-sync'')'
);

-- Add entry to ingest_sources for tracking (disabled, managed by edge function)
INSERT INTO ingest_sources (name, url, kind, enabled, priority, description)
VALUES (
  'IPsum Level 7 (Dedicated Sync)', 
  'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/7.txt', 
  'ipv4', 
  false,
  50, 
  'Most dangerous IPs from IPsum project - processed via dedicated sync function'
);