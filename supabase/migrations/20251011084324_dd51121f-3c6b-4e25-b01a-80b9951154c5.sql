-- =====================================================
-- MIGRAZIONE MONTY SECURITY → INTELGUARD-IO/MONTY
-- =====================================================

-- FASE 1: Disabilita e rinomina vecchie fonti Monty Security
UPDATE ingest_sources 
SET 
  name = '[DEPRECATED] ' || name,
  enabled = false,
  last_error = 'Migrated to INTELGUARD-IO/MONTY repository - Original montysecurity/C2-Tracker repository restructured',
  description = COALESCE(description, '') || ' [ARCHIVED: January 2025 - Repository no longer available]',
  updated_at = NOW()
WHERE name LIKE 'Monty Security%' 
  AND name NOT LIKE '[DEPRECATED]%';

-- FASE 2: Crea nuove fonti INTELGUARD-IO/MONTY

-- 2.1) C2 Frameworks (Priority 90) - 18 fonti
INSERT INTO ingest_sources (name, url, kind, description, priority, enabled)
VALUES
  ('INTELGUARD - C2 Framework - Cobalt Strike', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Cobalt%20Strike%20C2%20IPs.txt',
   'ipv4',
   'IP di server Cobalt Strike C2 - framework commerciale molto usato da threat actors e red team',
   90, true),
  
  ('INTELGUARD - C2 Framework - Metasploit', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Metasploit%20Framework%20C2%20IPs.txt',
   'ipv4',
   'Server Metasploit Framework esposti - piattaforma di penetration testing open source',
   90, true),
  
  ('INTELGUARD - C2 Framework - Covenant', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Covenant%20C2%20IPs.txt',
   'ipv4',
   'Infrastructure Covenant C2 - framework .NET per operazioni post-exploitation',
   90, true),
  
  ('INTELGUARD - C2 Framework - Mythic', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Mythic%20C2%20IPs.txt',
   'ipv4',
   'Server Mythic C2 - framework multiplayer C2 con interfaccia web',
   90, true),
  
  ('INTELGUARD - C2 Framework - Brute Ratel C4', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Brute%20Ratel%20C4%20IPs.txt',
   'ipv4',
   'IP Brute Ratel C4 - framework C2 commerciale alternativo a Cobalt Strike',
   90, true),
  
  ('INTELGUARD - C2 Framework - Sliver', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Sliver%20C2%20IPs.txt',
   'ipv4',
   'Server Sliver C2 - framework open source sviluppato da BishopFox',
   90, true),
  
  ('INTELGUARD - C2 Framework - Havoc', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Havoc%20C2%20IPs.txt',
   'ipv4',
   'Infrastructure Havoc C2 - framework post-exploitation moderno e modulare',
   90, true),
  
  ('INTELGUARD - C2 Framework - Caldera', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Caldera%20C2%20IPs.txt',
   'ipv4',
   'Server Caldera - framework di automazione adversary emulation sviluppato da MITRE',
   90, true),
  
  ('INTELGUARD - C2 Framework - PANDA', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/PANDA%20C2%20IPs.txt',
   'ipv4',
   'IP PANDA C2 - framework command and control specializzato',
   90, true),
  
  ('INTELGUARD - C2 Framework - NimPlant', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/NimPlant%20C2%20IPs.txt',
   'ipv4',
   'Server NimPlant - implant C2 scritto in linguaggio Nim',
   90, true),
  
  ('INTELGUARD - C2 Framework - Hak5 Cloud C2', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Hak5%20Cloud%20C2%20IPs.txt',
   'ipv4',
   'Infrastructure Hak5 Cloud C2 - piattaforma per dispositivi Hak5 (WiFi Pineapple, etc)',
   90, true),
  
  ('INTELGUARD - C2 Framework - RedGuard', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/RedGuard%20C2%20IPs.txt',
   'ipv4',
   'Server RedGuard C2 - proxy per traffico C2 con funzionalità di evasion',
   90, true),
  
  ('INTELGUARD - C2 Framework - Oyster', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Oyster%20C2%20IPs.txt',
   'ipv4',
   'IP Oyster C2 - framework command and control moderno',
   90, true),
  
  ('INTELGUARD - C2 Framework - Pantegana', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Pantegana%20C2%20IPs.txt',
   'ipv4',
   'Infrastructure Pantegana - framework C2 italiano',
   90, true),
  
  ('INTELGUARD - C2 Framework - Supershell', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Supershell%20C2%20IPs.txt',
   'ipv4',
   'Server Supershell C2 - framework per reverse shell avanzate',
   90, true),
  
  ('INTELGUARD - C2 Framework - Vshell', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Vshell%20C2%20IPs.txt',
   'ipv4',
   'IP Vshell C2 - piattaforma command and control',
   90, true),
  
  ('INTELGUARD - C2 Framework - Villain', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Villain%20C2%20IPs.txt',
   'ipv4',
   'Server Villain - framework C2 Python-based con GUI web',
   90, true),
  
  ('INTELGUARD - C2 Framework - Viper', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Viper%20C2%20IPs.txt',
   'ipv4',
   'Infrastructure Viper C2 - framework specializzato per operazioni red team',
   90, true);

-- 2.2) RAT/Trojan (Priority 85) - 16 fonti
INSERT INTO ingest_sources (name, url, kind, description, priority, enabled)
VALUES
  ('INTELGUARD - RAT - AsyncRAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/AsyncRAT%20IPs.txt',
   'ipv4',
   'Server AsyncRAT - Remote Access Trojan open source molto diffuso',
   85, true),
  
  ('INTELGUARD - RAT - Quasar RAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Quasar%20RAT%20IPs.txt',
   'ipv4',
   'IP Quasar RAT - trojan di accesso remoto basato su .NET',
   85, true),
  
  ('INTELGUARD - RAT - ShadowPad', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/ShadowPad%20IPs.txt',
   'ipv4',
   'Server ShadowPad - backdoor modulare associata a gruppi APT cinesi',
   85, true),
  
  ('INTELGUARD - RAT - DcRAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/DcRAT%20IPs.txt',
   'ipv4',
   'Infrastructure DcRAT - Remote Access Trojan commerciale',
   85, true),
  
  ('INTELGUARD - RAT - DarkComet', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/DarkComet%20Trojan%20IPs.txt',
   'ipv4',
   'Server DarkComet - RAT storico molto utilizzato nel cybercrime',
   85, true),
  
  ('INTELGUARD - RAT - XtremeRAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/XtremeRAT%20Trojan%20IPs.txt',
   'ipv4',
   'IP XtremeRAT - Remote Access Trojan popolare negli attacchi mirati',
   85, true),
  
  ('INTELGUARD - RAT - NanoCore', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/NanoCore%20RAT%20Trojan%20IPs.txt',
   'ipv4',
   'Server NanoCore - RAT commerciale con funzionalità avanzate',
   85, true),
  
  ('INTELGUARD - RAT - Gh0st RAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Gh0st%20RAT%20Trojan%20IPs.txt',
   'ipv4',
   'Infrastructure Gh0st RAT - trojan cinese molto diffuso, usato da vari gruppi APT',
   85, true),
  
  ('INTELGUARD - RAT - njRAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/njRAT%20Trojan%20IPs.txt',
   'ipv4',
   'Server njRAT - Remote Access Trojan gratuito molto popolare',
   85, true),
  
  ('INTELGUARD - RAT - Remcos', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Remcos%20RAT%20IPs.txt',
   'ipv4',
   'IP Remcos Pro RAT - trojan commerciale con funzionalità legittime abusate',
   85, true),
  
  ('INTELGUARD - RAT - Orcus', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Orcus%20RAT%20Trojan%20IPs.txt',
   'ipv4',
   'Server Orcus RAT - Remote Access Trojan con plugin system',
   85, true),
  
  ('INTELGUARD - RAT - NetBus', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/NetBus%20Trojan%20IPs.txt',
   'ipv4',
   'Infrastructure NetBus - trojan storico degli anni 90 ancora in uso',
   85, true),
  
  ('INTELGUARD - Malware - Hookbot', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Hookbot%20IPs.txt',
   'ipv4',
   'Server Hookbot - malware specializzato nell hooking di API Windows',
   85, true),
  
  ('INTELGUARD - RAT - SpiceRAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/SpiceRAT%20IPs.txt',
   'ipv4',
   'IP SpiceRAT - Remote Access Trojan moderno con funzionalità stealth',
   85, true),
  
  ('INTELGUARD - Malware - SpyAgent', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/SpyAgent%20IPs.txt',
   'ipv4',
   'Server SpyAgent - malware di spionaggio per furto informazioni',
   85, true),
  
  ('INTELGUARD - RAT - Sectop RAT', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Sectop%20RAT%20IPs.txt',
   'ipv4',
   'Infrastructure Sectop RAT - trojan di accesso remoto specializzato',
   85, true);

-- 2.3) Tools Legittimi Abusati (Priority 80) - 5 fonti
INSERT INTO ingest_sources (name, url, kind, description, priority, enabled)
VALUES
  ('INTELGUARD - Tool - XMRig Cryptominer', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/XMRig%20Monero%20Cryptominer%20IPs.txt',
   'ipv4',
   'Server XMRig - mining pool Monero spesso usati per cryptojacking illegale',
   80, true),
  
  ('INTELGUARD - Tool - GoPhish', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/GoPhish%20IPs.txt',
   'ipv4',
   'Infrastructure GoPhish - framework phishing legittimo abusato per attacchi',
   80, true),
  
  ('INTELGUARD - Tool - BurpSuite', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/BurpSuite%20IPs.txt',
   'ipv4',
   'Server BurpSuite esposti - tool di sicurezza web usato impropriamente',
   80, true),
  
  ('INTELGUARD - Tool - MobSF', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/MobSF%20IPs.txt',
   'ipv4',
   'IP MobSF - Mobile Security Framework esposto pubblicamente',
   80, true),
  
  ('INTELGUARD - Tool - Unam Web Panel', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Unam%20Web%20Panel%20IPs.txt',
   'ipv4',
   'Server Unam Web Panel - pannello per cryptomining silenzioso',
   80, true);

-- 2.4) Botnets (Priority 75) - 2 fonti
INSERT INTO ingest_sources (name, url, kind, description, priority, enabled)
VALUES
  ('INTELGUARD - Botnet - 7777', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/7777%20Botnet%20IPs.txt',
   'ipv4',
   'IP della botnet 7777 - nota per compromettere router e dispositivi IoT',
   75, true),
  
  ('INTELGUARD - Botnet - Mozi', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Mozi%20Botnet%20IPs.txt',
   'ipv4',
   'Server Mozi - botnet P2P specializzata in dispositivi IoT vulnerabili',
   75, true);

-- 2.5) APT/Advanced Threats (Priority 95) - 1 fonte
INSERT INTO ingest_sources (name, url, kind, description, priority, enabled)
VALUES
  ('INTELGUARD - APT - Ares RAT C2', 
   'https://raw.githubusercontent.com/INTELGUARD-IO/MONTY/main/data/Ares%20RAT%20C2%20IPs.txt',
   'ipv4',
   'Infrastructure Ares RAT - trojan di accesso remoto associato a campagne APT',
   95, true);