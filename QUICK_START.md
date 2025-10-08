# 🚀 INTELGUARD - Quick Start Guide

## ✅ Cosa è stato completato

INTELGUARD è ora completamente funzionale con:

### 1. **Sistema di Autenticazione Multi-tenant**
- Login/Sign-up per clienti e MSP
- Protezione automatica delle route
- Sistema di ruoli: superadmin, msp_admin, msp_user, customer

### 2. **Feed Ingestion System**
- 70+ feed sources configurati
- Parser intelligente (plain text, CSV, JSON)
- CRON jobs automatici ogni 30 secondi
- Deduplicazione automatica

### 3. **Validation Engine**
- Rate limiter intelligente per gestire quote API
- Validators: AbuseIPDB, Google Safe Browsing, OTX
- Sistema di consensus voting pesato
- Priority queue per ottimizzare le validazioni

### 4. **Dashboard Real-time**
- Statistiche live con auto-refresh ogni 15 secondi
- Visualizzazione raw indicators
- Visualizzazione validated indicators
- Stato feed e CRON jobs

### 5. **Admin Panel (Solo Superadmin)**
- Gestione utenti
- Gestione feed sources
- Sezione Debug con operazioni avanzate

---

## 🎯 Come testare la Preview

### Step 1: Visualizza la Landing Page
La preview dovrebbe ora mostrare la landing page di INTELGUARD con:
- Hero section con descrizione della piattaforma
- Feature cards (Multi-source Intelligence, Real-time Validation, etc.)
- CTA per Login/Sign-up

### Step 2: Inizializza il Database
Prima di poter usare l'app, devi eseguire gli script SQL:

1. **Vai su Supabase Dashboard** → SQL Editor
2. **Esegui `scripts/01-init-feed-sources.sql`** per popolare i feed sources
3. **Registrati** con la tua email su `/auth/sign-up`
4. **Esegui `scripts/02-create-superadmin.sql`** (sostituisci `your-email@example.com` con la tua email)
5. **Aggiungi `SUPERADMIN_EMAIL`** nelle environment variables su Vercel

### Step 3: Testa il Sistema
1. **Login** con il tuo account superadmin
2. **Dashboard** → Vedi le statistiche (saranno a 0 inizialmente)
3. **Feeds** → Trigger manuale del fetch per popolare i raw indicators
4. **Admin** → Gestisci utenti e feed sources
5. **Debug** → Monitora CRON jobs, validators, database stats

---

## 🔧 Configurazione Environment Variables

Assicurati di avere tutte queste variabili configurate su Vercel:

### Supabase (già configurate)
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### API Keys per Validators
- `GOOGLE_SAFE_BROWSING_API_KEY` - [Get API Key](https://developers.google.com/safe-browsing/v4/get-started)
- `OTX_API_KEY` - [Get API Key](https://otx.alienvault.com/)
- `ABUSEIPDB_API_KEY` - [Get API Key](https://www.abuseipdb.com/api)

### Security
- `CRON_SECRET` - Token casuale per proteggere CRON endpoints
- `SUPERADMIN_EMAIL` - La tua email per accesso superadmin

### Vercel (auto-configurate)
- `NEXT_PUBLIC_VERCEL_URL`
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`

---

## 📊 Architettura del Sistema

\`\`\`
Feed Sources (70+)
    ↓
Raw Indicators (raw_indicators table)
    ↓
Ingest Buffer (deduplicazione)
    ↓
Validation Engine (consensus voting)
    ↓
Dynamic Indicators (dynamic_raw_indicators)
    ↓
Validated Indicators (validated_indicators)
\`\`\`

### CRON Jobs Configurati
- **fetch-feeds**: Ogni 30 secondi - Scarica nuovi indicators dai feed
- **deduplicate**: Ogni 5 minuti - Rimuove duplicati dall'ingest buffer
- **validate**: Ogni minuto - Valida 10 indicators rispettando rate limits

---

## 🐛 Troubleshooting

### La preview mostra errori Supabase
✅ **RISOLTO** - Il middleware ora è semplificato e non dipende da Supabase in Edge Runtime

### Non vedo dati nella dashboard
- Esegui lo script `01-init-feed-sources.sql` per popolare i feed
- Vai su `/dashboard/feeds` e clicca "Trigger Feed Fetch" per popolare manualmente
- Aspetta che i CRON jobs girino (o triggera manualmente da `/admin/debug`)

### Non riesco ad accedere alla sezione Admin
- Verifica di aver eseguito `02-create-superadmin.sql` con la tua email
- Verifica che `SUPERADMIN_EMAIL` sia configurato su Vercel
- Fai logout e login di nuovo

### I CRON jobs non girano
- Verifica che `CRON_SECRET` sia configurato
- I CRON jobs di Vercel girano solo in production, non in preview
- Usa la sezione Debug per triggerare manualmente i job

---

## 🚀 Deploy in Production

1. **Push to GitHub** (usa il bottone GitHub nella UI di v0)
2. **Deploy su Vercel** (usa il bottone "Publish")
3. **Configura tutte le environment variables** su Vercel
4. **Esegui gli script SQL** su Supabase
5. **I CRON jobs partiranno automaticamente** in production

---

## 📝 Prossimi Passi

1. ✅ Testare la preview della landing page
2. ✅ Eseguire gli script SQL per inizializzare il database
3. ✅ Registrarsi e promuoversi a superadmin
4. ✅ Testare il fetch dei feed e la validazione
5. ✅ Deploy in production per attivare i CRON jobs automatici

---

## 💡 Note Importanti

- **Preview vs Production**: I CRON jobs di Vercel girano solo in production, non in preview/development
- **Rate Limits**: Il sistema rispetta automaticamente i rate limits di ogni validator
- **Consensus Voting**: Un indicator è considerato malevolo se raggiunge almeno 6 punti nel sistema di voting pesato
- **Multi-tenancy**: Ogni tenant (MSP o customer) vede solo i propri dati grazie a Row Level Security (RLS)

---

Buon testing! 🎉
