DROP FUNCTION IF EXISTS public.get_paginated_indicators(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_paginated_indicators(
  p_kind text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  indicator text,
  kind text,
  confidence numeric,
  threat_type text,
  country text,
  asn text,
  asn_name text,
  sources text[],
  source_count integer,
  last_validated timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM validated_indicators v
  WHERE (p_kind IS NULL OR v.kind = p_kind);
  
  RETURN QUERY
  SELECT 
    v.indicator,
    v.kind,
    v.confidence,
    v.threat_type,
    COALESCE(e_ipapi.country_code, e_ripe.country_code, e_bgp.country_code, e_cf.country_code) as country,
    COALESCE(e_ipapi.as_number::TEXT, e_ripe.asn::TEXT, e_bgp.asn::TEXT, e_cf.asn::TEXT) as asn,
    COALESCE(e_ipapi.as_name, e_ripe.asn_holder, e_bgp.asn_name, e_cf.asn_name) as asn_name,
    dr.sources,
    dr.source_count,
    v.last_validated,
    v_total_count as total_count
  FROM validated_indicators v
  LEFT JOIN ip_api_enrichment e_ipapi ON e_ipapi.indicator = v.indicator AND e_ipapi.kind = v.kind
  LEFT JOIN ripestat_enrichment e_ripe ON e_ripe.indicator = v.indicator AND e_ripe.kind = v.kind
  LEFT JOIN bgpview_enrichment e_bgp ON e_bgp.indicator = v.indicator AND e_bgp.kind = v.kind
  LEFT JOIN cloudflare_radar_enrichment e_cf ON e_cf.indicator = v.indicator AND e_cf.kind = v.kind
  LEFT JOIN dynamic_raw_indicators dr ON dr.indicator = v.indicator AND dr.kind = v.kind
  WHERE (p_kind IS NULL OR v.kind = p_kind)
  ORDER BY v.last_validated DESC
  LIMIT p_limit
  OFFSET (p_page - 1) * p_limit;
END;
$function$;