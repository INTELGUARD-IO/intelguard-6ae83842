-- Migration: Add 18 drb-ra C2IntelFeeds sources with daily sync
-- Description: Implements IP and Domain C2 feeds from drb-ra/C2IntelFeeds repository

-- Insert 18 sources into ingest_sources table
INSERT INTO public.ingest_sources (name, url, kind, description, enabled, priority) VALUES
  -- Grupo A: IP C2 (Priority 95)
  (
    'DRB-RA - IP C2 Full',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s.csv',
    'ipv4',
    'Full historical C2 IP addresses from drb-ra threat intelligence',
    true,
    95
  ),
  (
    'DRB-RA - IP C2 30day',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s-30day.csv',
    'ipv4',
    'C2 IP addresses from last 30 days (drb-ra)',
    true,
    95
  ),
  
  -- Grupo B: IP:Port C2 (Priority 90)
  (
    'DRB-RA - IPPort C2 Full',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPPortC2s.csv',
    'ipv4',
    'Full historical C2 IP:Port combinations (IP extracted)',
    true,
    90
  ),
  (
    'DRB-RA - IPPort C2 30day',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPPortC2s-30day.csv',
    'ipv4',
    'C2 IP:Port from last 30 days (IP extracted)',
    true,
    90
  ),
  
  -- Grupo C: Domini C2 (Priority 95)
  (
    'DRB-RA - Domain C2 Full',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2s.csv',
    'domain',
    'Full historical C2 domains from drb-ra',
    true,
    95
  ),
  (
    'DRB-RA - Domain C2 30day',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2s-30day.csv',
    'domain',
    'C2 domains from last 30 days',
    true,
    95
  ),
  (
    'DRB-RA - Domain C2 Filtered',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2s-filter-abused.csv',
    'domain',
    'Full historical C2 domains (filtered: no CDN/domain fronting)',
    true,
    95
  ),
  (
    'DRB-RA - Domain C2 30day Filtered',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2s-30day-filter-abused.csv',
    'domain',
    'C2 domains last 30 days (filtered: no CDN/domain fronting)',
    true,
    95
  ),
  
  -- Grupo D: DNS C2 Domini (Priority 90)
  (
    'DRB-RA - DNS C2 Domains Full',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/DNSC2Domains.csv',
    'domain',
    'Full historical DNS C2 domains',
    true,
    90
  ),
  (
    'DRB-RA - DNS C2 Domains 30day',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/DNSC2Domains-30day.csv',
    'domain',
    'DNS C2 domains from last 30 days',
    true,
    90
  ),
  
  -- Grupo E: Domini C2 con URL (Priority 92)
  (
    'DRB-RA - Domain C2 URL Full',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURL.csv',
    'domain',
    'Full historical C2 domains with URL context (hostname extracted)',
    true,
    92
  ),
  (
    'DRB-RA - Domain C2 URL 30day',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURL-30day.csv',
    'domain',
    'C2 domains with URL from last 30 days (hostname extracted)',
    true,
    92
  ),
  (
    'DRB-RA - Domain C2 URL Filtered',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURL-filter-abused.csv',
    'domain',
    'C2 domains with URL full history (filtered, hostname extracted)',
    true,
    92
  ),
  (
    'DRB-RA - Domain C2 URL 30day Filtered',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURL-30day-filter-abused.csv',
    'domain',
    'C2 domains with URL last 30 days (filtered, hostname extracted)',
    true,
    92
  ),
  
  -- Grupo F: Domini C2 con URL+IP (Priority 93)
  (
    'DRB-RA - Domain C2 URL IP Full',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURLwithIP.csv',
    'domain',
    'Full historical C2 domains with URL and IP context (hostname extracted)',
    true,
    93
  ),
  (
    'DRB-RA - Domain C2 URL IP 30day',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURLwithIP-30day.csv',
    'domain',
    'C2 domains with URL and IP from last 30 days (hostname extracted)',
    true,
    93
  ),
  (
    'DRB-RA - Domain C2 URL IP Filtered',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURLwithIP-filter-abused.csv',
    'domain',
    'C2 domains with URL and IP full history (filtered, hostname extracted)',
    true,
    93
  ),
  (
    'DRB-RA - Domain C2 URL IP 30day Filtered',
    'https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/domainC2swithURLwithIP-30day-filter-abused.csv',
    'domain',
    'C2 domains with URL and IP last 30 days (filtered, hostname extracted)',
    true,
    93
  )
ON CONFLICT (name) DO UPDATE SET
  url = EXCLUDED.url,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- Schedule daily cron job at 03:00 UTC
SELECT cron.schedule(
  'drb-ra-c2intel-daily-sync',
  '0 3 * * *',
  'SELECT _call_edge(''drb-ra-c2intel-sync'')'
);

-- Trigger immediate first ingest
SELECT net.http_post(
  url := 'https://qmsidlazqaqwcptpsjqh.functions.supabase.co/drb-ra-c2intel-sync',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2lkbGF6cWFxd2NwdHBzanFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMwMzE1NywiZXhwIjoyMDc0ODc5MTU3fQ.WKzTXRt8vhOlpCqLfM_bOKIQ1vJZKaKdECVSqW-8T3Y',
    'x-cron-secret', 'INTELGUARD_Cr0N2025@2025'
  ),
  body := jsonb_build_object(
    'timestamp', now(),
    'triggered_by', 'initial_migration'
  )
);