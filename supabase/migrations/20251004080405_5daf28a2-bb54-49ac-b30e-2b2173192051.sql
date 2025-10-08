-- Add super admin SELECT policies for tables that are missing them

-- raw_indicators: Add SELECT policy for super admin
CREATE POLICY "super_admin_can_view_raw_indicators"
ON public.raw_indicators
FOR SELECT
USING (is_super_admin(auth.uid()));

-- dynamic_raw_indicators: Add full access policy for super admin
CREATE POLICY "super_admin_full_access_dynamic_raw_indicators"
ON public.dynamic_raw_indicators
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- indicator_snapshots: Add full access policy for super admin
CREATE POLICY "super_admin_full_access_indicator_snapshots"
ON public.indicator_snapshots
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- daily_deltas: Add full access policy for super admin
CREATE POLICY "super_admin_full_access_daily_deltas"
ON public.daily_deltas
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- validated_indicators: Add full access policy for super admin
CREATE POLICY "super_admin_full_access_validated_indicators"
ON public.validated_indicators
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
