-- Add RLS policies for tenant members to view indicators and related data

-- Policy for raw_indicators
CREATE POLICY "tenant_members_can_view_raw_indicators" 
ON raw_indicators FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy for validated_indicators
CREATE POLICY "tenant_members_can_view_validated_indicators" 
ON validated_indicators FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy for daily_deltas
CREATE POLICY "tenant_members_can_view_daily_deltas" 
ON daily_deltas FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy for validation_jobs
CREATE POLICY "tenant_members_can_view_validation_jobs" 
ON validation_jobs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy for vendor_checks
CREATE POLICY "tenant_members_can_view_vendor_checks" 
ON vendor_checks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_members 
    WHERE user_id = auth.uid()
  )
);
