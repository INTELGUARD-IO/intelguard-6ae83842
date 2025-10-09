-- Step 1: Add threat_type column to validated_indicators
ALTER TABLE public.validated_indicators 
ADD COLUMN IF NOT EXISTS threat_type TEXT;

-- Step 2: Create enrichment_summary view (aggregates country/ASN from multiple sources)
CREATE OR REPLACE VIEW public.enrichment_summary AS
SELECT 
  dri.indicator,
  dri.kind,
  -- Priority: RIPEstat > Cloudflare Radar > BGPView
  COALESCE(
    re.country_code,
    cre.country_code,
    bge.country_code
  ) as country,
  COALESCE(
    re.asn::text,
    cre.asn::text,
    bge.asn::text
  ) as asn,
  COALESCE(
    re.asn_holder,
    cre.asn_name,
    bge.asn_name
  ) as asn_name
FROM public.dynamic_raw_indicators dri
LEFT JOIN public.ripestat_enrichment re 
  ON re.indicator = dri.indicator AND re.kind = dri.kind
LEFT JOIN public.cloudflare_radar_enrichment cre 
  ON cre.indicator = dri.indicator AND cre.kind = dri.kind
LEFT JOIN public.bgpview_enrichment bge 
  ON bge.indicator = dri.indicator AND bge.kind = dri.kind;

-- Step 3: Create function to classify threat type based on validator results
CREATE OR REPLACE FUNCTION public.classify_threat_type(indicator_row public.dynamic_raw_indicators)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threat_classification TEXT := 'unknown';
BEGIN
  -- Botnet/C2
  IF indicator_row.honeydb_in_blacklist = true 
     OR indicator_row.abuse_ch_checked = true 
     OR (indicator_row.virustotal_malicious = true AND indicator_row.virustotal_score > 5) THEN
    threat_classification := 'botnet';
  
  -- Malware distribution
  ELSIF indicator_row.urlscan_malicious = true 
        OR indicator_row.cloudflare_urlscan_malicious = true 
        OR (indicator_row.safebrowsing_verdict IN ('MALWARE', 'UNWANTED_SOFTWARE')) THEN
    threat_classification := 'malware';
  
  -- Phishing
  ELSIF indicator_row.safebrowsing_verdict = 'SOCIAL_ENGINEERING' 
        OR (indicator_row.cloudflare_urlscan_categories IS NOT NULL 
            AND 'phishing' = ANY(indicator_row.cloudflare_urlscan_categories)) THEN
    threat_classification := 'phishing';
  
  -- Proxy/VPN abuse
  ELSIF indicator_row.neutrinoapi_is_proxy = true 
        OR indicator_row.neutrinoapi_is_vpn = true THEN
    threat_classification := 'proxy_abuse';
  
  -- Spam source
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
$$;

-- Step 4: Update validated_indicators with threat_type from dynamic_raw_indicators
UPDATE public.validated_indicators vi
SET threat_type = public.classify_threat_type(dri.*)
FROM public.dynamic_raw_indicators dri
WHERE dri.indicator = vi.indicator 
  AND dri.kind = vi.kind
  AND vi.threat_type IS NULL;

-- Step 5: Create public threat view (NO VENDOR NAMES)
CREATE OR REPLACE VIEW public.public_threat_indicators AS
SELECT 
  vi.indicator,
  vi.kind,
  vi.confidence,
  vi.threat_type,
  es.country,
  es.asn,
  es.asn_name,
  vi.last_validated as last_seen,
  dri.first_validated as first_seen,
  dri.source_count as sources_count,
  -- Aggregated threat score (0-100)
  CASE 
    WHEN vi.confidence >= 90 THEN 'critical'
    WHEN vi.confidence >= 70 THEN 'high'
    WHEN vi.confidence >= 50 THEN 'medium'
    ELSE 'low'
  END as severity
FROM public.validated_indicators vi
JOIN public.dynamic_raw_indicators dri 
  ON dri.indicator = vi.indicator AND dri.kind = vi.kind
LEFT JOIN public.enrichment_summary es 
  ON es.indicator = vi.indicator AND es.kind = vi.kind
WHERE vi.confidence >= 60  -- Only show high-confidence threats
  AND dri.whitelisted = false;

-- Step 6: Enable RLS on the view (allow authenticated users to view)
ALTER VIEW public.public_threat_indicators SET (security_invoker = on);

-- Step 7: Grant access to authenticated users
GRANT SELECT ON public.enrichment_summary TO authenticated;
GRANT SELECT ON public.public_threat_indicators TO authenticated;

-- Step 8: Create RLS policy for public_threat_indicators
-- Note: Views don't have RLS directly, but we control access via the underlying tables
-- The view will respect the RLS policies of the base tables

COMMENT ON VIEW public.enrichment_summary IS 'Aggregated enrichment data from multiple sources (RIPEstat, Cloudflare, BGPView)';
COMMENT ON VIEW public.public_threat_indicators IS 'Public-facing threat feed without vendor-specific details';
COMMENT ON FUNCTION public.classify_threat_type IS 'Classifies threat type based on validator results';