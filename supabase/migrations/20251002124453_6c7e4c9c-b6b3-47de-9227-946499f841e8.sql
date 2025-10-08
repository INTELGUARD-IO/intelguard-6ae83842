-- Remove obsolete CRON jobs
SELECT cron.unschedule('schedule-validations-hourly');
SELECT cron.unschedule('run-validations-10min');

-- Configure Abuse.Ch Validator (hourly)
SELECT cron.schedule(
  'abuse-ch-validator-hourly',
  '0 * * * *',
  $$SELECT public._call_edge('abuse-ch-validator')$$
);

-- Configure AbuseIPDB Validator (every 6 hours)
SELECT cron.schedule(
  'abuseipdb-validator-6h',
  '0 */6 * * *',
  $$SELECT public._call_edge('abuseipdb-validator')$$
);

-- Configure AbuseIPDB Enrichment (daily at 3 AM, respects 1000 calls/day limit)
SELECT cron.schedule(
  'abuseipdb-enrich-daily',
  '0 3 * * *',
  $$SELECT public._call_edge('abuseipdb-enrich')$$
);
