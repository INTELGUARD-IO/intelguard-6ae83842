-- FASE 1: Tabella domain_resolutions per cache DNS con TTL

-- Crea tabella domain_resolutions
CREATE TABLE IF NOT EXISTS public.domain_resolutions (
  domain TEXT NOT NULL,
  resolved_ip TEXT NOT NULL,
  country TEXT,
  asn TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ttl INTEGER NOT NULL DEFAULT 3600,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolver_source TEXT NOT NULL DEFAULT 'cloudflare-doh',
  PRIMARY KEY (domain, resolved_at)
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_domain_resolutions_domain ON public.domain_resolutions(domain);
CREATE INDEX IF NOT EXISTS idx_domain_resolutions_expires_at ON public.domain_resolutions(expires_at);

-- Funzione per pulizia cache scaduta
CREATE OR REPLACE FUNCTION public.clean_expired_domain_resolutions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.domain_resolutions WHERE expires_at < NOW();
END;
$function$;

-- RLS policies
ALTER TABLE public.domain_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_domain_resolutions"
ON public.domain_resolutions
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_domain_resolutions"
ON public.domain_resolutions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM tenant_members
  WHERE tenant_members.user_id = auth.uid()
));
