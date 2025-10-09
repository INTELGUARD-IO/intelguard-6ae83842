
-- Function to pause all validator cron jobs
CREATE OR REPLACE FUNCTION pause_all_validators()
RETURNS TABLE(jobname TEXT, action TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  job_record RECORD;
  validator_jobs TEXT[] := ARRAY[
    'censys-monthly-validation',
    'cloudflare-radar-domain-validator-job',
    'cloudflare-urlscan-validator-job',
    'google-safebrowsing-validator',
    'honeydb-validator-job',
    'intelligent-validator-domains',
    'intelligent-validator-ips',
    'invoke-abuse-ch-validator-every-6-hours',
    'invoke-abuseipdb-validator-every-6-hours',
    'invoke-urlscan-validator-6h',
    'invoke-urlscan-validator-daily',
    'neutrinoapi-validator-job',
    'otx-validator-job',
    'validation-orchestrator',
    'virustotal-validator-afternoon',
    'virustotal-validator-morning',
    'whitelist-cross-validator-hourly'
  ];
BEGIN
  -- Unschedule each validator job
  FOR job_record IN 
    SELECT j.jobid, j.jobname
    FROM cron.job j
    WHERE j.jobname = ANY(validator_jobs)
  LOOP
    BEGIN
      PERFORM cron.unschedule(job_record.jobid);
      
      RETURN QUERY SELECT 
        job_record.jobname::TEXT,
        'unscheduled'::TEXT,
        format('Job %s (ID: %s) successfully paused', job_record.jobname, job_record.jobid)::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        job_record.jobname::TEXT,
        'error'::TEXT,
        format('Failed to pause job %s: %s', job_record.jobname, SQLERRM)::TEXT;
    END;
  END LOOP;
  
  -- Update validator_status
  INSERT INTO validator_status (validator_name, status, last_error)
  VALUES 
    ('virustotal', 'paused', 'Manually paused by admin'),
    ('abuseipdb', 'paused', 'Manually paused by admin'),
    ('honeydb', 'paused', 'Manually paused by admin'),
    ('neutrinoapi', 'paused', 'Manually paused by admin'),
    ('otx', 'paused', 'Manually paused by admin'),
    ('censys', 'paused', 'Manually paused by admin'),
    ('urlscan', 'paused', 'Manually paused by admin'),
    ('cloudflare_urlscan', 'paused', 'Manually paused by admin'),
    ('abuse_ch', 'paused', 'Manually paused by admin'),
    ('safebrowsing', 'paused', 'Manually paused by admin')
  ON CONFLICT (validator_name) 
  DO UPDATE SET 
    status = 'paused',
    last_error = 'Manually paused by admin',
    updated_at = NOW();
    
  RETURN QUERY SELECT 
    'all_validators'::TEXT,
    'status_updated'::TEXT,
    'Validator status table updated to paused'::TEXT;
END;
$$;

-- Execute the function to pause all validators
SELECT * FROM pause_all_validators();
