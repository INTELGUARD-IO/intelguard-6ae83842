-- Create ingest_logs table for detailed monitoring
CREATE TABLE IF NOT EXISTS public.ingest_logs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  source_id uuid NOT NULL,
  source_name text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  status text NOT NULL CHECK (status IN ('running', 'success', 'error', 'timeout')),
  indicators_fetched integer DEFAULT 0,
  error_message text,
  duration_ms integer,
  CONSTRAINT fk_source FOREIGN KEY (source_id) REFERENCES public.ingest_sources(id) ON DELETE CASCADE
);

-- Index for quick lookups
CREATE INDEX idx_ingest_logs_source_id ON public.ingest_logs(source_id);
CREATE INDEX idx_ingest_logs_started_at ON public.ingest_logs(started_at DESC);

-- RLS policies
ALTER TABLE public.ingest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access_ingest_logs"
  ON public.ingest_logs
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tenant_members_can_view_ingest_logs"
  ON public.ingest_logs
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tenant_members WHERE user_id = auth.uid()
  ));

-- Add priority field to ingest_sources for rotation
ALTER TABLE public.ingest_sources 
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS last_attempt timestamp with time zone;

COMMENT ON COLUMN public.ingest_sources.priority IS 'Priority for processing (0-100, higher = more important)';
COMMENT ON COLUMN public.ingest_sources.last_attempt IS 'Last time we attempted to fetch this source (success or failure)';
