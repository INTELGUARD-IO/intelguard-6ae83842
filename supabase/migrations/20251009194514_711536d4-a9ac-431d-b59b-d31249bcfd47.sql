-- =====================================================
-- FIX: Add UNIQUE constraint and cleanup sources
-- =====================================================

-- Step 1: Remove duplicate names (keep only the first occurrence)
DELETE FROM ingest_sources a
USING ingest_sources b
WHERE a.id > b.id 
  AND a.name = b.name;

-- Step 2: Add UNIQUE constraint on name column
ALTER TABLE ingest_sources
ADD CONSTRAINT ingest_sources_name_unique UNIQUE (name);

-- Step 3: Delete ALL existing sources
DELETE FROM ingest_sources;

-- Step 4: Insert ONLY the 32 active feeds
INSERT INTO ingest_sources (name, url, kind, enabled, description, priority) VALUES
-- Abuse.ch (2)
('Abuse.ch Feodo Tracker', 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt', 'ipv4', true, 'Feodo/Emotet/Dridex C2 servers', 90),
('Abuse.ch URLhaus', 'https://urlhaus.abuse.ch/downloads/text/', 'domain', true, 'Malicious URLs database', 95),

-- Binary Defense & CI Army (2)
('Binary Defense Banlist', 'https://binarydefense.com/banlist.txt', 'ipv4', true, 'Artillery Threat Intelligence Feed', 85),
('CI Army Badguys', 'https://cinsscore.com/list/ci-badguys.txt', 'ipv4', true, 'CI Army malicious IPs ~15,000', 85),

-- Blocklist.de (8)
('Blocklist.de Apache', 'https://lists.blocklist.de/lists/apache.txt', 'ipv4', true, 'Apache attack sources', 70),
('Blocklist.de Bots', 'https://lists.blocklist.de/lists/bots.txt', 'ipv4', true, 'Bot attack sources', 70),
('Blocklist.de FTP', 'https://lists.blocklist.de/lists/ftp.txt', 'ipv4', true, 'FTP attack sources', 70),
('Blocklist.de IMAP', 'https://lists.blocklist.de/lists/imap.txt', 'ipv4', true, 'IMAP attack sources', 70),
('Blocklist.de Mail', 'https://lists.blocklist.de/lists/mail.txt', 'ipv4', true, 'Mail attack sources', 70),
('Blocklist.de SIP', 'https://lists.blocklist.de/lists/sip.txt', 'ipv4', true, 'SIP attack sources', 70),
('Blocklist.de SSH', 'https://lists.blocklist.de/lists/ssh.txt', 'ipv4', true, 'SSH attack sources', 75),
('Blocklist.de Strong IPs', 'https://lists.blocklist.de/lists/strongips.txt', 'ipv4', true, 'Strong malicious IPs', 80),

-- Emerging Threats (2)
('Emerging Threats Compromised', 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt', 'ipv4', true, 'Compromised hosts', 85),
('Emerging Threats DShield', 'http://rules.emergingthreats.net/blockrules/dshieldblock.txt', 'ipv4', true, 'DShield top attackers', 85),

-- TOR Networks (3)
('TOR Exit Nodes', 'https://check.torproject.org/torbulkexitlist', 'ipv4', true, 'TOR exit nodes', 60),
('TOR Status Exit List', 'https://torstatus.blutmagie.de/ip_list_exit.php/Tor_ip_list_EXIT.csv', 'ipv4', true, 'TOR exit nodes from BlutMagie', 60),
('Dan.me.uk TOR List', 'https://dan.me.uk/torlist/?exit', 'ipv4', true, 'TOR exit addresses', 60),

-- Phishing & Malware (1)
('OpenPhish', 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt', 'domain', true, 'Phishing domains database', 95),

-- Other Active Feeds (13)
('AlienVault Reputation', 'https://reputation.alienvault.com/reputation.generic', 'ipv4', true, 'AlienVault threat reputation', 90),
('AbuseIPDB Top 100', 'https://raw.githubusercontent.com/borestad/blocklist-abuseipdb/main/abuseipdb-s100-30d.ipv4', 'ipv4', true, 'AbuseIPDB top abusers', 85),
('Darklist.de', 'https://www.darklist.de/raw.php', 'ipv4', true, 'Darklist malicious IPs', 70),
('Danger Rulez BruteForce', 'https://danger.rulez.sk/projects/bruteforceblocker/blist.php', 'ipv4', true, 'Brute force attackers', 75),
('Gofferje SIP Blocklist', 'http://www.gofferje.net/sipblocklist.txt', 'ipv4', true, 'SIP/VoIP attack sources', 60),
('GPF Comics Blocklist', 'http://www.gpfcomics.com/blocklist.txt', 'ipv4', true, 'SSH attackers', 60),
('Graphic Line Blacklist', 'http://graphiclineweb.com/blacklist.txt', 'ipv4', true, 'Web attack sources', 50),
('Hagezi DNS Blocklist', 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt', 'domain', true, 'DNS-based threat domains', 80),
('MyIP.ms Blacklist', 'http://myip.ms/files/blacklist/general/latest_blacklist.txt', 'ipv4', true, 'General IP blacklist', 60),
('SBLam Blacklist', 'http://sblam.com/blacklist.txt', 'ipv4', true, 'Spam sources', 65),
('URLAbuse', 'https://urlabuse.com/public/data/data.txt', 'domain', true, 'Abusive URL domains', 75),
('VXVault', 'http://vxvault.net/VXVault.txt', 'domain', true, 'Malware domains', 80),
('Yoyo Ad Servers', 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=ipset&showintro=0', 'ipv4', true, 'Ad server IPs', 40);

-- Step 5: Insert the 6 PAUSED feeds (require special implementation)
INSERT INTO ingest_sources (name, url, kind, enabled, description, priority, last_error) VALUES
('TOR Exit Addresses', 'https://check.torproject.org/exit-addresses', 'ipv4', false, 'TOR exit addresses list', 60, 'Paused: Requires HTML parsing'),
('BotScout Last Caught', 'https://botscout.com/last_caught_cache.htm', 'ipv4', false, 'BotScout recent bots', 70, 'Paused: Requires HTML table parsing'),
('Cybercrime Tracker', 'http://cybercrime-tracker.net/all.php', 'ipv4', false, 'Cybercrime IPs and domains', 75, 'Paused: Requires download to storage and HTML parsing'),
('DShield Top IPs XML', 'http://www.dshield.org/ipsouts.xml', 'ipv4', false, 'DShield top sources', 80, 'Paused: Requires XML parser implementation'),
('ISC SANS API', 'https://isc.sans.edu/api/sources/attacks/10000/', 'ipv4', false, 'ISC SANS attack sources', 85, 'Paused: Requires XML parser implementation'),
('PhishTank CSV', 'http://data.phishtank.com/data/online-valid.csv', 'domain', false, 'PhishTank phishing domains', 90, 'Paused: Requires CSV download and cleanup');