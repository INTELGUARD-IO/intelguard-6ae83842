export type UserRole = "superadmin" | "msp_admin" | "msp_user" | "customer"

export type TenantType = "msp" | "customer"

export interface Profile {
  id: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  name: string
  type: TenantType
  owner_user_id: string
  created_at: string
}

export interface RawIndicator {
  id: number
  indicator: string
  kind: "ipv4" | "domain"
  source: string
  first_seen: string
  last_seen: string
  removed_at: string | null
}

export interface DynamicRawIndicator {
  id: number
  indicator: string
  kind: "ipv4" | "domain"
  sources: string[]
  source_count: number
  confidence: number
  whitelisted: boolean
  whitelist_source: string | null
  first_validated: string
  last_validated: string
  // Validator results
  abuseipdb_checked: boolean
  abuseipdb_score: number | null
  abuseipdb_in_blacklist: boolean
  safebrowsing_checked: boolean
  safebrowsing_score: number | null
  safebrowsing_verdict: string | null
  otx_checked: boolean
  otx_score: number | null
  otx_verdict: string | null
  cloudflare_urlscan_checked: boolean
  cloudflare_urlscan_score: number | null
  cloudflare_urlscan_malicious: boolean
  cloudflare_urlscan_verdict: string | null
}

export interface ValidatedIndicator {
  id: string
  indicator: string
  kind: "ipv4" | "domain"
  confidence: number
  threat_type: string
  country: string | null
  asn: string | null
  last_validated: string
  created_at: string
}

export interface FeedSource {
  id: string
  name: string
  url: string
  enabled: boolean
  priority: number
  type: string
  description: string | null
  last_run: string | null
  last_success: string | null
  last_error: string | null
  indicators_count: number | null
  created_at: string
  updated_at: string
}

export interface CronJobStatus {
  job_name: string
  status: string
  last_run: string | null
  next_run: string | null
  indicators_processed: number | null
  duration_ms: number | null
  errors_count: number | null
  last_error: string | null
  created_at: string
  updated_at: string
}
