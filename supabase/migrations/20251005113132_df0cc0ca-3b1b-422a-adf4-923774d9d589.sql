-- Schedule enrich-validated-indicators to run every 30 minutes
SELECT cron.schedule(
  'enrich-validated-indicators-job',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT public._call_edge('enrich-validated-indicators');
  $$
);

-- Schedule cloudflare-urlscan-validator to run every 30 minutes
SELECT cron.schedule(
  'cloudflare-urlscan-validator-job',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT public._call_edge('cloudflare-urlscan-validator');
  $$
);
