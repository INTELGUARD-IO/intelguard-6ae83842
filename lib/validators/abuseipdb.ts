import { checkRateLimit, recordValidation } from "@/lib/rate-limiter"

export interface AbuseIPDBResult {
  isMalicious: boolean
  confidenceScore: number
  abuseConfidenceScore: number
  totalReports: number
  validationData: Record<string, unknown>
  responseTimeMs: number
}

/**
 * Validate IP using AbuseIPDB
 */
export async function validateWithAbuseIPDB(ip: string, indicatorId: number): Promise<AbuseIPDBResult | null> {
  const startTime = Date.now()

  // Check rate limit
  const rateLimit = await checkRateLimit("abuseipdb")
  if (!rateLimit.canUse) {
    console.log(`[v0] AbuseIPDB rate limit exceeded: ${rateLimit.reason}`)
    return null
  }

  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) {
    console.error("[v0] AbuseIPDB API key not configured")
    return null
  }

  try {
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`

    const response = await fetch(url, {
      headers: {
        Key: apiKey,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`AbuseIPDB API error: ${response.status}`)
    }

    const data = await response.json()
    const responseTimeMs = Date.now() - startTime

    const abuseConfidenceScore = data.data?.abuseConfidenceScore || 0
    const totalReports = data.data?.totalReports || 0

    // Consider malicious if confidence > 50 or has multiple reports
    const isMalicious = abuseConfidenceScore > 50 || totalReports > 5

    const result = {
      isMalicious,
      confidenceScore: abuseConfidenceScore,
      abuseConfidenceScore,
      totalReports,
      validationData: data.data || {},
      responseTimeMs,
    }

    // Record validation
    await recordValidation("abuseipdb", indicatorId, ip, "ipv4", result)

    console.log(`[v0] AbuseIPDB validated ${ip}: malicious=${isMalicious}, score=${abuseConfidenceScore}`)

    return result
  } catch (error) {
    console.error(`[v0] AbuseIPDB validation error for ${ip}:`, error)
    return null
  }
}
