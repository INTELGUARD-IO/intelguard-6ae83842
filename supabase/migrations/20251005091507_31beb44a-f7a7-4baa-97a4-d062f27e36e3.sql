-- Enable whitelist-cross-validator-hourly cron job
-- This will mark whitelisted domains every hour, saving ~14,540 API calls/day

SELECT cron.schedule(
  'whitelist-cross-validator-hourly',
  '0 * * * *', -- Every hour at :00
  $$
  SELECT public._call_edge('whitelist-cross-validator');
  $$
);
