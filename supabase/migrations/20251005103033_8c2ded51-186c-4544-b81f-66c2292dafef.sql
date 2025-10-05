-- =====================================================
-- FASE 2: Inserimento 43 nuove fonti (30 TXT + 4 JSON + 9 TXT SORBS)
-- Solo IP singoli e domini - NO CIDR/range
-- =====================================================

-- ========== BLOCKLIST.DE (9 nuove categorie TXT) ==========
INSERT INTO ingest_sources (name, url, kind, description, enabled, priority)
VALUES
('Blocklist.de Apache', 'http://lists.blocklist.de/lists/apache.txt', 'ipv4', 'IP che attaccano Apache (Blocklist.de)', true, 50),
('Blocklist.de Bots', 'http://lists.blocklist.de/lists/bots.txt', 'ipv4', 'IP di bot malevoli (Blocklist.de)', true, 50),
('Blocklist.de Bruteforce', 'http://lists.blocklist.de/lists/bruteforce.txt', 'ipv4', 'IP con attacchi bruteforce (Blocklist.de)', true, 55),
('Blocklist.de FTP', 'http://lists.blocklist.de/lists/ftp.txt', 'ipv4', 'IP che attaccano FTP (Blocklist.de)', true, 50),
('Blocklist.de IMAP', 'http://lists.blocklist.de/lists/imap.txt', 'ipv4', 'IP che attaccano IMAP (Blocklist.de)', true, 50),
('Blocklist.de Mail', 'http://lists.blocklist.de/lists/mail.txt', 'ipv4', 'IP spam/phishing mail (Blocklist.de)', true, 55),
('Blocklist.de SIP', 'http://lists.blocklist.de/lists/sip.txt', 'ipv4', 'IP che attaccano SIP/VoIP (Blocklist.de)', true, 50),
('Blocklist.de SSH', 'http://lists.blocklist.de/lists/ssh.txt', 'ipv4', 'IP bruteforce SSH (Blocklist.de)', true, 55),
('Blocklist.de StrongIPs', 'http://lists.blocklist.de/lists/strongips.txt', 'ipv4', 'IP ad alta pericolosità (Blocklist.de)', true, 60);

-- ========== URANDOM.CLOUD (13 vettori di attacco TXT) ==========
INSERT INTO ingest_sources (name, url, kind, description, enabled, priority)
VALUES
('URandom DNS Attacks', 'https://urandom.cloud/attacks/dns.txt', 'ipv4', 'Attacchi DNS amplification (URandom)', true, 55),
('URandom FTP Attacks', 'https://urandom.cloud/attacks/ftp.txt', 'ipv4', 'Bruteforce FTP (URandom)', true, 50),
('URandom HTTP Attacks', 'https://urandom.cloud/attacks/http.txt', 'ipv4', 'Attacchi HTTP/Web (URandom)', true, 55),
('URandom Mailer Attacks', 'https://urandom.cloud/attacks/mailer.txt', 'ipv4', 'Spam mailer (URandom)', true, 55),
('URandom Malware', 'https://urandom.cloud/attacks/malware.txt', 'ipv4', 'IP distribuenti malware (URandom)', true, 60),
('URandom NTP Attacks', 'https://urandom.cloud/attacks/ntp.txt', 'ipv4', 'NTP amplification (URandom)', true, 50),
('URandom RDP Attacks', 'https://urandom.cloud/attacks/rdp.txt', 'ipv4', 'Bruteforce RDP (URandom)', true, 55),
('URandom SMB Attacks', 'https://urandom.cloud/attacks/smb.txt', 'ipv4', 'Attacchi SMB/445 (URandom)', true, 55),
('URandom Spam', 'https://urandom.cloud/attacks/spam.txt', 'ipv4', 'Spamming generale (URandom)', true, 55),
('URandom SSH Attacks', 'https://urandom.cloud/attacks/ssh.txt', 'ipv4', 'Bruteforce SSH (URandom)', true, 55),
('URandom Telnet Attacks', 'https://urandom.cloud/attacks/telnet.txt', 'ipv4', 'Attacchi Telnet (URandom)', true, 50),
('URandom Unspecified', 'https://urandom.cloud/attacks/unspecified.txt', 'ipv4', 'Attacchi non classificati (URandom)', true, 45),
('URandom VNC Attacks', 'https://urandom.cloud/attacks/vnc.txt', 'ipv4', 'Bruteforce VNC (URandom)', true, 50);

-- ========== SORBS DNSBL (7 zone TXT) ==========
INSERT INTO ingest_sources (name, url, kind, description, enabled, priority)
VALUES
('SORBS Proxies', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/proxies.txt', 'ipv4', 'Open proxy (SORBS)', true, 50),
('SORBS Escalations', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/escalations.txt', 'ipv4', 'IP escalati a spam (SORBS)', true, 55),
('SORBS New Spam', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/newspam.txt', 'ipv4', 'Nuovo spam (SORBS)', true, 55),
('SORBS Recent Spam', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/recentspam.txt', 'ipv4', 'Spam recente (SORBS)', true, 55),
('SORBS SMTP', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/smtp.txt', 'ipv4', 'SMTP abuse (SORBS)', true, 55),
('SORBS Web', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/web.txt', 'ipv4', 'Web spam (SORBS)', true, 50),
('SORBS Zombie', 'https://raw.githubusercontent.com/duggytuxy/malicious_ip_addresses/main/sorbs/zombie.txt', 'ipv4', 'Botnet zombie (SORBS)', true, 60);

-- ========== ALTRI TXT HIGH-VALUE (8 fonti) ==========
INSERT INTO ingest_sources (name, url, kind, description, enabled, priority)
VALUES
('Bad Packets ATIF', 'https://raw.githubusercontent.com/bad-packets/ip-blocklist/main/txt/atif.txt', 'ipv4', 'Attacker Threat Intel Feed (Bad Packets)', true, 65),
('Botvrij DST', 'https://www.botvrij.eu/data/ioclist.ip-dst.raw', 'ipv4', 'IP destinazione attacchi (Botvrij)', true, 60),
('DarkList.de Malware', 'https://www.darklist.de/raw.php?s=top100', 'ipv4', 'Top 100 malware IP (DarkList.de)', true, 65),
('Malc0de IP Blacklist', 'http://malc0de.com/bl/IP_Blacklist.txt', 'ipv4', 'IP blacklist malware (Malc0de)', true, 60),
('CruzIT Malware IP', 'https://iplists.firehol.org/files/cruzit_web_attacks.ipset', 'ipv4', 'Web attacks IP (CruzIT)', true, 60),
('GPF Comics SSH Attackers', 'https://www.gpf-comics.com/dnsbl/export.php', 'ipv4', 'SSH bruteforce (GPF Comics)', true, 55),
('Gofferje Web Attackers', 'https://gofferje.dnsbl.io.heise.de/iplist.txt', 'ipv4', 'Web attackers (Gofferje/Heise)', true, 55),
('ISC SANS Top 100', 'https://isc.sans.edu/api/sources/attacks/100/txt', 'ipv4', 'Top 100 attacker IP (SANS ISC)', true, 65);

-- ========== JSON SOURCES (4 fonti) ==========
-- CleanTalk Daily/2-Day/7-Day: formato {"data":{"networks":[{"ip":"1.2.3.4"}]}}
-- AlienVault: formato CSV in risposta JSON
INSERT INTO ingest_sources (name, url, kind, description, enabled, priority)
VALUES
('CleanTalk Daily JSON', 'https://api.cleantalk.org/2.1/find_spam_ips?days=1&out=json', 'ipv4', 'Spam IP ultimi 1 giorno (CleanTalk API)', true, 60),
('CleanTalk 2-Day JSON', 'https://api.cleantalk.org/2.1/find_spam_ips?days=2&out=json', 'ipv4', 'Spam IP ultimi 2 giorni (CleanTalk API)', true, 55),
('CleanTalk 7-Day JSON', 'https://api.cleantalk.org/2.1/find_spam_ips?days=7&out=json', 'ipv4', 'Spam IP ultimi 7 giorni (CleanTalk API)', true, 50),
('AlienVault OTX CSV', 'https://reputation.alienvault.com/reputation.generic', 'ipv4', 'IP reputation feed (AlienVault OTX)', true, 65);

-- =====================================================
-- VERIFICA TOTALE FONTI
-- =====================================================
-- Query di verifica: dovremmo avere 20 (esistenti) + 43 (nuove) = 63 fonti
-- SELECT COUNT(*) FROM ingest_sources WHERE enabled = true;