-- =====================================================
-- STORAGE-BASED WHITELIST SYSTEM MIGRATION
-- =====================================================
-- Creates Supabase Storage bucket for whitelist CSV files
-- and removes obsolete database tables

-- Step 1: Create public storage bucket for whitelist files
INSERT INTO storage.buckets (id, name, public)
VALUES ('whitelists', 'whitelists', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: RLS Policies for Storage bucket
-- Super admins can manage all files
CREATE POLICY "super_admin_can_manage_whitelists"
ON storage.objects FOR ALL
USING (
  bucket_id = 'whitelists' 
  AND is_super_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'whitelists' 
  AND is_super_admin(auth.uid())
);

-- Authenticated users can read whitelist files (for cross-validator)
CREATE POLICY "authenticated_can_read_whitelists"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'whitelists' 
  AND auth.role() = 'authenticated'
);

-- Service role (edge functions) can read/write
CREATE POLICY "service_role_can_access_whitelists"
ON storage.objects FOR ALL
USING (bucket_id = 'whitelists' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'whitelists' AND auth.role() = 'service_role');

-- Step 3: Remove obsolete database tables
-- These are replaced by CSV files in Storage
DROP TABLE IF EXISTS public.cisco_umbrella_top_domains CASCADE;
DROP TABLE IF EXISTS public.cloudflare_radar_top_domains CASCADE;

-- Step 4: Remove cleanup functions for dropped tables
DROP FUNCTION IF EXISTS public.clean_expired_cisco_umbrella_domains() CASCADE;
DROP FUNCTION IF EXISTS public.clean_expired_cf_radar_domains() CASCADE;
