-- Setup CRON jobs for validation orchestrator and Cloudflare Radar sync

-- CRON Job 1: Validation Orchestrator (every 5 minutes)
SELECT cron.schedule(
  'validation-orchestrator',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/validation-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'timestamp', now()
    )
  );
  $$
);

-- CRON Job 2: Cloudflare Radar Top Domains Sync (every Sunday at 2 AM)
SELECT cron.schedule(
  'cloudflare-radar-domains-sync',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/cloudflare-radar-domains-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'timestamp', now()
    )
  );
  $$
);