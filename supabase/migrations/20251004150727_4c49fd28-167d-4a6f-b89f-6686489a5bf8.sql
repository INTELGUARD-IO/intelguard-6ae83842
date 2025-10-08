-- Add columns to track whitelist cross-validation status
ALTER TABLE public.dynamic_raw_indicators 
ADD COLUMN IF NOT EXISTS whitelisted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whitelist_source text DEFAULT NULL;

-- Create index for whitelist queries
CREATE INDEX IF NOT EXISTS idx_dynamic_raw_indicators_whitelisted 
ON public.dynamic_raw_indicators(whitelisted);

-- Add comments
COMMENT ON COLUMN public.dynamic_raw_indicators.whitelisted IS 'True if indicator found in Cisco or Cloudflare whitelist';
COMMENT ON COLUMN public.dynamic_raw_indicators.whitelist_source IS 'Source of whitelist: cisco, cloudflare, or both';
