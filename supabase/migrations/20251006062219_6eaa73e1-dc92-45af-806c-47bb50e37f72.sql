-- FASE 1: Ricreare VIEW validated_indicators con soglia confidence >= 70

-- Eliminare la TABLE corrotta se esiste (era una TABLE, non una VIEW)
DROP TABLE IF EXISTS public.validated_indicators CASCADE;

-- Ricreare come VIEW con soglia 70%
-- Le colonne country e asn verranno arricchite tramite JOIN nelle query
CREATE VIEW public.validated_indicators AS
SELECT 
  indicator,
  kind,
  confidence,
  classify_threat_type(dynamic_raw_indicators) as threat_type,
  last_validated
FROM dynamic_raw_indicators
WHERE confidence >= 70 
  AND whitelisted = false;

-- Aggiungere indici per performance
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_validated 
  ON dynamic_raw_indicators(kind, confidence DESC, last_validated DESC) 
  WHERE confidence >= 70 AND whitelisted = false;

CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_kind_confidence 
  ON dynamic_raw_indicators(kind) 
  WHERE confidence >= 70 AND whitelisted = false;

-- FASE 2: Modificare RPC get_paginated_indicators per restituire total_count
DROP FUNCTION IF EXISTS public.get_paginated_indicators(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_paginated_indicators(
  p_kind TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  indicator TEXT,
  kind TEXT,
  confidence NUMERIC,
  threat_type TEXT,
  country TEXT,
  asn TEXT,
  last_validated TIMESTAMPTZ,
  total_count BIGINT
) 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Calcolare il conteggio totale
  SELECT COUNT(*) INTO v_total_count
  FROM validated_indicators v
  WHERE (p_kind IS NULL OR v.kind = p_kind);
  
  -- Restituire i record paginati con enrichment e total_count
  RETURN QUERY
  SELECT 
    v.indicator,
    v.kind,
    v.confidence,
    v.threat_type,
    COALESCE(
      e_ripe.country_code,
      e_bgp.country_code,
      e_cf.country_code
    ) as country,
    COALESCE(
      e_ripe.asn::TEXT,
      e_bgp.asn::TEXT,
      e_cf.asn::TEXT
    ) as asn,
    v.last_validated,
    v_total_count as total_count
  FROM validated_indicators v
  LEFT JOIN ripestat_enrichment e_ripe 
    ON e_ripe.indicator = v.indicator AND e_ripe.kind = v.kind
  LEFT JOIN bgpview_enrichment e_bgp 
    ON e_bgp.indicator = v.indicator AND e_bgp.kind = v.kind
  LEFT JOIN cloudflare_radar_enrichment e_cf 
    ON e_cf.indicator = v.indicator AND e_cf.kind = v.kind
  WHERE (p_kind IS NULL OR v.kind = p_kind)
  ORDER BY v.last_validated DESC
  LIMIT p_limit
  OFFSET (p_page - 1) * p_limit;
END;
$$;
