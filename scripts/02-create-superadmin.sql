-- Script per creare il tuo account superadmin
-- IMPORTANTE: Sostituisci 'tua-email@example.com' con la tua email reale

-- Step 1: Prima devi registrarti normalmente tramite /auth/sign-up
-- Step 2: Poi esegui questo script per promuoverti a superadmin

-- Trova il tuo user ID (sostituisci con la tua email)
DO $$
DECLARE
  user_email TEXT := 'tua-email@example.com'; -- <-- CAMBIA QUESTA EMAIL
  user_id UUID;
BEGIN
  -- Trova l'ID utente dall'email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Please sign up first!', user_email;
  END IF;

  -- Aggiorna il profilo a superadmin
  UPDATE profiles
  SET role = 'superadmin'
  WHERE id = user_id;

  RAISE NOTICE 'User % promoted to superadmin successfully!', user_email;
END $$;

-- Verifica che il superadmin sia stato creato
SELECT 
  p.id,
  u.email,
  p.role,
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'superadmin';
