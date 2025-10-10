-- Enable Cyberhost UK Malware Domains source
UPDATE ingest_sources
SET enabled = true
WHERE name = 'Cyberhost UK Malware Domains';