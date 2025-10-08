-- Script di diagnostica e fix per Superadmin
-- Questo script ti aiuta a capire cosa c'è nel database e a promuoverti a superadmin

-- STEP 1: Mostra tutti gli utenti registrati in auth.users
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- STEP 2: Mostra tutti i profili esistenti
-- Rimosso tenant_id che non esiste in profiles
SELECT 
  id,
  email,
  role,
  created_at,
  updated_at
FROM profiles
ORDER BY created_at DESC;

-- STEP 3: Mostra i tenant esistenti
SELECT 
  id,
  name,
  type,
  owner_user_id,
  created_at
FROM tenants
ORDER BY created_at DESC;

-- STEP 4: Mostra le relazioni tenant_members
SELECT 
  tm.user_id,
  tm.tenant_id,
  tm.role as tenant_role,
  p.email,
  p.role as profile_role,
  t.name as tenant_name
FROM tenant_members tm
LEFT JOIN profiles p ON tm.user_id = p.id
LEFT JOIN tenants t ON tm.tenant_id = t.id
ORDER BY tm.created_at DESC;

-- STEP 5: Crea o aggiorna il profilo a superadmin
-- IMPORTANTE: Sostituisci 'tua-email@example.com' con la tua email reale

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'tua-email@example.com'; -- <-- CAMBIA QUESTA EMAIL
  v_tenant_id uuid;
BEGIN
  -- Trova l'ID utente da auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ERRORE: Nessun utente trovato con email %', v_email;
    RAISE NOTICE 'Verifica che l''email sia corretta e che l''utente sia registrato';
    RETURN;
  END IF;

  RAISE NOTICE 'Utente trovato: % (ID: %)', v_email, v_user_id;

  -- Trova o crea un tenant per il superadmin
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE owner_user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Crea tenant con owner_user_id invece di usare tenant_id in profiles
    INSERT INTO tenants (name, type, owner_user_id)
    VALUES ('SuperAdmin Organization', 'customer', v_user_id)
    RETURNING id INTO v_tenant_id;
    RAISE NOTICE 'Tenant creato: SuperAdmin Organization (ID: %)', v_tenant_id;
  ELSE
    RAISE NOTICE 'Tenant esistente trovato (ID: %)', v_tenant_id;
  END IF;

  -- Crea o aggiorna il profilo SENZA tenant_id
  INSERT INTO profiles (id, email, role)
  VALUES (v_user_id, v_email, 'superadmin')
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = 'superadmin',
    email = v_email,
    updated_at = now();

  RAISE NOTICE 'Profilo aggiornato con successo! Ruolo: superadmin';

  -- Crea o aggiorna la relazione in tenant_members
  INSERT INTO tenant_members (user_id, tenant_id, role)
  VALUES (v_user_id, v_tenant_id, 'owner')
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET role = 'owner';

  RAISE NOTICE 'Relazione tenant_members creata/aggiornata';
  
  -- Verifica finale
  DECLARE
    v_role text;
  BEGIN
    SELECT role INTO v_role
    FROM profiles
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Verifica finale - Ruolo attuale: %', v_role;
  END;
END $$;

-- STEP 6: Verifica finale - mostra il tuo profilo completo
-- IMPORTANTE: Sostituisci 'tua-email@example.com' con la tua email reale
-- Rimosso join con tenant_id, ora usa tenant_members
SELECT 
  p.id,
  p.email,
  p.role,
  p.created_at,
  p.updated_at,
  t.name as tenant_name,
  t.type as tenant_type,
  tm.role as tenant_role
FROM profiles p
LEFT JOIN tenant_members tm ON p.id = tm.user_id
LEFT JOIN tenants t ON tm.tenant_id = t.id
WHERE p.email = 'tua-email@example.com'; -- <-- CAMBIA QUESTA EMAIL
