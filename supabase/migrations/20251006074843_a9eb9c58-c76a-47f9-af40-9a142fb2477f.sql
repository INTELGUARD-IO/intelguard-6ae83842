-- ============================================
-- FASE 1: Convertire validated_indicators da VIEW a TABLE
-- ============================================

-- 1. Drop VIEW esistente
DROP VIEW IF EXISTS public.validated_indicators;

-- 2. Creare TABLE con struttura corretta
CREATE TABLE public.validated_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator text NOT NULL,
  kind text NOT NULL,
  confidence numeric NOT NULL,
  threat_type text,
  country text,
  asn text,
  last_validated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(indicator, kind)
);

-- 3. Indici per performance
CREATE INDEX idx_validated_indicators_kind ON validated_indicators(kind);
CREATE INDEX idx_validated_indicators_confidence ON validated_indicators(confidence DESC);
CREATE INDEX idx_validated_indicators_threat_type ON validated_indicators(threat_type);
CREATE INDEX idx_validated_indicators_last_validated ON validated_indicators(last_validated DESC);

-- 4. Enable RLS
ALTER TABLE public.validated_indicators ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "tenant_members_can_view_validated_indicators"
  ON validated_indicators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "super_admin_full_access_validated_indicators"
  ON validated_indicators FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- ============================================
-- FASE 2: Popolamento Iniziale con Logica Consensus
-- ============================================

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
  dri.whitelisted = false
  AND dri.confidence >= 70
  AND (
    -- DOMINI: almeno 1 validator malicious
    (dri.kind = 'domain' AND (
      (dri.safebrowsing_checked AND dri.safebrowsing_verdict IN ('SOCIAL_ENGINEERING', 'MALWARE', 'UNWANTED_SOFTWARE'))
      OR (dri.urlscan_checked AND dri.urlscan_malicious = true)
      OR (dri.cloudflare_urlscan_checked AND dri.cloudflare_urlscan_malicious = true)
      OR (dri.virustotal_checked AND dri.virustotal_malicious = true AND dri.virustotal_score >= 5)
    ))
    OR
    -- IPv4: almeno 2 validators malicious
    (dri.kind = 'ipv4' AND (
      (
        CASE WHEN (dri.abuseipdb_checked AND dri.abuseipdb_in_blacklist = true) THEN 1 ELSE 0 END +
        CASE WHEN (dri.honeydb_checked AND dri.honeydb_in_blacklist = true) THEN 1 ELSE 0 END +
        CASE WHEN (dri.abuse_ch_checked AND dri.abuse_ch_is_fp = false) THEN 1 ELSE 0 END +
        CASE WHEN (dri.virustotal_checked AND dri.virustotal_malicious = true AND dri.virustotal_score >= 5) THEN 1 ELSE 0 END +
        CASE WHEN (dri.censys_checked AND dri.censys_malicious = true) THEN 1 ELSE 0 END +
        CASE WHEN (dri.otx_checked AND dri.otx_verdict = 'malicious') THEN 1 ELSE 0 END
      ) >= 2
    ))
  )
ON CONFLICT (indicator, kind) DO NOTHING;

-- ============================================
-- FASE 4: Accelerare Validatori Domini
-- ============================================

-- Update google-safebrowsing-validator: 12h → 4h
SELECT cron.unschedule('google-safebrowsing-validator');
SELECT cron.schedule(
  'google-safebrowsing-validator',
  '0 */4 * * *',
  $$SELECT _call_edge('google-safebrowsing-validator')$$
);

-- NEW: urlscan-validator ogni 6h (invece di 24h precedente)
SELECT cron.schedule(
  'invoke-urlscan-validator-6h',
  '0 */6 * * *',
  $$SELECT _call_edge('urlscan-validator')$$
);