-- Fix CRON secret for validation orchestrator and cloudflare radar sync
-- Drop existing CRON jobs with incorrect secret reference
SELECT cron.unschedule('validation-orchestrator');
SELECT cron.unschedule('cloudflare-radar-domains-sync');

-- Recreate validation-orchestrator CRON with hardcoded secret (every 5 minutes)
SELECT cron.schedule(
  'validation-orchestrator',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/validation-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'timestamp', now()
    )
  );
  $$
);

-- Recreate cloudflare-radar-domains-sync CRON with hardcoded secret (weekly on Sunday at 2 AM)
SELECT cron.schedule(
  'cloudflare-radar-domains-sync',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/cloudflare-radar-domains-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'timestamp', now()
    )
  );
  $$
);