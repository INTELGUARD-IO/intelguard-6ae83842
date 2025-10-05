-- Fix security warning: Materialized View in API
-- Remove public access to the materialized view
-- Users should only access stats via the get_raw_indicator_stats() function

-- Revoke all public access to the materialized view
REVOKE ALL ON raw_indicator_stats_mv FROM anon, authenticated, public;

-- Grant select only to postgres (for internal function use)
GRANT SELECT ON raw_indicator_stats_mv TO postgres;

-- Ensure the function can still access the view
GRANT SELECT ON raw_indicator_stats_mv TO service_role;