-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Remove any existing jobs with the same names to avoid duplicates
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname IN (
  'invoke-abuse-ch-validator-every-6-hours',
  'invoke-abuseipdb-validator-every-6-hours', 
  'invoke-urlscan-validator-daily',
  'invoke-ingest-every-hour'
);

-- Schedule Abuse.ch Validator (every 6 hours)
SELECT cron.schedule(
  'invoke-abuse-ch-validator-every-6-hours',
  '0 */6 * * *',
  $$
  SELECT public._call_edge('abuse-ch-validator');
  $$
);

-- Schedule AbuseIPDB Validator (every 6 hours, offset by 1 hour)
SELECT cron.schedule(
  'invoke-abuseipdb-validator-every-6-hours',
  '0 1,7,13,19 * * *',
  $$
  SELECT public._call_edge('abuseipdb-validator');
  $$
);

-- Schedule URLScan Validator (daily at 2 AM)
SELECT cron.schedule(
  'invoke-urlscan-validator-daily',
  '0 2 * * *',
  $$
  SELECT public._call_edge('urlscan-validator');
  $$
);

-- Schedule Ingest (every hour)
SELECT cron.schedule(
  'invoke-ingest-every-hour',
  '0 * * * *',
  $$
  SELECT public._call_edge('ingest');
  $$
);

-- Verify jobs were created
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'invoke-%'
ORDER BY jobname;
