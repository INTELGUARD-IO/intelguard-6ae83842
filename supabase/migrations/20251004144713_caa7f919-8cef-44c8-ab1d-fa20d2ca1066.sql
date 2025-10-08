-- Create validator_status table for tracking validator states
CREATE TABLE IF NOT EXISTS public.validator_status (
  validator_name TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  quota_reset_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.validator_status ENABLE ROW LEVEL SECURITY;

-- Super admin can manage validator status
CREATE POLICY "super_admin_full_access_validator_status"
ON public.validator_status
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Tenant members can view validator status
CREATE POLICY "tenant_members_can_view_validator_status"
ON public.validator_status
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at_validator_status
  BEFORE UPDATE ON public.validator_status
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
