-- Create network_activity_log table for real-time HTTP call tracking
CREATE TABLE public.network_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  
  -- Connection info
  call_type text NOT NULL CHECK (call_type IN ('ingest', 'validator', 'api_call')),
  target_url text NOT NULL,
  target_name text NOT NULL,
  
  -- Request details
  method text NOT NULL DEFAULT 'GET',
  request_headers jsonb,
  
  -- Response details
  status_code integer,
  response_time_ms integer,
  bytes_transferred bigint,
  
  -- Processing stats
  items_processed integer DEFAULT 0,
  items_total integer,
  
  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'timeout')),
  error_message text,
  
  -- Metadata
  user_id uuid REFERENCES auth.users(id),
  edge_function_name text,
  metadata jsonb
);

-- Indexes for performance
CREATE INDEX idx_network_activity_status ON network_activity_log(status, started_at DESC);
CREATE INDEX idx_network_activity_call_type ON network_activity_log(call_type);
CREATE INDEX idx_network_activity_started ON network_activity_log(started_at DESC);

-- Enable RLS
ALTER TABLE public.network_activity_log ENABLE ROW LEVEL SECURITY;

-- Policies: Super admin full access
CREATE POLICY "super_admin_full_access_network_activity_log"
ON public.network_activity_log
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.network_activity_log;
