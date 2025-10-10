-- ============================================
-- STEP 1: Create enrichment_summary VIEW
-- ============================================
-- Unified view combining data from all enrichment sources
CREATE OR REPLACE VIEW enrichment_summary AS
SELECT 
  COALESCE(r.indicator, b.indicator, c.indicator) as indicator,
  COALESCE(r.kind, b.kind, c.kind) as kind,
  -- Country (priority: RIPEStat > BGPView > Cloudflare)
  COALESCE(r.country_code, b.country_code, c.country_code) as country,
  -- ASN (priority: RIPEStat > BGPView > Cloudflare)
  COALESCE(r.asn::text, b.asn::text, c.asn::text) as asn,
  -- ASN Name
  COALESCE(r.asn_holder, b.asn_name, c.asn_name) as asn_name,
  -- Most recent check timestamp
  GREATEST(
    COALESCE(r.checked_at, '1970-01-01'::timestamp),
    COALESCE(b.checked_at, '1970-01-01'::timestamp),
    COALESCE(c.checked_at, '1970-01-01'::timestamp)
  ) as last_enriched
FROM ripestat_enrichment r
FULL OUTER JOIN bgpview_enrichment b 
  ON r.indicator = b.indicator AND r.kind = b.kind
FULL OUTER JOIN cloudflare_radar_enrichment c 
  ON COALESCE(r.indicator, b.indicator) = c.indicator 
  AND COALESCE(r.kind, b.kind) = c.kind
WHERE COALESCE(r.country_code, b.country_code, c.country_code) IS NOT NULL
   OR COALESCE(r.asn, b.asn, c.asn) IS NOT NULL;

-- ============================================
-- STEP 2: Add cron job for domain resolver
-- ============================================
SELECT cron.schedule(
  'domain-resolver-hourly',
  '0 * * * *', -- Every hour
  'SELECT _call_edge(''domain-resolver-validator'')'
);