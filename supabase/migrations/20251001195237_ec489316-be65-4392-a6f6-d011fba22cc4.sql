-- Fix infinite recursion in tenant_members RLS policies
-- Use a security definer function to avoid recursion

-- Create security definer function to check tenant membership
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  )
$$;

-- Drop old policies
DROP POLICY IF EXISTS "tenant_members_insert" ON public.tenant_members;
DROP POLICY IF EXISTS "tenant_members_select" ON public.tenant_members;
DROP POLICY IF EXISTS "tenant_members_update" ON public.tenant_members;

-- Create new policies using the security definer function
CREATE POLICY "tenant_members_insert" 
ON public.tenant_members 
FOR INSERT 
WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id)
  OR NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id = tenant_members.tenant_id)
);

CREATE POLICY "tenant_members_select" 
ON public.tenant_members 
FOR SELECT 
USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "tenant_members_update" 
ON public.tenant_members 
FOR UPDATE 
USING (public.is_tenant_member(auth.uid(), tenant_id));
