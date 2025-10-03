-- Schedule HoneyDB validator to run every 6 hours
SELECT cron.schedule(
  'honeydb-validator-job',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT public._call_edge('honeydb-validator');
  $$
);