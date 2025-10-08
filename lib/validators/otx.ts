import { checkRateLimit, recordValidation } from "@/lib/rate-limiter"

export interface OTXResult {
  isMalicious: boolean
  confidenceScore: number
  pulsesCount: number
  validationData: Record<string, unknown>
  responseTimeMs: number
}

/**
 * Validate IP/Domain using AlienVault OTX
 */
export async function validateWithOTX(
  indicator: string,
  type: "ipv4" | "domain",
  indicatorId: number,
): Promise<OTXResult | null> {
  const startTime = Date.now()

  // Check rate limit
  const rateLimit = await checkRateLimit("otx")
  if (!rateLimit.canUse) {
    console.log(`[v0] OTX rate limit exceeded: ${rateLimit.reason}`)
    return null
  }

  const apiKey = process.env.OTX_API_KEY
  if (!apiKey) {
    console.error("[v0] OTX API key not configured")
    return null
  }

  try {
    const endpoint = type === "ipv4" ? "IPv4" : "domain"
    const url = `https://otx.alienvault.com/api/v1/indicators/${endpoint}/${encodeURIComponent(indicator)}/general`

    const response = await fetch(url, {
      headers: {
        "X-OTX-API-KEY": apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`OTX API error: ${response.status}`)
    }

    const data = await response.json()
    const responseTimeMs = Date.now() - startTime

    const pulsesCount = data.pulse_info?.count || 0
    const reputation = data.reputation || 0

    // Consider malicious if in pulses or has bad reputation
    const isMalicious = pulsesCount > 0 || reputation < 0

    // Confidence based on pulses count
    let confidenceScore = 0
    if (isMalicious) {
      confidenceScore = Math.min(50 + pulsesCount * 10, 95)
    }

    const result = {
      isMalicious,
      confidenceScore,
      pulsesCount,
      validationData: data,
      responseTimeMs,
    }

    // Record validation
    await recordValidation("otx", indicatorId, indicator, type, result)

    console.log(`[v0] OTX validated ${indicator}: malicious=${isMalicious}, pulses=${pulsesCount}`)

    return result
  } catch (error) {
    console.error(`[v0] OTX validation error for ${indicator}:`, error)
    return null
  }
}
