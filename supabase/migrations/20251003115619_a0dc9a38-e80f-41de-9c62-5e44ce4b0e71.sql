-- Create system_audit_logs table
CREATE TABLE public.system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_name text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('manual_run', 'cron_run')),
  description text,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  execution_time_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create index for faster queries
CREATE INDEX idx_system_audit_logs_user_id ON public.system_audit_logs(user_id);
CREATE INDEX idx_system_audit_logs_created_at ON public.system_audit_logs(created_at DESC);
CREATE INDEX idx_system_audit_logs_operation_name ON public.system_audit_logs(operation_name);

-- Enable RLS
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all logs
CREATE POLICY "super_admin_full_access_system_audit_logs"
ON public.system_audit_logs
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Users can view their own logs
CREATE POLICY "users_can_view_own_logs"
ON public.system_audit_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can insert logs (for their operations)
CREATE POLICY "users_can_insert_own_logs"
ON public.system_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own logs (to set completion status)
CREATE POLICY "users_can_update_own_logs"
ON public.system_audit_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);