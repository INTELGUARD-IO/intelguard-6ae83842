-- Remove duplicate CRON jobs (keep only the invoke-* prefixed ones)
DO $$
BEGIN
  -- Remove old jobs if they exist
  PERFORM cron.unschedule('abuse-ch-validator-hourly');
  PERFORM cron.unschedule('abuseipdb-validator-6h');
  PERFORM cron.unschedule('urlscan-validator-4h');
  PERFORM cron.unschedule('ingest-hourly');
EXCEPTION
  WHEN OTHERS THEN
    -- Job might not exist, continue
    NULL;
END;
$$;
