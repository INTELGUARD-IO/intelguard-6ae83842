-- Create neutrinoapi_blocklist table
CREATE TABLE public.neutrinoapi_blocklist (
  indicator text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'ipv4',
  category text,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval)
);

-- Create index for faster queries
CREATE INDEX idx_neutrinoapi_blocklist_expires_at ON public.neutrinoapi_blocklist(expires_at);

-- Enable RLS
ALTER TABLE public.neutrinoapi_blocklist ENABLE ROW LEVEL SECURITY;

-- Super admins can manage blocklist
CREATE POLICY "super_admin_full_access_neutrinoapi_blocklist"
ON public.neutrinoapi_blocklist
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Tenant members can view blocklist
CREATE POLICY "tenant_members_can_view_neutrinoapi_blocklist"
ON public.neutrinoapi_blocklist
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM tenant_members
  WHERE tenant_members.user_id = auth.uid()
));

-- Add NeutrinoAPI columns to dynamic_raw_indicators
ALTER TABLE public.dynamic_raw_indicators 
ADD COLUMN neutrinoapi_checked boolean NOT NULL DEFAULT false,
ADD COLUMN neutrinoapi_in_blocklist boolean,
ADD COLUMN neutrinoapi_host_reputation_score integer,
ADD COLUMN neutrinoapi_is_proxy boolean,
ADD COLUMN neutrinoapi_is_vpn boolean,
ADD COLUMN neutrinoapi_is_hosting boolean,
ADD COLUMN neutrinoapi_metadata jsonb;

-- Create cleanup function
CREATE OR REPLACE FUNCTION public.clean_expired_neutrinoapi_blocklist()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM neutrinoapi_blocklist
  WHERE expires_at < NOW();
END;
$$;

-- Schedule NeutrinoAPI validator cron job (every 12 hours at 04:00 and 16:00 UTC)
SELECT cron.schedule(
  'neutrinoapi-validator-job',
  '0 4,16 * * *',
  $$ SELECT _call_edge('neutrinoapi-validator'); $$
);
