-- Add Cyberhost UK Malware Hosts source to ingest_sources
INSERT INTO ingest_sources (name, url, kind, enabled, priority, description)
VALUES (
  'Cyberhost UK Malware Hosts',
  'https://lists.cyberhost.uk/malware_hosts.txt',
  'domain',
  false,
  50,
  'Malware and phishing domains from Cyberhost UK (hosts file format). Processed via cyberhost-malware-hosts-sync function.'
);

-- Schedule automatic cron job for Cyberhost Malware Hosts (every 6 hours)
SELECT cron.schedule(
  'cyberhost-malware-hosts-sync',
  '0 */6 * * *',
  'SELECT _call_edge(''cyberhost-malware-hosts-sync'')'
);