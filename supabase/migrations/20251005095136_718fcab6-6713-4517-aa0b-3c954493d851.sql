-- Create enhanced enrichment_summary view with robust COALESCE logic
CREATE OR REPLACE VIEW enrichment_summary AS
SELECT DISTINCT ON (indicator, kind)
  indicator,
  kind,
  COALESCE(
    otx.country,
    bgp.country_code,
    ripe.country_code,
    cf.country_code
  ) AS country,
  COALESCE(
    otx.asn,
    CASE WHEN bgp.asn IS NOT NULL THEN 'AS' || bgp.asn ELSE NULL END,
    CASE WHEN ripe.asn IS NOT NULL THEN 'AS' || ripe.asn ELSE NULL END,
    CASE WHEN cf.asn IS NOT NULL THEN 'AS' || cf.asn ELSE NULL END
  ) AS asn,
  COALESCE(
    bgp.asn_name,
    ripe.asn_holder,
    cf.asn_name
  ) AS asn_name
FROM (
  SELECT DISTINCT indicator, kind FROM dynamic_raw_indicators
  UNION
  SELECT DISTINCT indicator, kind FROM validated_indicators
) AS indicators
LEFT JOIN otx_enrichment otx USING (indicator, kind)
LEFT JOIN bgpview_enrichment bgp USING (indicator, kind)
LEFT JOIN ripestat_enrichment ripe USING (indicator, kind)
LEFT JOIN cloudflare_radar_enrichment cf USING (indicator, kind)
WHERE COALESCE(
  otx.country, bgp.country_code, ripe.country_code, cf.country_code
) IS NOT NULL
OR COALESCE(
  otx.asn,
  CASE WHEN bgp.asn IS NOT NULL THEN 'AS' || bgp.asn ELSE NULL END,
  CASE WHEN ripe.asn IS NOT NULL THEN 'AS' || ripe.asn ELSE NULL END,
  CASE WHEN cf.asn IS NOT NULL THEN 'AS' || cf.asn ELSE NULL END
) IS NOT NULL;
