-- Initialize feed sources for INTELGUARD
-- This script populates the feed_sources table with all threat intelligence feeds

-- Clear existing feed sources (optional, comment out if you want to keep existing data)
-- DELETE FROM feed_sources;

-- Insert feed sources
INSERT INTO feed_sources (name, url, feed_type, format, is_active, fetch_interval_seconds, description) VALUES
-- Abuse.ch Feeds
('URLhaus Recent', 'https://urlhaus.abuse.ch/downloads/csv_recent/', 'mixed', 'csv', true, 300, 'Recent malicious URLs from URLhaus'),
('SSL Blacklist', 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv', 'ip', 'csv', true, 3600, 'SSL certificate blacklist'),
('Feodo Tracker', 'https://feodotracker.abuse.ch/blocklist/?download=feodo', 'ip', 'text', true, 3600, 'Feodo/Emotet C2 servers'),
('Feodo BadIPs', 'https://feodotracker.abuse.ch/blocklist/?download=badips', 'ip', 'text', true, 3600, 'Feodo bad IPs'),
('Zeus Tracker IPs', 'https://zeustracker.abuse.ch/blocklist.php?download=ipblocklist', 'ip', 'text', true, 3600, 'Zeus botnet IPs'),
('Zeus Tracker BadIPs', 'https://zeustracker.abuse.ch/blocklist.php?download=badips', 'ip', 'text', true, 3600, 'Zeus bad IPs'),

-- Emerging Threats
('ET Compromised IPs', 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt', 'ip', 'text', true, 1800, 'Emerging Threats compromised IPs'),
('ET Block IPs', 'http://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt', 'ip', 'text', true, 1800, 'Emerging Threats block IPs'),
('ET DShield Block', 'http://rules.emergingthreats.net/blockrules/dshieldblock.txt', 'ip', 'text', true, 1800, 'DShield blocklist'),
('ET Spamhaus Drop', 'http://rules.emergingthreats.net/blockrules/spamhausdrop.txt', 'ip', 'text', true, 1800, 'Spamhaus DROP list'),
('ET Tor Nodes', 'http://rules.emergingthreats.net/blockrules/emerging-tor.txt', 'ip', 'text', true, 3600, 'Tor exit nodes'),

-- Tor Project
('Tor Exit List', 'https://www.dan.me.uk/torlist/?exit', 'ip', 'text', true, 3600, 'Tor exit node list'),
('Tor Bulk Exit List', 'https://check.torproject.org/torbulkexitlist', 'ip', 'text', true, 3600, 'Tor bulk exit list'),
('Tor Exit Addresses', 'https://check.torproject.org/exit-addresses', 'ip', 'text', true, 3600, 'Tor exit addresses'),
('Tor IP List', 'https://torstatus.blutmagie.de/ip_list_exit.php/Tor_ip_list_EXIT.csv', 'ip', 'csv', true, 3600, 'Tor IP list CSV'),

-- Blocklist.de
('Blocklist.de All', 'http://lists.blocklist.de/lists/all.txt', 'ip', 'text', true, 1800, 'All blocklist.de lists combined'),
('Blocklist.de SIP', 'https://lists.blocklist.de/lists/sip.txt', 'ip', 'text', true, 1800, 'SIP attack IPs'),
('Blocklist.de Bruteforce', 'https://lists.blocklist.de/lists/bruteforcelogin.txt', 'ip', 'text', true, 1800, 'Bruteforce login attempts'),
('Blocklist.de Apache', 'http://lists.blocklist.de/lists/apache.txt', 'ip', 'text', true, 1800, 'Apache attack IPs'),
('Blocklist.de Bots', 'http://lists.blocklist.de/lists/bots.txt', 'ip', 'text', true, 1800, 'Bot IPs'),
('Blocklist.de FTP', 'http://lists.blocklist.de/lists/ftp.txt', 'ip', 'text', true, 1800, 'FTP attack IPs'),
('Blocklist.de IMAP', 'http://lists.blocklist.de/lists/imap.txt', 'ip', 'text', true, 1800, 'IMAP attack IPs'),
('Blocklist.de Mail', 'http://lists.blocklist.de/lists/mail.txt', 'ip', 'text', true, 1800, 'Mail attack IPs'),
('Blocklist.de SSH', 'http://lists.blocklist.de/lists/ssh.txt', 'ip', 'text', true, 1800, 'SSH attack IPs'),
('Blocklist.de StrongIPs', 'http://lists.blocklist.de/lists/strongips.txt', 'ip', 'text', true, 1800, 'Strong attack IPs'),

-- Binary Defense
('Binary Defense Banlist', 'https://binarydefense.com/banlist.txt', 'ip', 'text', true, 1800, 'Binary Defense threat list'),

-- Spamhaus
('Spamhaus DROP', 'https://www.spamhaus.org/drop/drop.txt', 'ip', 'text', true, 3600, 'Spamhaus DROP list'),
('Spamhaus EDROP', 'https://www.spamhaus.org/drop/edrop.txt', 'ip', 'text', true, 3600, 'Spamhaus extended DROP'),

-- AlienVault OTX
('AlienVault Reputation', 'https://reputation.alienvault.com/reputation.generic', 'ip', 'text', true, 3600, 'AlienVault reputation data'),

-- Botvrij.eu
('Botvrij IOC Dst', 'https://www.botvrij.eu/data/ioclist.ip-dst.raw', 'ip', 'text', true, 1800, 'Botvrij destination IPs'),
('Botvrij IOC Src', 'https://www.botvrij.eu/data/ioclist.ip-src.raw', 'ip', 'text', true, 1800, 'Botvrij source IPs'),

-- CI Army
('CI Army Badguys', 'http://www.ciarmy.com/list/ci-badguys.txt', 'ip', 'text', true, 3600, 'CI Army bad actors'),

-- CleanTalk
('CleanTalk New IPs', 'https://cleantalk.org/blacklists_ips_new.json', 'ip', 'json', true, 3600, 'CleanTalk new blacklisted IPs'),
('CleanTalk Top IPs', 'https://cleantalk.org/blacklists_ips_top.json', 'ip', 'json', true, 3600, 'CleanTalk top blacklisted IPs'),
('CleanTalk Updated', 'https://cleantalk.org/blacklists_ips_updated.json', 'ip', 'json', true, 3600, 'CleanTalk updated IPs'),

-- Cybercrime Tracker
('Cybercrime Tracker', 'http://cybercrime-tracker.net/all.php', 'mixed', 'text', true, 3600, 'Cybercrime tracker feed'),

-- DShield
('DShield Top IPs', 'http://www.dshield.org/ipsouts.xml', 'ip', 'xml', true, 3600, 'DShield top attacking IPs'),

-- GreenSnow
('GreenSnow Blocklist', 'http://greensnow.gr/greensnow.txt', 'ip', 'text', true, 1800, 'GreenSnow attack IPs'),

-- Malc0de
('Malc0de Blacklist', 'http://malc0de.com/bl/IP_Blacklist.txt', 'ip', 'text', true, 3600, 'Malc0de IP blacklist'),

-- Bad Packets
('Bad Packets ATIF', 'https://www.bad-packets.net/atif.txt', 'ip', 'text', true, 1800, 'Bad Packets threat feed'),

-- Blocklist.net.ua
('Blocklist Ukraine', 'http://blocklist.net.ua/blocklist.txt', 'ip', 'text', true, 3600, 'Ukraine blocklist'),

-- Darklist
('Darklist', 'http://www.darklist.de/raw.php', 'ip', 'text', true, 3600, 'Darklist IPs'),

-- StopForumSpam
('StopForumSpam Toxic', 'http://www.stopforumspam.com/downloads/toxic_ips.zip', 'ip', 'zip', true, 86400, 'Toxic spam IPs'),
('StopForumSpam 1d', 'http://www.stopforumspam.com/downloads/full_ip_1d.zip', 'ip', 'zip', true, 86400, 'Spam IPs last 1 day'),
('StopForumSpam 7d', 'http://www.stopforumspam.com/downloads/full_ip_7.zip', 'ip', 'zip', true, 86400, 'Spam IPs last 7 days'),
('StopForumSpam 30d', 'http://www.stopforumspam.com/downloads/full_ip_30.zip', 'ip', 'zip', true, 86400, 'Spam IPs last 30 days'),
('StopForumSpam 90d', 'http://www.stopforumspam.com/downloads/full_ip_90.zip', 'ip', 'zip', true, 86400, 'Spam IPs last 90 days'),
('StopForumSpam 180d', 'http://www.stopforumspam.com/downloads/full_ip_180.zip', 'ip', 'zip', true, 86400, 'Spam IPs last 180 days'),
('StopForumSpam 365d', 'http://www.stopforumspam.com/downloads/full_ip_365.zip', 'ip', 'zip', true, 86400, 'Spam IPs last 365 days'),

-- Urandom Cloud
('Urandom DNS', 'https://urandom.cloud/feeds/dns.txt', 'ip', 'text', true, 3600, 'DNS attack IPs'),
('Urandom FTP', 'https://urandom.cloud/feeds/ftp.txt', 'ip', 'text', true, 3600, 'FTP attack IPs'),
('Urandom HTTP', 'https://urandom.cloud/feeds/http.txt', 'ip', 'text', true, 3600, 'HTTP attack IPs'),
('Urandom Mailer', 'https://urandom.cloud/feeds/mailer.txt', 'ip', 'text', true, 3600, 'Mailer attack IPs'),
('Urandom Malware', 'https://urandom.cloud/feeds/malware.txt', 'ip', 'text', true, 3600, 'Malware IPs'),
('Urandom NTP', 'https://urandom.cloud/feeds/ntp.txt', 'ip', 'text', true, 3600, 'NTP attack IPs'),
('Urandom RDP', 'https://urandom.cloud/feeds/rdp.txt', 'ip', 'text', true, 3600, 'RDP attack IPs'),
('Urandom SMB', 'https://urandom.cloud/feeds/smb.txt', 'ip', 'text', true, 3600, 'SMB attack IPs'),
('Urandom Spam', 'https://urandom.cloud/feeds/spam.txt', 'ip', 'text', true, 3600, 'Spam IPs'),
('Urandom SSH', 'https://urandom.cloud/feeds/ssh.txt', 'ip', 'text', true, 3600, 'SSH attack IPs'),
('Urandom Telnet', 'https://urandom.cloud/feeds/telnet.txt', 'ip', 'text', true, 3600, 'Telnet attack IPs'),
('Urandom Unspecified', 'https://urandom.cloud/feeds/unspecified.txt', 'ip', 'text', true, 3600, 'Unspecified attacks'),
('Urandom VNC', 'https://urandom.cloud/feeds/vnc.txt', 'ip', 'text', true, 3600, 'VNC attack IPs'),

-- VXVault
('VXVault', 'http://vxvault.net/VXVault.txt', 'mixed', 'text', true, 3600, 'VXVault malware URLs'),

-- Yoyo Ad Servers
('Yoyo Ad Servers', 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=ipset&showintro=0', 'ip', 'text', true, 86400, 'Ad server IPs'),

-- Malware Domain List
('Malware Domain IPs', 'http://www.malwaredomainlist.com/hostslist/ip.txt', 'ip', 'text', true, 3600, 'Malware domain IPs'),

-- AbuseIPDB
('AbuseIPDB Top 100', 'https://raw.githubusercontent.com/borestad/blocklist-abuseipdb/main/abuseipdb-s100-30d.ipv4', 'ip', 'text', true, 3600, 'AbuseIPDB top 100 abusers'),

-- Domain Feeds
('URLAbuse', 'https://urlabuse.com/public/data/data.txt', 'domain', 'text', true, 3600, 'URLAbuse malicious domains'),
('Hagezi DNS Blocklist', 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.txt', 'domain', 'text', true, 86400, 'Hagezi DNS blocklist'),
('OpenPhish', 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt', 'domain', 'text', true, 1800, 'OpenPhish phishing URLs'),

-- Bitnodes (Bitcoin nodes - informational)
('Bitnodes', 'https://bitnodes.io/api/v1/snapshots/latest/', 'ip', 'json', false, 86400, 'Bitcoin node IPs (informational)'),

-- GreyNoise (requires token)
('GreyNoise Malicious', 'https://api.greynoise.io/v3/tags/23e6932c-e2bd-48cf-80b8-aa98ae9276c4/ips?format=txt&token=ryvcVdfvT5m3MMehvtr6gQ', 'ip', 'text', false, 3600, 'GreyNoise malicious IPs'),
('GreyNoise Benign', 'https://api.greynoise.io/v3/tags/db896d7c-6acc-446a-9715-a8bdc2c24618/ips?format=txt&token=ryvcVdfvT5m3MMehvtr6gQ', 'ip', 'text', false, 3600, 'GreyNoise benign IPs');

-- Update statistics
SELECT 
  COUNT(*) as total_feeds,
  COUNT(*) FILTER (WHERE is_active = true) as active_feeds,
  COUNT(*) FILTER (WHERE feed_type = 'ip') as ip_feeds,
  COUNT(*) FILTER (WHERE feed_type = 'domain') as domain_feeds,
  COUNT(*) FILTER (WHERE feed_type = 'mixed') as mixed_feeds
FROM feed_sources;
