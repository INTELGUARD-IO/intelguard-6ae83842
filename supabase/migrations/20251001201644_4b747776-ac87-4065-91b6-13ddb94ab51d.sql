-- Create ingest_sources table for dynamic source management
CREATE TABLE public.ingest_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_success TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  last_run TIMESTAMP WITH TIME ZONE,
  indicators_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingest_sources ENABLE ROW LEVEL SECURITY;

-- Policy: tenant members can view sources
CREATE POLICY "ingest_sources_select"
ON public.ingest_sources
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
  )
);

-- Policy: tenant members can manage sources
CREATE POLICY "ingest_sources_all"
ON public.ingest_sources
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.user_id = auth.uid()
  )
);

-- Insert default sources
INSERT INTO public.ingest_sources (url, kind, name, description, enabled) VALUES
-- IPv4 Sources
('https://rules.emergingthreats.net/blockrules/compromised-ips.txt', 'ipv4', 'EmergingThreats', 'Compromised IPs from EmergingThreats', true),
('https://check.torproject.org/torbulkexitlist', 'ipv4', 'Tor Exit Nodes', 'Tor network exit nodes', true),
('https://cinsscore.com/list/ci-badguys.txt', 'ipv4', 'CINS Score', 'CINS Army badguys list', true),
('https://lists.blocklist.de/lists/all.txt', 'ipv4', 'Blocklist.de', 'All attacks tracked by blocklist.de', true),
('https://isc.sans.edu/block.txt', 'ipv4', 'SANS ISC', 'SANS Internet Storm Center block list', true),
('https://raw.githubusercontent.com/borestad/blocklist-abuseipdb/main/abuseipdb-s100-30d.ipv4', 'ipv4', 'AbuseIPDB', 'High confidence abuse IPs', false),
('https://binarydefense.com/banlist.txt', 'ipv4', 'Binary Defense', 'Binary Defense banlist', true),
('https://dataplane.org/signals/sshclient.txt', 'ipv4', 'Dataplane SSH', 'SSH brute force attempts', true),
('https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt', 'ipv4', 'IPsum', 'Malicious IP aggregator', false),
('https://danger.rulez.sk/projects/bruteforceblocker/blist.php', 'ipv4', 'BruteForceBlocker', 'SSH brute force IPs', true),
('https://blocklist.greensnow.co/greensnow.txt', 'ipv4', 'GreenSnow', 'GreenSnow blocklist', true),
('https://sblam.com/blacklist.txt', 'ipv4', 'SBLAM', 'SBLAM comment spam IPs', true),

-- Domain Sources
('https://urlhaus.abuse.ch/downloads/text/', 'domain', 'URLhaus Text', 'Malicious URLs from URLhaus', true),
('https://urlhaus.abuse.ch/downloads/hostfile/', 'domain', 'URLhaus Hostfile', 'URLhaus in hostfile format', true),
('https://threatfox.abuse.ch/downloads/hostfile/', 'domain', 'ThreatFox', 'ThreatFox malware domains', true),
('https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf', 'domain', 'Disposable Emails', 'Disposable email domains', true),
('https://raw.githubusercontent.com/chadmayfield/my-pihole-blocklists/master/lists/pi_blocklist_porn_top1m.list', 'domain', 'PiHole Porn', 'Adult content domains', true);

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.ingest_sources
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
