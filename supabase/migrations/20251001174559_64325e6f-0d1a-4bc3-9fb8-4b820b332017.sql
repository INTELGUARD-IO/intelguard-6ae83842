-- Create email_preferences table
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  freq text NOT NULL CHECK (freq IN ('daily', 'weekly', 'monthly')) DEFAULT 'monthly',
  type text NOT NULL CHECK (type IN ('ipv4', 'domains')) DEFAULT 'ipv4',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- Create index for efficient querying by frequency
CREATE INDEX IF NOT EXISTS idx_email_preferences_freq ON public.email_preferences(freq);

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER set_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies: Users can manage their own preferences
CREATE POLICY "Users can view their own email preferences"
  ON public.email_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences"
  ON public.email_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email preferences"
  ON public.email_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
