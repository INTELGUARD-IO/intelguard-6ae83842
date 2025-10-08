-- Create stored procedure for atomic source merging in dynamic_raw_indicators
CREATE OR REPLACE FUNCTION merge_validator_result(
  p_indicator TEXT,
  p_kind TEXT,
  p_new_source TEXT,
  p_confidence NUMERIC,
  p_validator_fields JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_sources TEXT[];
  new_sources TEXT[];
  new_source_count INTEGER;
BEGIN
  -- Fetch existing sources or empty array
  SELECT COALESCE(sources, ARRAY[]::TEXT[])
  INTO existing_sources
  FROM dynamic_raw_indicators
  WHERE indicator = p_indicator AND kind = p_kind;
  
  -- Merge sources (add new_source if not already present)
  IF existing_sources IS NULL OR array_length(existing_sources, 1) IS NULL THEN
    new_sources := ARRAY[p_new_source];
  ELSIF NOT (p_new_source = ANY(existing_sources)) THEN
    new_sources := existing_sources || p_new_source;
  ELSE
    new_sources := existing_sources;
  END IF;
  
  new_source_count := COALESCE(array_length(new_sources, 1), 1);
  
  -- Upsert with merged sources + validator fields
  INSERT INTO dynamic_raw_indicators (
    indicator, kind, confidence, sources, source_count, last_validated,
    abuse_ch_checked, abuse_ch_is_fp,
    safebrowsing_checked, safebrowsing_score, safebrowsing_verdict,
    abuseipdb_checked, abuseipdb_score, abuseipdb_in_blacklist,
    honeydb_checked, honeydb_in_blacklist, honeydb_threat_score,
    neutrinoapi_checked, neutrinoapi_in_blocklist, neutrinoapi_host_reputation_score,
    neutrinoapi_is_proxy, neutrinoapi_is_vpn, neutrinoapi_is_hosting, neutrinoapi_metadata,
    virustotal_checked, virustotal_score, virustotal_malicious,
    censys_checked, censys_score, censys_malicious,
    otx_checked, otx_score, otx_verdict,
    urlscan_checked, urlscan_score, urlscan_malicious,
    cloudflare_urlscan_checked, cloudflare_urlscan_score, cloudflare_urlscan_malicious,
    cloudflare_urlscan_categories, cloudflare_urlscan_verdict,
    whitelisted, whitelist_source
  )
  VALUES (
    p_indicator, p_kind, p_confidence, new_sources, new_source_count, NOW(),
    COALESCE((p_validator_fields->>'abuse_ch_checked')::boolean, FALSE),
    (p_validator_fields->>'abuse_ch_is_fp')::boolean,
    COALESCE((p_validator_fields->>'safebrowsing_checked')::boolean, FALSE),
    (p_validator_fields->>'safebrowsing_score')::integer,
    p_validator_fields->>'safebrowsing_verdict',
    COALESCE((p_validator_fields->>'abuseipdb_checked')::boolean, FALSE),
    (p_validator_fields->>'abuseipdb_score')::integer,
    (p_validator_fields->>'abuseipdb_in_blacklist')::boolean,
    COALESCE((p_validator_fields->>'honeydb_checked')::boolean, FALSE),
    (p_validator_fields->>'honeydb_in_blacklist')::boolean,
    (p_validator_fields->>'honeydb_threat_score')::integer,
    COALESCE((p_validator_fields->>'neutrinoapi_checked')::boolean, FALSE),
    (p_validator_fields->>'neutrinoapi_in_blocklist')::boolean,
    (p_validator_fields->>'neutrinoapi_host_reputation_score')::integer,
    (p_validator_fields->>'neutrinoapi_is_proxy')::boolean,
    (p_validator_fields->>'neutrinoapi_is_vpn')::boolean,
    (p_validator_fields->>'neutrinoapi_is_hosting')::boolean,
    (p_validator_fields->>'neutrinoapi_metadata')::jsonb,
    COALESCE((p_validator_fields->>'virustotal_checked')::boolean, FALSE),
    (p_validator_fields->>'virustotal_score')::integer,
    (p_validator_fields->>'virustotal_malicious')::boolean,
    COALESCE((p_validator_fields->>'censys_checked')::boolean, FALSE),
    (p_validator_fields->>'censys_score')::integer,
    (p_validator_fields->>'censys_malicious')::boolean,
    COALESCE((p_validator_fields->>'otx_checked')::boolean, FALSE),
    (p_validator_fields->>'otx_score')::integer,
    p_validator_fields->>'otx_verdict',
    COALESCE((p_validator_fields->>'urlscan_checked')::boolean, FALSE),
    (p_validator_fields->>'urlscan_score')::integer,
    (p_validator_fields->>'urlscan_malicious')::boolean,
    COALESCE((p_validator_fields->>'cloudflare_urlscan_checked')::boolean, FALSE),
    (p_validator_fields->>'cloudflare_urlscan_score')::integer,
    (p_validator_fields->>'cloudflare_urlscan_malicious')::boolean,
    (p_validator_fields->>'cloudflare_urlscan_categories')::text[],
    p_validator_fields->>'cloudflare_urlscan_verdict',
    COALESCE((p_validator_fields->>'whitelisted')::boolean, FALSE),
    p_validator_fields->>'whitelist_source'
  )
  ON CONFLICT (indicator, kind)
  DO UPDATE SET
    confidence = EXCLUDED.confidence,
    sources = new_sources,
    source_count = new_source_count,
    last_validated = NOW(),
    abuse_ch_checked = COALESCE(EXCLUDED.abuse_ch_checked, dynamic_raw_indicators.abuse_ch_checked),
    abuse_ch_is_fp = COALESCE(EXCLUDED.abuse_ch_is_fp, dynamic_raw_indicators.abuse_ch_is_fp),
    safebrowsing_checked = COALESCE(EXCLUDED.safebrowsing_checked, dynamic_raw_indicators.safebrowsing_checked),
    safebrowsing_score = COALESCE(EXCLUDED.safebrowsing_score, dynamic_raw_indicators.safebrowsing_score),
    safebrowsing_verdict = COALESCE(EXCLUDED.safebrowsing_verdict, dynamic_raw_indicators.safebrowsing_verdict),
    abuseipdb_checked = COALESCE(EXCLUDED.abuseipdb_checked, dynamic_raw_indicators.abuseipdb_checked),
    abuseipdb_score = COALESCE(EXCLUDED.abuseipdb_score, dynamic_raw_indicators.abuseipdb_score),
    abuseipdb_in_blacklist = COALESCE(EXCLUDED.abuseipdb_in_blacklist, dynamic_raw_indicators.abuseipdb_in_blacklist),
    honeydb_checked = COALESCE(EXCLUDED.honeydb_checked, dynamic_raw_indicators.honeydb_checked),
    honeydb_in_blacklist = COALESCE(EXCLUDED.honeydb_in_blacklist, dynamic_raw_indicators.honeydb_in_blacklist),
    honeydb_threat_score = COALESCE(EXCLUDED.honeydb_threat_score, dynamic_raw_indicators.honeydb_threat_score),
    neutrinoapi_checked = COALESCE(EXCLUDED.neutrinoapi_checked, dynamic_raw_indicators.neutrinoapi_checked),
    neutrinoapi_in_blocklist = COALESCE(EXCLUDED.neutrinoapi_in_blocklist, dynamic_raw_indicators.neutrinoapi_in_blocklist),
    neutrinoapi_host_reputation_score = COALESCE(EXCLUDED.neutrinoapi_host_reputation_score, dynamic_raw_indicators.neutrinoapi_host_reputation_score),
    neutrinoapi_is_proxy = COALESCE(EXCLUDED.neutrinoapi_is_proxy, dynamic_raw_indicators.neutrinoapi_is_proxy),
    neutrinoapi_is_vpn = COALESCE(EXCLUDED.neutrinoapi_is_vpn, dynamic_raw_indicators.neutrinoapi_is_vpn),
    neutrinoapi_is_hosting = COALESCE(EXCLUDED.neutrinoapi_is_hosting, dynamic_raw_indicators.neutrinoapi_is_hosting),
    neutrinoapi_metadata = COALESCE(EXCLUDED.neutrinoapi_metadata, dynamic_raw_indicators.neutrinoapi_metadata),
    virustotal_checked = COALESCE(EXCLUDED.virustotal_checked, dynamic_raw_indicators.virustotal_checked),
    virustotal_score = COALESCE(EXCLUDED.virustotal_score, dynamic_raw_indicators.virustotal_score),
    virustotal_malicious = COALESCE(EXCLUDED.virustotal_malicious, dynamic_raw_indicators.virustotal_malicious),
    censys_checked = COALESCE(EXCLUDED.censys_checked, dynamic_raw_indicators.censys_checked),
    censys_score = COALESCE(EXCLUDED.censys_score, dynamic_raw_indicators.censys_score),
    censys_malicious = COALESCE(EXCLUDED.censys_malicious, dynamic_raw_indicators.censys_malicious),
    otx_checked = COALESCE(EXCLUDED.otx_checked, dynamic_raw_indicators.otx_checked),
    otx_score = COALESCE(EXCLUDED.otx_score, dynamic_raw_indicators.otx_score),
    otx_verdict = COALESCE(EXCLUDED.otx_verdict, dynamic_raw_indicators.otx_verdict),
    urlscan_checked = COALESCE(EXCLUDED.urlscan_checked, dynamic_raw_indicators.urlscan_checked),
    urlscan_score = COALESCE(EXCLUDED.urlscan_score, dynamic_raw_indicators.urlscan_score),
    urlscan_malicious = COALESCE(EXCLUDED.urlscan_malicious, dynamic_raw_indicators.urlscan_malicious),
    cloudflare_urlscan_checked = COALESCE(EXCLUDED.cloudflare_urlscan_checked, dynamic_raw_indicators.cloudflare_urlscan_checked),
    cloudflare_urlscan_score = COALESCE(EXCLUDED.cloudflare_urlscan_score, dynamic_raw_indicators.cloudflare_urlscan_score),
    cloudflare_urlscan_malicious = COALESCE(EXCLUDED.cloudflare_urlscan_malicious, dynamic_raw_indicators.cloudflare_urlscan_malicious),
    cloudflare_urlscan_categories = COALESCE(EXCLUDED.cloudflare_urlscan_categories, dynamic_raw_indicators.cloudflare_urlscan_categories),
    cloudflare_urlscan_verdict = COALESCE(EXCLUDED.cloudflare_urlscan_verdict, dynamic_raw_indicators.cloudflare_urlscan_verdict),
    whitelisted = COALESCE(EXCLUDED.whitelisted, dynamic_raw_indicators.whitelisted),
    whitelist_source = COALESCE(EXCLUDED.whitelist_source, dynamic_raw_indicators.whitelist_source);
END;
$$;
