# INTELGUARD - Troubleshooting Guide

## Problema: "No rows returned" quando eseguo lo script superadmin

### Causa
Lo script non ha trovato un profilo con l'email specificata nel database.

### Soluzione

**Step 1: Esegui lo script di diagnostica**
1. Apri Supabase SQL Editor
2. Esegui lo script `scripts/03-diagnose-and-fix-superadmin.sql`
3. **IMPORTANTE**: Prima di eseguire, sostituisci `'tua-email@example.com'` con la tua email reale in DUE punti:
   - Riga 35: `v_email text := 'tua-email@example.com';`
   - Ultima query: `WHERE p.email = 'tua-email@example.com';`

**Step 2: Leggi i risultati**
Lo script ti mostrerà:
- Tutti gli utenti registrati in `auth.users`
- Tutti i profili esistenti in `profiles`
- Tutti i tenant esistenti
- Creerà/aggiornerà automaticamente il tuo profilo a superadmin
- Mostrerà una verifica finale del tuo profilo

**Step 3: Verifica l'email**
Se vedi "ERRORE: Nessun utente trovato con email...", significa che:
- L'email nello script non corrisponde a quella usata per la registrazione
- Controlla nella prima query (auth.users) quale email hai usato
- Aggiorna lo script con l'email corretta

**Step 4: Ricarica la pagina**
Dopo aver eseguito lo script con successo:
1. Fai logout se sei già loggato
2. Fai login di nuovo
3. Dovresti vedere il badge "SUPERADMIN" rosso nella navbar

---

## Problema: Non vedo il badge SUPERADMIN dopo il login

### Causa
La variabile d'ambiente `SUPERADMIN_EMAIL` non è configurata o non corrisponde alla tua email.

### Soluzione
1. Vai su Vercel → Project Settings → Environment Variables
2. Verifica che `SUPERADMIN_EMAIL` contenga esattamente la stessa email usata per la registrazione
3. Redeploy il progetto per applicare le modifiche
4. Fai logout e login di nuovo

---

## Problema: Errore "Missing Supabase environment variables"

### Causa
Le variabili d'ambiente Supabase non sono configurate correttamente.

### Soluzione
Verifica che queste variabili siano configurate su Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (per operazioni admin)

---

## Problema: I CRON jobs non si attivano

### Causa
Il `CRON_SECRET` non è configurato o Vercel CRON non è attivo.

### Soluzione
1. Verifica che `CRON_SECRET` sia configurato nelle environment variables
2. Vai su Vercel → Project → Cron Jobs
3. Verifica che i CRON jobs siano attivi
4. Puoi testare manualmente i CRON dalla sezione `/admin/debug` (solo superadmin)

---

## Problema: I feed non vengono scaricati

### Causa
I feed sources non sono stati inizializzati nel database.

### Soluzione
1. Esegui lo script `scripts/01-init-feed-sources.sql` in Supabase SQL Editor
2. Verifica che i feed siano stati creati: `SELECT * FROM feed_sources;`
3. Trigger manualmente il fetch dalla sezione `/admin/debug` → CRON Jobs → "Trigger Fetch Feeds"

---

## Problema: Le validazioni non funzionano

### Causa
Le API keys dei validator non sono configurate.

### Soluzione
Verifica che queste variabili siano configurate:
- `ABUSEIPDB_API_KEY`
- `GOOGLE_SAFE_BROWSING_API_KEY`
- `OTX_API_KEY`

Puoi verificare lo stato dei validator dalla sezione `/admin/debug` → Validators Status

---

## Debug Generale

### Controllare i log
1. Vai su `/admin/debug` (solo superadmin)
2. Controlla le varie sezioni:
   - **Database Stats**: statistiche generali
   - **CRON Jobs**: stato e trigger manuali
   - **Validators Status**: stato delle API e quote
   - **Validation Logs**: ultimi 50 log di validazione

### Verificare RLS (Row Level Security)
Se non vedi dati nella dashboard:
1. Verifica di essere loggato
2. Verifica che il tuo profilo abbia un `tenant_id` valido
3. Controlla che le policy RLS siano configurate correttamente in Supabase

### Contattare il supporto
Se i problemi persistono:
1. Raccogli i log dalla sezione `/admin/debug`
2. Verifica le environment variables
3. Controlla i log di Vercel per errori runtime
