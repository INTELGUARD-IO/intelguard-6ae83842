-- Create function to check if user is super admin (app creator)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = '6a251925-6da6-4e88-a4c2-a5624308fe8e'::uuid
$$;

-- Update ingest_sources policies - only super admin can modify
DROP POLICY IF EXISTS "ingest_sources_all" ON public.ingest_sources;
DROP POLICY IF EXISTS "ingest_sources_select" ON public.ingest_sources;

CREATE POLICY "super_admin_can_manage_ingest_sources"
ON public.ingest_sources
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_ingest_sources"
ON public.ingest_sources
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM tenant_members tm
  WHERE tm.user_id = auth.uid()
));

-- Update raw_indicators policy - super admin can insert, others can only read
CREATE POLICY "super_admin_can_insert_raw_indicators"
ON public.raw_indicators
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

-- Grant super admin full access to all admin tables
CREATE POLICY "super_admin_full_access_validation_jobs"
ON public.validation_jobs
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_full_access_vendor_checks"
ON public.vendor_checks
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));