-- Create cron job for ingest to run every hour
-- With 17 sources per run, all 34 sources will be processed in 2 hours

SELECT cron.schedule(
  'ingest-sources-hourly',
  '0 * * * *', -- Every hour at minute 0
  'SELECT _call_edge(''ingest'')'
);