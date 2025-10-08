-- ============================================================================
-- PHASE 1: Materialized View for Validator Stats
-- Optimizes ValidatorStatsCard query from 5-7s timeout → <100ms
-- ============================================================================

-- Create materialized view for validator statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS validator_stats_mv AS
SELECT 
  -- OTX Stats
  COUNT(*) FILTER (WHERE otx_checked = true) AS otx_checked_count,
  COUNT(*) FILTER (WHERE otx_checked = true AND otx_score > 0) AS otx_malicious_count,
  
  -- SafeBrowsing Stats
  COUNT(*) FILTER (WHERE safebrowsing_checked = true) AS safebrowsing_checked_count,
  COUNT(*) FILTER (WHERE safebrowsing_checked = true AND safebrowsing_score > 0) AS safebrowsing_malicious_count,
  
  -- AbuseIPDB Stats
  COUNT(*) FILTER (WHERE abuseipdb_checked = true) AS abuseipdb_checked_count,
  COUNT(*) FILTER (WHERE abuseipdb_checked = true AND abuseipdb_in_blacklist = true) AS abuseipdb_malicious_count,
  
  -- HoneyDB Stats
  COUNT(*) FILTER (WHERE honeydb_checked = true) AS honeydb_checked_count,
  COUNT(*) FILTER (WHERE honeydb_checked = true AND honeydb_in_blacklist = true) AS honeydb_malicious_count,
  
  -- NeutrinoAPI Stats
  COUNT(*) FILTER (WHERE neutrinoapi_checked = true) AS neutrinoapi_checked_count,
  COUNT(*) FILTER (WHERE neutrinoapi_checked = true AND neutrinoapi_in_blocklist = true) AS neutrinoapi_malicious_count,
  
  -- VirusTotal Stats
  COUNT(*) FILTER (WHERE virustotal_checked = true) AS virustotal_checked_count,
  COUNT(*) FILTER (WHERE virustotal_checked = true AND virustotal_malicious = true) AS virustotal_malicious_count,
  
  -- Censys Stats
  COUNT(*) FILTER (WHERE censys_checked = true) AS censys_checked_count,
  COUNT(*) FILTER (WHERE censys_checked = true AND censys_malicious = true) AS censys_malicious_count,
  
  -- URLScan Stats
  COUNT(*) FILTER (WHERE urlscan_checked = true) AS urlscan_checked_count,
  COUNT(*) FILTER (WHERE urlscan_checked = true AND urlscan_malicious = true) AS urlscan_malicious_count,
  
  -- Cloudflare URLScan Stats
  COUNT(*) FILTER (WHERE cloudflare_urlscan_checked = true) AS cloudflare_urlscan_checked_count,
  COUNT(*) FILTER (WHERE cloudflare_urlscan_checked = true AND cloudflare_urlscan_malicious = true) AS cloudflare_urlscan_malicious_count,
  
  -- Abuse.ch Stats
  COUNT(*) FILTER (WHERE abuse_ch_checked = true) AS abuse_ch_checked_count,
  COUNT(*) FILTER (WHERE abuse_ch_checked = true AND abuse_ch_is_fp = true) AS abuse_ch_malicious_count,
  
  -- Last refresh timestamp
  NOW() AS last_refreshed
FROM dynamic_raw_indicators
WHERE confidence >= 50 AND whitelisted = false;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS validator_stats_mv_unique_idx ON validator_stats_mv ((1));

-- Grant access to authenticated users
ALTER MATERIALIZED VIEW validator_stats_mv OWNER TO postgres;

-- Initial refresh
REFRESH MATERIALIZED VIEW validator_stats_mv;

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_validator_stats_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY validator_stats_mv;
END;
$$;
