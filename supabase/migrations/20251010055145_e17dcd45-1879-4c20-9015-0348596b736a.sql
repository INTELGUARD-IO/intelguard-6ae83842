-- Ripristino validator cron jobs
-- Intelligent validators
SELECT cron.schedule(
  'intelligent-validator-ips',
  '*/30 * * * *',
  'SELECT _call_edge(''intelligent-validator'')'
);

SELECT cron.schedule(
  'intelligent-validator-domains',
  '*/30 * * * *',
  'SELECT _call_edge(''intelligent-validator'')'
);

-- VirusTotal validators
SELECT cron.schedule(
  'virustotal-validator-morning',
  '0 6 * * *',
  'SELECT _call_edge(''virustotal-validator'')'
);

SELECT cron.schedule(
  'virustotal-validator-afternoon',
  '0 14 * * *',
  'SELECT _call_edge(''virustotal-validator'')'
);

-- AbuseIPDB validator
SELECT cron.schedule(
  'invoke-abuseipdb-validator-every-6-hours',
  '0 */6 * * *',
  'SELECT _call_edge(''abuseipdb-validator'')'
);

-- Abuse.ch validator
SELECT cron.schedule(
  'invoke-abuse-ch-validator-every-6-hours',
  '0 */6 * * *',
  'SELECT _call_edge(''abuse-ch-validator'')'
);

-- HoneyDB validator
SELECT cron.schedule(
  'honeydb-validator-job',
  '0 */12 * * *',
  'SELECT _call_edge(''honeydb-validator'')'
);

-- NeutrinoAPI validator
SELECT cron.schedule(
  'neutrinoapi-validator-job',
  '0 8 * * *',
  'SELECT _call_edge(''neutrinoapi-validator'')'
);

-- OTX validator
SELECT cron.schedule(
  'otx-validator-job',
  '0 */4 * * *',
  'SELECT _call_edge(''otx-validator'')'
);

-- Censys validator
SELECT cron.schedule(
  'censys-monthly-validation',
  '0 0 1 * *',
  'SELECT _call_edge(''censys-validator'')'
);

-- URLScan validators
SELECT cron.schedule(
  'invoke-urlscan-validator-6h',
  '0 */6 * * *',
  'SELECT _call_edge(''urlscan-validator'')'
);

SELECT cron.schedule(
  'invoke-urlscan-validator-daily',
  '0 2 * * *',
  'SELECT _call_edge(''urlscan-validator'')'
);

-- Cloudflare URLScan validator (già aggiornato a 2 ore)
SELECT cron.schedule(
  'cloudflare-urlscan-validator-job',
  '0 */2 * * *',
  'SELECT _call_edge(''cloudflare-urlscan-validator'')'
);

-- Cloudflare Radar domain validator
SELECT cron.schedule(
  'cloudflare-radar-domain-validator-job',
  '0 */6 * * *',
  'SELECT _call_edge(''cloudflare-radar-domain-validator'')'
);

-- Google SafeBrowsing validator
SELECT cron.schedule(
  'google-safebrowsing-validator',
  '0 */4 * * *',
  'SELECT _call_edge(''google-safebrowsing-validator'')'
);

-- Validation orchestrator
SELECT cron.schedule(
  'validation-orchestrator',
  '*/15 * * * *',
  'SELECT _call_edge(''validation-orchestrator'')'
);

-- Whitelist cross validator
SELECT cron.schedule(
  'whitelist-cross-validator-hourly',
  '0 * * * *',
  'SELECT _call_edge(''whitelist-cross-validator'')'
);

-- Pulizia processi stuck
DELETE FROM network_activity_log 
WHERE status = 'active' 
AND started_at < NOW() - INTERVAL '30 minutes';

-- Fix materialized view con indice unique
DROP MATERIALIZED VIEW IF EXISTS raw_indicator_stats_mv;

CREATE MATERIALIZED VIEW raw_indicator_stats_mv AS
SELECT 
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE kind = 'ipv4') AS ipv4_count,
  COUNT(*) FILTER (WHERE kind = 'domain') AS domain_count,
  COUNT(DISTINCT source) AS unique_sources_count,
  COUNT(DISTINCT indicator) FILTER (WHERE kind = 'ipv4') AS unique_ipv4_count,
  COUNT(DISTINCT indicator) FILTER (WHERE kind = 'domain') AS unique_domain_count
FROM raw_indicators
WHERE removed_at IS NULL;

-- Indice unique necessario per refresh concorrente
CREATE UNIQUE INDEX ON raw_indicator_stats_mv (total_count);

-- Ricrea dashboard_stats_mv se non esiste
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats_mv AS
SELECT 
  kind,
  COUNT(*) AS validated_count,
  COUNT(DISTINCT country) FILTER (WHERE country IS NOT NULL) AS countries_count,
  COUNT(DISTINCT asn) FILTER (WHERE asn IS NOT NULL) AS asn_count
FROM validated_indicators
GROUP BY kind;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_mv_kind ON dashboard_stats_mv (kind);