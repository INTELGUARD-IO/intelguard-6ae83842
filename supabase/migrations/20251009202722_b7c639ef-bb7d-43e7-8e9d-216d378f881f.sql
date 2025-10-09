-- Function to resume all validators and re-create cron jobs
CREATE OR REPLACE FUNCTION public.resume_all_validators()
RETURNS TABLE(jobname TEXT, action TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, cron
AS $function$
BEGIN
  -- Re-create all validator cron jobs
  
  -- Intelligent validators
  PERFORM cron.schedule(
    'intelligent-validator-ips',
    '*/30 * * * *',
    'SELECT _call_edge(''intelligent-validator'')'
  );
  
  PERFORM cron.schedule(
    'intelligent-validator-domains',
    '*/30 * * * *',
    'SELECT _call_edge(''intelligent-validator'')'
  );
  
  -- VirusTotal validators
  PERFORM cron.schedule(
    'virustotal-validator-morning',
    '0 6 * * *',
    'SELECT _call_edge(''virustotal-validator'')'
  );
  
  PERFORM cron.schedule(
    'virustotal-validator-afternoon',
    '0 14 * * *',
    'SELECT _call_edge(''virustotal-validator'')'
  );
  
  -- AbuseIPDB validator
  PERFORM cron.schedule(
    'invoke-abuseipdb-validator-every-6-hours',
    '0 */6 * * *',
    'SELECT _call_edge(''abuseipdb-validator'')'
  );
  
  -- Abuse.ch validator
  PERFORM cron.schedule(
    'invoke-abuse-ch-validator-every-6-hours',
    '0 */6 * * *',
    'SELECT _call_edge(''abuse-ch-validator'')'
  );
  
  -- HoneyDB validator
  PERFORM cron.schedule(
    'honeydb-validator-job',
    '0 */12 * * *',
    'SELECT _call_edge(''honeydb-validator'')'
  );
  
  -- NeutrinoAPI validator
  PERFORM cron.schedule(
    'neutrinoapi-validator-job',
    '0 8 * * *',
    'SELECT _call_edge(''neutrinoapi-validator'')'
  );
  
  -- OTX validator
  PERFORM cron.schedule(
    'otx-validator-job',
    '0 */4 * * *',
    'SELECT _call_edge(''otx-validator'')'
  );
  
  -- Censys validator
  PERFORM cron.schedule(
    'censys-monthly-validation',
    '0 0 1 * *',
    'SELECT _call_edge(''censys-validator'')'
  );
  
  -- URLScan validators
  PERFORM cron.schedule(
    'invoke-urlscan-validator-6h',
    '0 */6 * * *',
    'SELECT _call_edge(''urlscan-validator'')'
  );
  
  PERFORM cron.schedule(
    'invoke-urlscan-validator-daily',
    '0 2 * * *',
    'SELECT _call_edge(''urlscan-validator'')'
  );
  
  -- Cloudflare URLScan validator
  PERFORM cron.schedule(
    'cloudflare-urlscan-validator-job',
    '0 */8 * * *',
    'SELECT _call_edge(''cloudflare-urlscan-validator'')'
  );
  
  -- Cloudflare Radar domain validator
  PERFORM cron.schedule(
    'cloudflare-radar-domain-validator-job',
    '0 */6 * * *',
    'SELECT _call_edge(''cloudflare-radar-domain-validator'')'
  );
  
  -- Google SafeBrowsing validator
  PERFORM cron.schedule(
    'google-safebrowsing-validator',
    '0 */4 * * *',
    'SELECT _call_edge(''google-safebrowsing-validator'')'
  );
  
  -- Validation orchestrator
  PERFORM cron.schedule(
    'validation-orchestrator',
    '*/15 * * * *',
    'SELECT _call_edge(''validation-orchestrator'')'
  );
  
  -- Whitelist cross validator
  PERFORM cron.schedule(
    'whitelist-cross-validator-hourly',
    '0 * * * *',
    'SELECT _call_edge(''whitelist-cross-validator'')'
  );
  
  RETURN QUERY SELECT 
    'all_cron_jobs'::TEXT,
    'scheduled'::TEXT,
    'All validator cron jobs have been re-created'::TEXT;
  
  -- Update validator_status to active
  INSERT INTO validator_status (validator_name, status, last_error)
  VALUES 
    ('virustotal', 'active', NULL),
    ('abuseipdb', 'active', NULL),
    ('honeydb', 'active', NULL),
    ('neutrinoapi', 'active', NULL),
    ('otx', 'active', NULL),
    ('censys', 'active', NULL),
    ('urlscan', 'active', NULL),
    ('cloudflare_urlscan', 'active', NULL),
    ('abuse_ch', 'active', NULL),
    ('safebrowsing', 'active', NULL)
  ON CONFLICT (validator_name) 
  DO UPDATE SET 
    status = 'active',
    last_error = NULL,
    updated_at = NOW();
    
  RETURN QUERY SELECT 
    'all_validators'::TEXT,
    'status_updated'::TEXT,
    'All validators set to active'::TEXT;
END;
$function$;

-- Execute the function to resume validators
SELECT * FROM resume_all_validators();