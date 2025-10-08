-- Schedule RIPEstat enrichment to run every 6 hours
SELECT cron.schedule(
  'ripestat-enrich-job',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT public._call_edge('ripestat-enrich');
  $$
);
