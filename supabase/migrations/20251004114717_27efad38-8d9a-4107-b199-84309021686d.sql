-- Add OTX validation columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators
ADD COLUMN IF NOT EXISTS otx_checked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS otx_score INTEGER,
ADD COLUMN IF NOT EXISTS otx_verdict TEXT;

-- Create CRON job for OTX validation (runs every 6 hours)
SELECT cron.schedule(
  'otx-validator-job',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/otx-validator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
    ),
    body := jsonb_build_object(
      'timestamp', now(),
      'triggered_by', 'cron'
    )
  );
  $$
);
