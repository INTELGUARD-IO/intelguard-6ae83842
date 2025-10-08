-- Remove old constraint that only allows abuseipdb, virustotal, neutrino
ALTER TABLE vendor_checks DROP CONSTRAINT IF EXISTS vendor_checks_vendor_check;

-- Add new constraint with ALL vendors that write to vendor_checks
ALTER TABLE vendor_checks ADD CONSTRAINT vendor_checks_vendor_check 
CHECK (vendor = ANY (ARRAY[
  'abuseipdb'::text,
  'virustotal'::text,
  'neutrino'::text,
  'censys'::text,
  'google_safebrowsing'::text,
  'urlscan'::text
]));
