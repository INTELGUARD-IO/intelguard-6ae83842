-- ============================================
-- STEP 1: Disabilita 4 sources morte (HTTP 404)
-- ============================================
UPDATE ingest_sources 
SET enabled = false, 
    last_error = 'Permanently disabled: HTTP 404 - URL no longer exists'
WHERE name IN (
  'Emerging Threats DShield',
  'Gofferje SIP Blocklist',
  'GPF Comics Blocklist',
  'VXVault'
);

-- ============================================
-- STEP 2: Schedula cron jobs per nuove sync functions
-- ============================================

-- Hagezi: ogni 24 ore alle 3 AM (file grande, si aggiorna raramente)
SELECT cron.schedule(
  'hagezi-domains-daily',
  '0 3 * * *',
  'SELECT _call_edge(''hagezi-domains-sync'')'
);

-- AbuseIPDB Top 100: ogni 6 ore (file piccolo, si aggiorna frequentemente)
SELECT cron.schedule(
  'abuseipdb-top100-sync',
  '0 */6 * * *',
  'SELECT _call_edge(''abuseipdb-top100-sync'')'
);

-- ============================================
-- STEP 3: Aggiorna entries esistenti per nuove sync functions
-- ============================================

-- Aggiorna Hagezi entry esistente
UPDATE ingest_sources 
SET 
    enabled = false,
    priority = 50,
    description = 'Processed via storage-based sync function (hagezi-domains-sync). Runs daily at 3 AM. Large file (~50MB) cached in storage.',
    last_error = 'Now handled by dedicated edge function with optimized parsing'
WHERE url = 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt';

-- Aggiorna AbuseIPDB entry esistente
UPDATE ingest_sources 
SET 
    enabled = false,
    priority = 50,
    description = 'Processed via dedicated parser function (abuseipdb-top100-sync). Runs every 6 hours with strict IPv4 validation and bogon filtering.',
    last_error = 'Now handled by dedicated edge function with optimized parsing'
WHERE url = 'https://raw.githubusercontent.com/borestad/blocklist-abuseipdb/main/abuseipdb-s100-30d.ipv4';