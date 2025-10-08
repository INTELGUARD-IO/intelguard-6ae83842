-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "super_admin_full_access_validated_indicators_cache" ON public.validated_indicators_cache;
DROP POLICY IF EXISTS "tenant_members_can_view_validated_indicators_cache" ON public.validated_indicators_cache;

-- Recreate RLS policies
CREATE POLICY "super_admin_full_access_validated_indicators_cache"
  ON public.validated_indicators_cache
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_validated_indicators_cache"
  ON public.validated_indicators_cache
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_members.user_id = auth.uid()
  ));

-- Unschedule existing cron job if it exists
SELECT cron.unschedule('validated-indicators-cache-hourly');

-- Create cron job to run hourly snapshots (24 times per day)
SELECT cron.schedule(
  'validated-indicators-cache-hourly',
  '0 * * * *',
  $$SELECT snapshot_validated_indicators_to_cache()$$
);
