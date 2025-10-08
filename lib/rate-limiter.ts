import { createClient } from "@/lib/supabase/server"

export interface ValidatorQuota {
  name: string
  tier: 1 | 2 | 3
  dailyLimit: number
  hourlyLimit: number
  minuteLimit: number
  weight: number // For consensus voting
}

// Validator configuration with rate limits
export const VALIDATORS: Record<string, ValidatorQuota> = {
  // Tier 1 - High quota, high trust
  google_safebrowsing: {
    name: "Google Safe Browsing",
    tier: 1,
    dailyLimit: 10000,
    hourlyLimit: 416,
    minuteLimit: 7,
    weight: 3,
  },
  neutrinoapi: {
    name: "NeutrinoAPI",
    tier: 1,
    dailyLimit: 5000,
    hourlyLimit: 208,
    minuteLimit: 3,
    weight: 3,
  },
  otx: {
    name: "AlienVault OTX",
    tier: 1,
    dailyLimit: 100000, // Unlimited but smart
    hourlyLimit: 100,
    minuteLimit: 2,
    weight: 3,
  },
  cloudflare_radar: {
    name: "Cloudflare Radar",
    tier: 1,
    dailyLimit: 100000, // Unlimited but smart
    hourlyLimit: 100,
    minuteLimit: 2,
    weight: 3,
  },

  // Tier 2 - Medium quota, high trust
  abuseipdb: {
    name: "AbuseIPDB",
    tier: 2,
    dailyLimit: 1000,
    hourlyLimit: 41,
    minuteLimit: 1,
    weight: 3, // High trust
  },
  cloudflare_urlscan: {
    name: "Cloudflare URL Scanner",
    tier: 2,
    dailyLimit: 1000,
    hourlyLimit: 41,
    minuteLimit: 1,
    weight: 3, // High trust
  },
  urlscan: {
    name: "URLScan.io",
    tier: 2,
    dailyLimit: 1000,
    hourlyLimit: 41,
    minuteLimit: 1,
    weight: 2,
  },

  // Tier 3 - Low quota
  virustotal: {
    name: "VirusTotal",
    tier: 3,
    dailyLimit: 500,
    hourlyLimit: 20,
    minuteLimit: 1,
    weight: 2,
  },
  honeydb: {
    name: "HoneyDB",
    tier: 3,
    dailyLimit: 50, // 1500/month
    hourlyLimit: 2,
    minuteLimit: 1,
    weight: 1,
  },
  censys: {
    name: "Censys",
    tier: 3,
    dailyLimit: 3, // 100/month
    hourlyLimit: 1,
    minuteLimit: 1,
    weight: 1,
  },
}

export interface RateLimitStatus {
  canUse: boolean
  remaining: number
  resetAt: Date
  reason?: string
}

/**
 * Check if a validator can be used based on rate limits
 */
export async function checkRateLimit(validatorName: string): Promise<RateLimitStatus> {
  const supabase = await createClient()
  const validator = VALIDATORS[validatorName]

  if (!validator) {
    return {
      canUse: false,
      remaining: 0,
      resetAt: new Date(),
      reason: "Unknown validator",
    }
  }

  // Get current usage from validator_status table
  const { data: status } = await supabase
    .from("validator_status")
    .select("*")
    .eq("validator_name", validatorName)
    .single()

  const now = new Date()

  // If no status exists, create one
  if (!status) {
    await supabase.from("validator_status").insert({
      validator_name: validatorName,
      status: "active",
      quota_reset_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    })

    return {
      canUse: true,
      remaining: validator.dailyLimit,
      resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }
  }

  // Check if quota has reset
  const resetAt = new Date(status.quota_reset_at)
  if (now > resetAt) {
    // Reset quota
    await supabase
      .from("validator_status")
      .update({
        quota_reset_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("validator_name", validatorName)

    return {
      canUse: true,
      remaining: validator.dailyLimit,
      resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    }
  }

  // Count recent validations
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

  const { count: dailyCount } = await supabase
    .from("validation_results")
    .select("*", { count: "exact", head: true })
    .eq("validator_name", validatorName)
    .gte("validated_at", oneDayAgo.toISOString())

  const { count: hourlyCount } = await supabase
    .from("validation_results")
    .select("*", { count: "exact", head: true })
    .eq("validator_name", validatorName)
    .gte("validated_at", oneHourAgo.toISOString())

  const { count: minuteCount } = await supabase
    .from("validation_results")
    .select("*", { count: "exact", head: true })
    .eq("validator_name", validatorName)
    .gte("validated_at", oneMinuteAgo.toISOString())

  // Check limits
  if ((dailyCount || 0) >= validator.dailyLimit) {
    return {
      canUse: false,
      remaining: 0,
      resetAt,
      reason: "Daily limit exceeded",
    }
  }

  if ((hourlyCount || 0) >= validator.hourlyLimit) {
    return {
      canUse: false,
      remaining: validator.hourlyLimit - (hourlyCount || 0),
      resetAt: new Date(oneHourAgo.getTime() + 60 * 60 * 1000),
      reason: "Hourly limit exceeded",
    }
  }

  if ((minuteCount || 0) >= validator.minuteLimit) {
    return {
      canUse: false,
      remaining: validator.minuteLimit - (minuteCount || 0),
      resetAt: new Date(oneMinuteAgo.getTime() + 60 * 1000),
      reason: "Minute limit exceeded",
    }
  }

  return {
    canUse: true,
    remaining: validator.dailyLimit - (dailyCount || 0),
    resetAt,
  }
}

/**
 * Record a validation API call
 */
export async function recordValidation(
  validatorName: string,
  indicatorId: number,
  indicatorValue: string,
  indicatorType: string,
  result: {
    isMalicious: boolean
    confidenceScore: number
    validationData: Record<string, unknown>
    responseTimeMs: number
  },
) {
  const supabase = await createClient()

  await supabase.from("validation_results").insert({
    validator_name: validatorName,
    indicator_id: indicatorId,
    indicator_value: indicatorValue,
    indicator_type: indicatorType,
    is_malicious: result.isMalicious,
    confidence_score: result.confidenceScore,
    validation_data: result.validationData,
    api_response_time_ms: result.responseTimeMs,
  })
}
