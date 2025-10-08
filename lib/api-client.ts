/**
 * API client functions for dashboard data fetching
 */

export interface DashboardStats {
  totalRawIndicators: number
  totalValidatedIndicators: number
  maliciousIndicators: number
  activeFeeds: number
  lastUpdate: string
}

export interface RawIndicator {
  id: number
  indicator: string
  kind: string
  source: string
  first_seen: string
  last_seen: string
}

export interface ValidatedIndicator {
  id: string
  indicator: string
  kind: string
  confidence: number
  threat_type: string
  country: string | null
  asn: string | null
  last_validated: string
}

export interface FeedStatus {
  id: string
  name: string
  url: string
  enabled: boolean
  last_run: string | null
  last_success: string | null
  last_error: string | null
  indicators_count: number
}

export interface CronJobStatus {
  job_name: string
  status: string
  last_run: string | null
  indicators_processed: number | null
  duration_ms: number | null
  errors_count: number | null
  last_error: string | null
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch("/api/dashboard/stats")
  if (!response.ok) throw new Error("Failed to fetch dashboard stats")
  return response.json()
}

export async function fetchRawIndicators(limit = 100): Promise<RawIndicator[]> {
  const response = await fetch(`/api/dashboard/raw-indicators?limit=${limit}`)
  if (!response.ok) throw new Error("Failed to fetch raw indicators")
  return response.json()
}

export async function fetchValidatedIndicators(limit = 100): Promise<ValidatedIndicator[]> {
  const response = await fetch(`/api/dashboard/validated-indicators?limit=${limit}`)
  if (!response.ok) throw new Error("Failed to fetch validated indicators")
  return response.json()
}

export async function fetchFeedStatus(): Promise<FeedStatus[]> {
  const response = await fetch("/api/dashboard/feed-status")
  if (!response.ok) throw new Error("Failed to fetch feed status")
  return response.json()
}

export async function fetchCronStatus(): Promise<CronJobStatus[]> {
  const response = await fetch("/api/dashboard/cron-status")
  if (!response.ok) throw new Error("Failed to fetch cron status")
  return response.json()
}
