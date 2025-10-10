-- AZIONE 1: Pulizia processi stuck e validator fixes
-- =====================================================

-- 1A) Pulizia network_activity_log stuck (>1 ora)
DELETE FROM network_activity_log 
WHERE status = 'active' 
AND started_at < NOW() - INTERVAL '1 hour';

-- 1B) Cancellazione validation_jobs vecchi (>24h)
DELETE FROM validation_jobs
WHERE status = 'PENDING'
AND scheduled_at < NOW() - INTERVAL '24 hours';

-- 1C) Reset validation_jobs stuck recenti (>2h) per riprocessarli
UPDATE validation_jobs
SET status = 'PENDING', attempts = 0, updated_at = NOW()
WHERE status IN ('PROCESSING', 'FAILED')
AND updated_at < NOW() - INTERVAL '2 hours';

-- AZIONE 2: Fix VirusTotal duplicate key error
-- =====================================================
DELETE FROM validator_status WHERE validator_name = 'virustotal';

INSERT INTO validator_status (validator_name, status, last_error, quota_reset_at)
VALUES ('virustotal', 'active', NULL, NULL)
ON CONFLICT (validator_name) DO NOTHING;

-- AZIONE 2B: Verifica stato altri validator
INSERT INTO validator_status (validator_name, status) VALUES
  ('abuseipdb', 'active'),
  ('honeydb', 'active'),
  ('neutrinoapi', 'active'),
  ('otx', 'active'),
  ('censys', 'active'),
  ('urlscan', 'active'),
  ('cloudflare_urlscan', 'active'),
  ('abuse_ch', 'active'),
  ('safebrowsing', 'active')
ON CONFLICT (validator_name) DO NOTHING;

-- AZIONE 3: Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY raw_indicator_stats_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_mv;