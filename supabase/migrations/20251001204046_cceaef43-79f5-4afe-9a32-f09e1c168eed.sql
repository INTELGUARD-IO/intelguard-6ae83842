-- Enable RLS on indicator_snapshots table
ALTER TABLE indicator_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow tenant members to read snapshots
CREATE POLICY "indicator_snapshots_select" 
ON indicator_snapshots 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenant_members tm 
    WHERE tm.user_id = auth.uid()
  )
);
