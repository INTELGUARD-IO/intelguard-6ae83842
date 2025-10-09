-- Update Cloudflare URLScan validator to run every 2 hours
SELECT cron.unschedule('cloudflare-urlscan-validator-job');

SELECT cron.schedule(
  'cloudflare-urlscan-validator-job',
  '0 */2 * * *', -- Every 2 hours
  'SELECT _call_edge(''cloudflare-urlscan-validator'')'
);