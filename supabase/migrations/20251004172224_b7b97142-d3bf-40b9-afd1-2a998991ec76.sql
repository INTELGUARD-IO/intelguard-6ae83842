-- FASE 1: Backfill country/asn in validated_indicators
UPDATE validated_indicators vi
SET 
  country = es.country,
  asn = es.asn
FROM enrichment_summary es
WHERE vi.indicator = es.indicator
  AND vi.kind = 'ipv4'
  AND (vi.country IS NULL OR vi.asn IS NULL);

-- FASE 2: Migliorare classify_threat_type per supportare meglio i domini
CREATE OR REPLACE FUNCTION public.classify_threat_type(indicator_row dynamic_raw_indicators)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  threat_classification TEXT := 'unknown';
BEGIN
  -- Phishing (priorità ai domini)
  IF indicator_row.safebrowsing_verdict = 'SOCIAL_ENGINEERING' 
     OR (indicator_row.cloudflare_urlscan_categories IS NOT NULL 
         AND 'phishing' = ANY(indicator_row.cloudflare_urlscan_categories)) THEN
    threat_classification := 'phishing';
  
  -- Malware distribution (per domini e IP)
  ELSIF indicator_row.urlscan_malicious = true 
        OR indicator_row.cloudflare_urlscan_malicious = true 
        OR (indicator_row.safebrowsing_verdict IN ('MALWARE', 'UNWANTED_SOFTWARE')) THEN
    threat_classification := 'malware';
  
  -- Botnet/C2 (principalmente IP)
  ELSIF indicator_row.honeydb_in_blacklist = true 
        OR indicator_row.abuse_ch_checked = true 
        OR (indicator_row.virustotal_malicious = true AND indicator_row.virustotal_score > 5) THEN
    threat_classification := 'botnet';
  
  -- Proxy/VPN abuse (IP only)
  ELSIF indicator_row.neutrinoapi_is_proxy = true 
        OR indicator_row.neutrinoapi_is_vpn = true THEN
    threat_classification := 'proxy_abuse';
  
  -- Spam source (IP only)
  ELSIF indicator_row.abuseipdb_in_blacklist = true 
        AND indicator_row.abuseipdb_score > 50 THEN
    threat_classification := 'spam';
  
  -- Generic malicious (low confidence)
  ELSIF indicator_row.confidence >= 50 
        AND (indicator_row.virustotal_malicious = true 
             OR indicator_row.censys_malicious = true) THEN
    threat_classification := 'suspicious';
  
  END IF;

  RETURN threat_classification;
END;
$function$;

-- FASE 3: Creare cron job per cloudflare-urlscan-validator (ogni 8 ore)
SELECT cron.schedule(
  'cloudflare-urlscan-domains',
  '0 */8 * * *',
  $$
  SELECT public._call_edge('cloudflare-urlscan-validator');
  $$
);

-- FASE 4: Creare vista per validator coverage monitoring
CREATE OR REPLACE VIEW validator_coverage AS
SELECT 
  kind,
  COUNT(*) as total_indicators,
  -- SafeBrowsing
  COUNT(*) FILTER (WHERE safebrowsing_checked) as safebrowsing_checked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE safebrowsing_checked) / NULLIF(COUNT(*), 0), 1) as safebrowsing_pct,
  -- Cloudflare URLScan
  COUNT(*) FILTER (WHERE cloudflare_urlscan_checked) as urlscan_checked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cloudflare_urlscan_checked) / NULLIF(COUNT(*), 0), 1) as urlscan_pct,
  -- VirusTotal
  COUNT(*) FILTER (WHERE virustotal_checked) as virustotal_checked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE virustotal_checked) / NULLIF(COUNT(*), 0), 1) as virustotal_pct,
  -- AbuseIPDB
  COUNT(*) FILTER (WHERE abuseipdb_checked) as abuseipdb_checked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE abuseipdb_checked) / NULLIF(COUNT(*), 0), 1) as abuseipdb_pct,
  -- OTX
  COUNT(*) FILTER (WHERE otx_checked) as otx_checked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE otx_checked) / NULLIF(COUNT(*), 0), 1) as otx_pct
FROM dynamic_raw_indicators
WHERE whitelisted = false
GROUP BY kind;