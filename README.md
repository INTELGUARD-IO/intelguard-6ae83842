# IntelGuard 🛡️

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Enabled-3ecf8e)](https://supabase.com/)

**IntelGuard** è una piattaforma avanzata di Threat Intelligence che aggrega, valida e distribuisce indicatori di compromissione (IoC) da oltre 15 fonti esterne, fornendo feed di sicurezza in tempo reale per proteggere le infrastrutture aziendali.

## 🎯 Problema Risolto

Le organizzazioni devono monitorare costantemente migliaia di fonti di threat intelligence per identificare IP malevoli e domini pericolosi. IntelGuard automatizza questo processo:

- ✅ **Aggregazione Multi-Fonte**: Raccoglie IoC da 15+ provider di threat intelligence
- ✅ **Validazione Intelligente**: Sistema di consensus voting con 10+ validatori
- ✅ **Feed API Personalizzati**: Distribuisce feed filtrati via API token-based
- ✅ **Arricchimento Automatico**: Geolocalizzazione, ASN, threat classification
- ✅ **Multi-Tenancy**: Gestione clienti con feed dedicati

## 📊 Use Cases

1. **SOC Teams**: Feed di blocklist per firewall e SIEM
2. **MSSP Providers**: Distribuzione feed personalizzati a clienti multipli
3. **Security Researchers**: Analisi trend di minacce e correlazione dati
4. **Compliance Teams**: Reporting e audit trail completo

---

## 🚀 Quick Start

### Prerequisiti

\`\`\`bash
Node.js >= 18.0.0
npm >= 9.0.0 o yarn >= 1.22.0
Git
\`\`\`

### Installazione

\`\`\`bash
# 1. Clone repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Install dependencies
npm install

# 3. Setup environment (già configurato con Lovable Cloud)
# Le variabili sono già presenti in .env automaticamente

# 4. Start development server
npm run dev
\`\`\`

Il progetto sarà disponibile su `http://localhost:8080`

### 🔐 Primo Accesso

1. Naviga su `/auth`
2. Crea un account (auto-confermato)
3. Il primo utente creato diventa super admin automaticamente
4. Accedi alla dashboard su `/dashboard`

---

## 🏗️ Tech Stack

### Frontend
- **Framework**: React 18.3.1 con TypeScript 5.0
- **Build Tool**: Next.js 15.5 (App Router)
- **Styling**: TailwindCSS 4.1 + shadcn/ui components
- **State Management**: TanStack Query 5.83 (server state)
- **Routing**: Next.js App Router (file-based routing)
- **Charts**: Recharts 2.15 (visualizzazione metriche)
- **Forms**: React Hook Form 7.61 + Zod validation

### Backend (Lovable Cloud / Supabase)
- **Database**: PostgreSQL 15 (39 tabelle relazionali)
- **Auth**: Supabase Auth (email/password, auto-confirm)
- **API**: 30+ Supabase Edge Functions (Deno runtime)
- **Storage**: Supabase Storage (whitelist files)
- **Cron Jobs**: pg_cron per scheduling automatico
- **Realtime**: Supabase Realtime per dashboard live

### External APIs Integrate
| API Provider | Purpose | Rate Limit |
|-------------|---------|------------|
| **AbuseIPDB** | IP reputation, blacklist | 1000/day |
| **VirusTotal** | Malware detection | 500/day |
| **AlienVault OTX** | Threat intelligence pulses | Unlimited |
| **Google Safe Browsing** | Phishing/malware detection | 10000/day |
| **URLScan.io** | Domain scanning | 1000/day |
| **HoneyDB** | Honeypot data | Unlimited |
| **NeutrinoAPI** | IP blocklist, VPN detection | 5000/day |
| **Censys** | Internet-wide scanning | 100/month |
| **Cloudflare Radar** | IP enrichment | Unlimited |
| **Cloudflare URL Scanner** | Domain validation | 1000/day |
| **BGPView** | ASN/BGP data | Rate-limited |
| **RIPEstat** | Network information | Unlimited |
| **Abuse.ch** | Botnet C2, malware | Unlimited |
| **Cisco Umbrella** | Top domains list | Daily sync |

### Deployment
- **Platform**: Lovable.dev (production hosting)
- **CDN**: Built-in edge caching
- **Database**: Managed PostgreSQL cluster
- **Edge Functions**: Auto-scaling serverless
- **Monitoring**: Built-in logs & analytics

---

## 📡 API Reference

### Feed API - Accesso Pubblico

#### GET `/functions/v1/feed`

Recupera feed di indicatori validati (IPv4 o Domini).

**Headers:**
\`\`\`http
Authorization: Bearer {FEED_TOKEN}
Content-Type: application/json
\`\`\`

**Query Parameters:**
| Parametro | Tipo | Obbligatorio | Default | Descrizione |
|-----------|------|--------------|---------|-------------|
| `type` | string | ✅ | - | `ipv4` o `domain` |
| `format` | string | ❌ | `json` | `json`, `csv`, `text` |
| `confidence_min` | number | ❌ | 70 | Min confidence (0-100) |

**Esempio - IPv4 JSON:**
\`\`\`bash
curl -H "Authorization: Bearer your_token_here" \
  "https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed?type=ipv4&confidence_min=80"
\`\`\`

**Response (200 OK):**
\`\`\`json
{
  "indicators": [
    {
      "indicator": "1.2.3.4",
      "kind": "ipv4",
      "confidence": 85.5,
      "threat_type": "botnet",
      "country": "CN",
      "asn": "AS4134",
      "last_validated": "2025-10-05T12:34:56Z"
    }
  ],
  "metadata": {
    "total": 1234,
    "format": "json",
    "generated_at": "2025-10-05T12:35:00Z"
  }
}
\`\`\`

**Esempio - Domini CSV:**
\`\`\`bash
curl -H "Authorization: Bearer your_token_here" \
  "https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed?type=domain&format=csv" \
  -o malicious_domains.csv
\`\`\`

**Response (200 OK - CSV):**
\`\`\`csv
indicator,kind,confidence,threat_type,country,last_validated
evil.com,domain,92.0,phishing,US,2025-10-05T10:00:00Z
malware.net,domain,88.5,malware,RU,2025-10-05T09:45:00Z
\`\`\`

**Esempio - IPv4 Plain Text:**
\`\`\`bash
curl -H "Authorization: Bearer your_token_here" \
  "https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed?type=ipv4&format=text"
\`\`\`

**Response (200 OK - Text):**
\`\`\`
1.2.3.4
5.6.7.8
9.10.11.12
\`\`\`

**Error Responses:**

| Status | Codice | Descrizione |
|--------|--------|-------------|
| 401 | `INVALID_TOKEN` | Token non valido o mancante |
| 403 | `TOKEN_DISABLED` | Token disabilitato dall'admin |
| 400 | `INVALID_TYPE` | Type deve essere `ipv4` o `domain` |
| 500 | `SERVER_ERROR` | Errore interno del server |

\`\`\`json
{
  "error": "INVALID_TOKEN",
  "message": "Feed token is invalid or expired"
}
\`\`\`

---

### Feed GET API - Accesso Semplificato

#### GET `/functions/v1/feed-get/{token}/{type}`

Endpoint semplificato per integrazioni dirette (no headers).

**URL Pattern:**
\`\`\`
https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed-get/{TOKEN}/{TYPE}
\`\`\`

**Parametri URL:**
- `{TOKEN}`: Feed token UUID
- `{TYPE}`: `ipv4` o `domain`

**Query Parameters:**
| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| `format` | `text` | `text`, `json`, `csv` |
| `confidence_min` | 70 | Confidence minima (0-100) |

**Esempio - Blocklist IPv4 per Firewall:**
\`\`\`bash
# Download blocklist text-based
curl "https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed-get/your-token-uuid/ipv4?format=text&confidence_min=85" \
  -o blocklist.txt

# Aggiungi a iptables
while read ip; do
  iptables -A INPUT -s $ip -j DROP
done < blocklist.txt
\`\`\`

**Esempio - Domini CSV per SIEM:**
\`\`\`bash
curl "https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed-get/your-token-uuid/domain?format=csv" \
  -o threat_domains.csv
\`\`\`

**Esempio JavaScript - Fetch Feed:**
\`\`\`javascript
const FEED_TOKEN = 'your-token-uuid';
const FEED_TYPE = 'ipv4';

async function fetchThreatFeed() {
  const response = await fetch(
    `https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/feed-get/${FEED_TOKEN}/${FEED_TYPE}?format=json&confidence_min=80`
  );
  
  if (!response.ok) {
    throw new Error(`Feed error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`Received ${data.indicators.length} threat indicators`);
  
  return data.indicators;
}

// Aggiorna ogni 5 minuti
setInterval(fetchThreatFeed, 5 * 60 * 1000);
\`\`\`

---

### Manual Ingest API (Admin Only)

#### POST `/functions/v1/manual-ingest`

Ingest manuale di indicatori via API (richiede autenticazione super admin).

**Headers:**
\`\`\`http
Authorization: Bearer {SUPABASE_JWT}
Content-Type: application/json
\`\`\`

**Request Body:**
\`\`\`json
{
  "indicators": [
    {
      "indicator": "198.51.100.42",
      "kind": "ipv4",
      "source": "manual_upload"
    },
    {
      "indicator": "evil-domain.com",
      "kind": "domain",
      "source": "analyst_research"
    }
  ]
}
\`\`\`

**Response (200 OK):**
\`\`\`json
{
  "success": true,
  "inserted": 2,
  "duplicates": 0,
  "errors": 0
}
\`\`\`

**Esempio curl:**
\`\`\`bash
curl -X POST "https://qmsidlazqaqwcptpsjqh.supabase.co/functions/v1/manual-ingest" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "indicators": [
      {"indicator": "203.0.113.5", "kind": "ipv4", "source": "incident_response"}
    ]
  }'
\`\`\`

---

## 🎨 Features Principali

### 1. Dashboard Tempo Reale

![Dashboard Overview](https://via.placeholder.com/800x400?text=Dashboard+Screenshot)

Metriche live aggiornate ogni 30 secondi:
- Conteggio indicatori (IPv4, Domini)
- Trend giornalieri (aggiunti/rimossi)
- Stato validatori (quota, errori)
- Coverage validazione (% indicatori verificati)

### 2. Gestione Ingest Sources

\`\`\`typescript
// Configurazione source automatica
const source = {
  name: "Emerging Threats",
  kind: "ipv4",
  url: "https://rules.emergingthreats.net/blockrules/compromised-ips.txt",
  enabled: true,
  priority: 80  // Priorità alta = processato prima
};
\`\`\`

Supporto formati:
- Plain text (1 indicatore per riga)
- CSV (auto-detect colonne)
- JSON (array di oggetti)

### 3. Sistema di Validazione Intelligente

**Consensus Voting Algorithm:**

\`\`\`typescript
// Ogni indicatore passa attraverso 10+ validatori
const validators = [
  'abuse-ch',           // False positive check
  'abuseipdb',         // IP reputation
  'google-safebrowsing', // Phishing/malware
  'virustotal',        // Multi-AV scan
  'otx',               // Pulse intelligence
  'urlscan',           // Domain analysis
  'honeydb',           // Honeypot correlation
  'neutrinoapi',       // VPN/proxy detection
  'censys',            // Internet scan data
  'cloudflare-urlscan' // CDN scanning
];

// Score calculation
const score = calculateAdvancedScore(indicator, votes);
if (score >= CONSENSUS_THRESHOLD || (score >= 70 && confidence >= 85)) {
  promoteToValidated(indicator);
}
\`\`\`

### 4. Multi-Tenancy & Feed Tokens

**User Flow:**
1. Admin crea tenant (cliente)
2. Genera feed token per tenant
3. Token limitato a tipo specifico (IPv4/Domain)
4. Cliente usa token per accedere feed
5. Audit log completo degli accessi

**Gestione Token:**
\`\`\`typescript
// Dashboard UI -> Feed Tokens -> Crea Nuovo
{
  type: "ipv4",
  customer_id: "uuid-cliente",
  enabled: true
}
// Token generato: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
\`\`\`

### 5. Enrichment Automatico

Ogni indicatore validato viene arricchito con:

**Per IPv4:**
- Geolocalizzazione (paese, città)
- ASN e ASN holder
- BGP prefix
- Abuse contact email
- VPN/Proxy detection
- Hosting provider

**Per Domini:**
- DNS resolution
- Certificate info
- WHOIS data
- Domain age
- Registrar info
- Category classification

### 6. Whitelist Management

Carica liste di domini trusted per evitare falsi positivi:

\`\`\`bash
# Upload whitelist CSV
curl -X POST "https://qmsidlazqaqwcptpsjqh.supabase.co/storage/v1/object/whitelists/alexa-top1m.csv" \
  -H "Authorization: Bearer your_jwt" \
  --data-binary @alexa-top1million.csv
\`\`\`

Supporta:
- Alexa Top 1M
- Cisco Umbrella Top 1M
- Majestic Million
- Custom lists

---

## 🚀 Performance & Caching

IntelGuard implementa un sistema di cache multi-layer per ridurre i tempi di risposta del 70%:

- **Layer 1 - In-Memory Cache**: LRU cache (60s TTL, 100 max keys) per ~90% hit rate
- **Layer 2 - Database Cache**: Tabella `validated_indicators_cache` (refresh ogni ora)
- **Layer 3 - HTTP Cache**: Headers `Cache-Control` per CDN caching (60s)

### Feature Flags
\`\`\`bash
ENABLE_FEED_CACHE=true        # In-memory cache (default: true)
FEED_CACHE_TTL_SEC=60         # Cache TTL in seconds
ENABLE_RATE_LIMIT=true        # Rate limiting per token
ENABLE_FEED_WARMUP=true       # Auto cache warming
PERF_LOG=false                # Performance logging
\`\`\`

**Performance Targets (p95):**
- Feed API (cache hit): ≤150ms
- Feed API (cache miss): ≤400ms
- Dashboard load: ≤2s
- DB queries/min: -60% reduction

Per dettagli completi, vedi [PERFORMANCE.md](PERFORMANCE.md)

---

## 🔧 Configuration

### Environment Variables (Auto-Configurate)

\`\`\`bash
# Supabase (già configurato da Lovable Cloud)
VITE_SUPABASE_URL=https://qmsidlazqaqwcptpsjqh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
VITE_SUPABASE_PROJECT_ID=qmsidlazqaqwcptpsjqh

# API Keys (configurate via Supabase Secrets)
# Non serve .env locale, sono gestite nel backend
\`\`\`

### API Keys Setup

Le chiavi API sono gestite come **Supabase Secrets** (sicure, non in codice):

\`\`\`sql
-- Lista secrets configurati
SELECT name FROM vault.secrets;

-- Secrets necessari:
ABUSEIPDB_API_KEY
VIRUSTOTAL_API_KEY
OTX_API_KEY
GOOGLE_SAFEBROWSING_API_KEY
URLSCAN_API_KEY
HONEYDB_API_KEY
HONEYDB_API_ID
NEUTRINOAPI_API_KEY
NEUTRINOAPI_USER_ID
CENSYS_API_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_URLSCAN_API_KEY
CF_RADAR_TOKEN
RESEND_API_KEY (per email reports)
\`\`\`

**Come Aggiungere Secrets:**
Usa Lovable Cloud Backend UI → Secrets Management

---

## 📈 Monitoring & Logging

### Network Activity Dashboard

Ogni chiamata API esterna è loggata in `network_activity_log`:

\`\`\`sql
SELECT 
  target_name,
  COUNT(*) as calls,
  AVG(response_time_ms) as avg_latency,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
FROM network_activity_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY target_name;
\`\`\`

### Cron Job Status

Monitora l'esecuzione dei job automatici:

\`\`\`sql
SELECT 
  jobname,
  schedule,
  last_run_start,
  last_status,
  last_error
FROM cron_job_status
ORDER BY last_run_start DESC;
\`\`\`

### Audit Logs

Traccia operazioni admin e sistema:

\`\`\`sql
SELECT 
  operation_name,
  user_id,
  status,
  execution_time_ms,
  created_at
FROM system_audit_logs
WHERE operation_type = 'validation'
ORDER BY created_at DESC
LIMIT 100;
\`\`\`

---

## 🐛 Troubleshooting

### Problema: Nessun Indicatore Validato

**Sintomo**: Dashboard mostra 0 indicatori validati

**Causa**: Backfill non completato o validatori non eseguiti

**Soluzione**:
\`\`\`sql
-- 1. Verifica backfill status
SELECT COUNT(*) FROM dynamic_raw_indicators;

-- 2. Trigger backfill manuale
SELECT priority_backfill_domains(10000);

-- 3. Verifica cron jobs attivi
SELECT * FROM cron_job_status WHERE active = true;

-- 4. Trigger validazione manuale (da backend)
-- Invoke edge function: trigger-domain-validation
\`\`\`

### Problema: API Rate Limit Exceeded

**Sintomo**: Errore "quota_exceeded" nei log

**Causa**: Troppi indicatori processati in breve tempo

**Soluzione**:
\`\`\`sql
-- Verifica quota AbuseIPDB
SELECT * FROM abuseipdb_quota WHERE date = CURRENT_DATE;

-- Verifica quota Censys
SELECT * FROM censys_monthly_usage 
WHERE month = DATE_TRUNC('month', CURRENT_DATE);

-- Disabilita temporaneamente validator problematico
UPDATE validator_status 
SET status = 'paused' 
WHERE validator_name = 'abuseipdb';
\`\`\`

### Problema: Cron Job Non Eseguito

**Sintomo**: `last_run_start` non aggiornato

**Causa**: Edge function fallisce o timeout

**Soluzione**:
\`\`\`sql
-- Controlla errori cron
SELECT jobname, last_error, last_status
FROM cron_job_status
WHERE last_status = 'failed';

-- Verifica edge function logs (via Lovable Backend UI)
-- Re-schedule job se necessario
SELECT cron.unschedule('job_name');
SELECT cron.schedule(
  'job_name',
  '*/5 * * * *',
  $$ SELECT _call_edge('function_name') $$
);
\`\`\`

### Problema: Feed API Restituisce 401

**Sintomo**: Client riceve "Invalid token"

**Causa**: Token non valido, disabilitato o scaduto

**Soluzione**:
\`\`\`sql
-- Verifica token esistente
SELECT id, type, enabled, created_at
FROM feed_tokens
WHERE token = 'your-token-uuid';

-- Riattiva token se disabilitato
UPDATE feed_tokens
SET enabled = true
WHERE token = 'your-token-uuid';

-- Genera nuovo token
INSERT INTO feed_tokens (type, customer_id, tenant_id)
VALUES ('ipv4', 'customer-uuid', 'tenant-uuid')
RETURNING token;
\`\`\`

### Problema: Lentezza Dashboard

**Sintomo**: Caricamento dashboard > 5 secondi

**Causa**: Query su tabelle grandi senza indici

**Soluzione**:
\`\`\`sql
-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY validator_stats_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY raw_indicator_stats_mv;

-- Verifica indici
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename IN ('dynamic_raw_indicators', 'validated_indicators');

-- Vacuum tabelle grandi
VACUUM ANALYZE dynamic_raw_indicators;
VACUUM ANALYZE validated_indicators;
\`\`\`

### Problema: Out of Memory (OOM) su Edge Function

**Sintomo**: Edge function termina senza risposta

**Causa**: Batch troppo grande processato in memoria

**Soluzione**:
\`\`\`typescript
// Riduci batch size nelle funzioni
const BATCH_SIZE = 100; // Era 1000

// Usa streaming per grandi dataset
for await (const batch of getBatchIterator(indicators, BATCH_SIZE)) {
  await processBatch(batch);
  await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
}
\`\`\`

---

## 🔒 Security Best Practices

### Row-Level Security (RLS)

Tutte le tabelle hanno RLS abilitato:

\`\`\`sql
-- Solo super admin può vedere raw_indicators
CREATE POLICY "super_admin_can_view_raw_indicators"
ON raw_indicators FOR SELECT
USING (is_super_admin(auth.uid()));

-- Tenant members possono vedere solo i propri feed tokens
CREATE POLICY "tenant_members_view_own_tokens"
ON feed_tokens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_members tm
    WHERE tm.tenant_id = feed_tokens.tenant_id
    AND tm.user_id = auth.uid()
  )
);
\`\`\`

### API Token Rotation

Ruota feed tokens periodicamente:

\`\`\`sql
-- Disabilita vecchi token
UPDATE feed_tokens
SET enabled = false
WHERE created_at < NOW() - INTERVAL '90 days';

-- Genera nuovi token per clienti attivi
INSERT INTO feed_tokens (type, customer_id, tenant_id)
SELECT 'ipv4', id, tenant_id
FROM customers
WHERE active = true;
\`\`\`

### Rate Limiting

Implementato a livello edge function:

\`\`\`typescript
// Check rate limit per IP
const rateLimitKey = `feed:${clientIP}:${Date.now() / 60000}`;
const requestCount = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 60);

if (requestCount > 60) { // 60 req/min
  return new Response('Rate limit exceeded', { status: 429 });
}
\`\`\`

---

## 📚 FAQ

**Q: Quanti indicatori può gestire il sistema?**
A: Scalabile fino a 10M+ indicatori. Attualmente gestisce ~65K domini e ~50K IPv4.

**Q: Come aggiungo una nuova fonte di threat intelligence?**
A: Dashboard → Ingest Sources → Aggiungi Sorgente. Supporta HTTP(S), auto-fetch periodico.

**Q: Posso esporre i feed via mio dominio custom?**
A: Sì, usa reverse proxy (nginx/Cloudflare) per mascherare URL Supabase.

**Q: Come gestisco falsi positivi?**
A: Carica whitelist CSV o usa UI Whitelist Management per escludere domini trusted.

**Q: Supporta IPv6?**
A: Al momento solo IPv4 e Domini. IPv6 in roadmap.

**Q: Come ottengo supporto?**
A: GitHub Issues, email a support@intelguard.io, o Slack community.

---

## 🛠️ Development

### Testing Strategy

\`\`\`bash
# Unit tests (TBD)
npm run test

# E2E tests con Playwright (TBD)
npm run test:e2e

# Linting
npm run lint

# Type checking
npm run type-check
\`\`\`

### Database Migrations

\`\`\`bash
# Lista migrazioni
ls supabase/migrations/

# Crea nuova migration
supabase migration new migration_name

# Applica migration (automatico su deploy)
\`\`\`

### Edge Functions Local Testing

\`\`\`bash
# Serve edge function localmente
supabase functions serve function-name --env-file .env.local

# Test con curl
curl http://localhost:54321/functions/v1/function-name \
  -H "Authorization: Bearer test_token"
\`\`\`

---

## 📦 Deployment

### Production Deploy

\`\`\`bash
# Via Lovable.dev (automatico)
git push origin main
# Deploy avviene automaticamente

# Oppure da Lovable UI
# Click "Publish" button → Deploy to Production
\`\`\`

### Environment-Specific Config

\`\`\`typescript
// Production: API caching abilitato
const CACHE_TTL = 3600; // 1 hour

// Staging: Cache disabilitato per testing
const CACHE_TTL = 0;
\`\`\`

### Backup Strategy

\`\`\`sql
-- Snapshot giornaliero automatico
-- Backup rotazione 7 giorni
-- Restore point-in-time available

-- Manual backup trigger
SELECT snapshot_validated_indicators_to_cache();
\`\`\`

---

## 🗺️ Roadmap

- [ ] **IPv6 Support**: Validazione e feed IPv6
- [ ] **GraphQL API**: Alternativa REST per query complesse
- [ ] **ML Threat Scoring**: Scoring basato su machine learning
- [ ] **Threat Hunting**: Query builder avanzato per SOC
- [ ] **STIX/TAXII Export**: Formati standard CTI
- [ ] **Webhook Notifications**: Alert real-time su nuovi threat
- [ ] **Custom Validators**: API per validatori proprietari
- [ ] **Mobile App**: Dashboard iOS/Android

---

## 📄 License

MIT License - vedi [LICENSE](LICENSE) file

---

## 👥 Contributors

Sviluppato con ❤️ da **IntelGuard Team**

- [GitHub Repository](https://github.com/yourusername/intelguard)
- [Documentation](https://docs.intelguard.io)
- [API Reference](https://api.intelguard.io/docs)

---

## 🙏 Acknowledgments

- **Lovable.dev**: Piattaforma di sviluppo
- **Supabase**: Backend infrastructure
- **shadcn/ui**: Component library
- Threat Intelligence providers: AbuseIPDB, VirusTotal, AlienVault OTX, etc.

---

**[⬆ Back to Top](#intelguard-)**
