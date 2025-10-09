-- ============================================================================
-- FASE 1: EMERGENCY POPULATION - Domini da dynamic_raw_indicators
-- ============================================================================
-- Popola validated_indicators con domini che hanno già validazione >= 70%
INSERT INTO public.validated_indicators (
  indicator,
  kind,
  confidence,
  threat_type,
  country,
  asn,
  last_validated
)
SELECT DISTINCT ON (dri.indicator, dri.kind)
  dri.indicator,
  dri.kind,
  dri.confidence,
  classify_threat_type(dri) as threat_type,
  COALESCE(
    ripe.country_code,
    bgp.country_code,
    cf.country_code
  ) as country,
  COALESCE(
    ripe.asn::text,
    bgp.asn::text,
    cf.asn::text
  ) as asn,
  dri.last_validated
FROM dynamic_raw_indicators dri
LEFT JOIN ripestat_enrichment ripe ON ripe.indicator = dri.indicator AND ripe.kind = dri.kind
LEFT JOIN bgpview_enrichment bgp ON bgp.indicator = dri.indicator AND bgp.kind = dri.kind
LEFT JOIN cloudflare_radar_enrichment cf ON cf.indicator = dri.indicator AND cf.kind = dri.kind
WHERE 
  dri.kind = 'domain'
  AND dri.whitelisted = false
  AND dri.confidence >= 70
  AND (
    (dri.safebrowsing_checked AND dri.safebrowsing_verdict IN ('SOCIAL_ENGINEERING', 'MALWARE', 'UNWANTED_SOFTWARE'))
    OR (dri.urlscan_checked AND dri.urlscan_malicious = true)
    OR (dri.cloudflare_urlscan_checked AND dri.cloudflare_urlscan_malicious = true)
    OR (dri.virustotal_checked AND dri.virustotal_malicious = true AND dri.virustotal_score >= 5)
  )
ON CONFLICT (indicator, kind) DO NOTHING;

-- ============================================================================
-- FASE 2: TRIGGER SNAPSHOT CACHE
-- ============================================================================
-- Forza snapshot immediato per popolare validated_indicators_cache
SELECT snapshot_validated_indicators_to_cache();

-- ============================================================================
-- FASE 4: TRIGGER INTELLIGENT VALIDATOR
-- ============================================================================
-- Esegui subito intelligent-validator per promuovere altri domini validati
SELECT net.http_post(
  url := 'https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/intelligent-validator',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y'
  ),
  body := jsonb_build_object(
    'timestamp', now(),
    'triggered_by', 'manual-emergency'
  )
) as request_id;