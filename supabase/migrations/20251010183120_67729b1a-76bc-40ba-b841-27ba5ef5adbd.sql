-- Add Cyberhost UK Malware Domains to ingest sources
INSERT INTO ingest_sources (name, url, kind, enabled, priority, description)
VALUES (
  'Cyberhost UK Malware Domains',
  'https://lists.cyberhost.uk/malware_domains_only.txt',
  'domain',
  false,
  50,
  'Curated malware distribution and C2 domains from threat intelligence. Processed via cyberhost-malware-sync function.'
)
ON CONFLICT (name) DO NOTHING;

-- Schedule cron job for Cyberhost malware sync (every 6 hours)
SELECT cron.schedule(
  'cyberhost-malware-sync',
  '0 */6 * * *',
  'SELECT _call_edge(''cyberhost-malware-sync'')'
);