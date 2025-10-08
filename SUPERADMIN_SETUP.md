# 🔐 Superadmin Setup Guide

Questa guida ti spiega come configurare il tuo account superadmin esclusivo per INTELGUARD.

## Step 1: Configura la variabile d'ambiente

Aggiungi la tua email come variabile d'ambiente su Vercel:

\`\`\`bash
SUPERADMIN_EMAIL=tua-email@example.com
\`\`\`

**Importante:** Questa email identifica il superadmin. Solo l'utente con questa email avrà accesso alla sezione Debug.

## Step 2: Registrati sulla piattaforma

1. Vai su `/auth/sign-up`
2. Registrati con la **stessa email** che hai configurato in `SUPERADMIN_EMAIL`
3. Conferma la tua email (controlla la inbox)

## Step 3: Promuovi il tuo account a superadmin

1. Vai su Supabase SQL Editor
2. Apri il file `scripts/02-create-superadmin.sql`
3. **Sostituisci** `'tua-email@example.com'` con la tua email reale
4. Esegui lo script

\`\`\`sql
DO $$
DECLARE
  user_email TEXT := 'tua-email@example.com'; -- <-- CAMBIA QUESTA
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Sign up first!';
  END IF;
  
  UPDATE profiles SET role = 'superadmin' WHERE id = user_id;
  
  RAISE NOTICE 'User promoted to superadmin!';
END $$;
\`\`\`

## Step 4: Verifica l'accesso

1. Fai logout e login di nuovo
2. Dovresti vedere:
   - Badge **SUPERADMIN** rosso nella navbar
   - Link **Debug** nella navigation
3. Vai su `/admin/debug` per accedere al pannello di debug

## 🎯 Cosa puoi fare come Superadmin

### Sezione Debug (`/admin/debug`)

**Database Tab:**
- Statistiche in tempo reale di tutte le tabelle
- Conteggio raw indicators, buffer, validated indicators
- Numero di feed sources e utenti

**CRON Jobs Tab:**
- Stato di tutti i CRON jobs
- Ultimo run e status (success/error)
- **Trigger manuale** di qualsiasi CRON job
- Visualizzazione errori

**Validators Tab:**
- Stato operativo di ogni validator
- Requests giornaliere e success rate
- Quota usage per API

**Logs Tab:**
- Ultimi 50 validation results
- Dettagli su ogni validazione
- Indicatori malicious vs clean

### Sezione Admin (`/admin`)

- Gestione utenti (CRUD)
- Gestione feed sources
- Assegnazione ruoli
- Visualizzazione tenant e MSP

## 🔒 Sicurezza

- **Solo tu** puoi accedere a `/admin/debug`
- L'accesso è verificato tramite `SUPERADMIN_EMAIL`
- Anche altri utenti con role `superadmin` nel database NON possono accedere se la loro email non corrisponde
- Tutti gli endpoint debug richiedono la funzione `requireSuperAdmin()`

## 🚨 Troubleshooting

**Non vedo il link Debug:**
- Verifica che `SUPERADMIN_EMAIL` sia configurato su Vercel
- Fai logout e login di nuovo
- Controlla che la tua email corrisponda esattamente

**Errore "Unauthorized":**
- Verifica che il tuo account sia stato promosso a superadmin nel database
- Controlla che `SUPERADMIN_EMAIL` corrisponda alla tua email

**CRON trigger non funziona:**
- Verifica che `CRON_SECRET` sia configurato
- Controlla i logs su Vercel per errori

## 📝 Note

- Puoi avere **un solo superadmin** (quello con l'email in `SUPERADMIN_EMAIL`)
- Altri utenti possono avere role `superadmin` nel database per accedere a `/admin`, ma solo tu puoi accedere a `/admin/debug`
- Il sistema è progettato per massima sicurezza: backend operations solo per te
