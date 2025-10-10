-- Enable Cyberhost UK Malware Hosts source
UPDATE ingest_sources
SET enabled = true
WHERE name = 'Cyberhost UK Malware Hosts';