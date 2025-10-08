import { checkRateLimit, recordValidation } from "@/lib/rate-limiter"

export interface SafeBrowsingResult {
  isMalicious: boolean
  confidenceScore: number
  threatTypes: string[]
  validationData: Record<string, unknown>
  responseTimeMs: number
}

/**
 * Validate URL/Domain using Google Safe Browsing
 */
export async function validateWithSafeBrowsing(url: string, indicatorId: number): Promise<SafeBrowsingResult | null> {
  const startTime = Date.now()

  // Check rate limit
  const rateLimit = await checkRateLimit("google_safebrowsing")
  if (!rateLimit.canUse) {
    console.log(`[v0] Google Safe Browsing rate limit exceeded: ${rateLimit.reason}`)
    return null
  }

  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY
  if (!apiKey) {
    console.error("[v0] Google Safe Browsing API key not configured")
    return null
  }

  try {
    const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`

    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `http://${url}`

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client: {
          clientId: "intelguard",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: normalizedUrl }],
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Safe Browsing API error: ${response.status}`)
    }

    const data = await response.json()
    const responseTimeMs = Date.now() - startTime

    const matches = data.matches || []
    const isMalicious = matches.length > 0
    const threatTypes = matches.map((m: { threatType: string }) => m.threatType)

    // Confidence based on threat types
    let confidenceScore = 0
    if (isMalicious) {
      confidenceScore = threatTypes.includes("MALWARE") ? 90 : 75
    }

    const result = {
      isMalicious,
      confidenceScore,
      threatTypes,
      validationData: data,
      responseTimeMs,
    }

    // Record validation
    await recordValidation("google_safebrowsing", indicatorId, url, "domain", result)

    console.log(`[v0] Safe Browsing validated ${url}: malicious=${isMalicious}, threats=${threatTypes.join(", ")}`)

    return result
  } catch (error) {
    console.error(`[v0] Safe Browsing validation error for ${url}:`, error)
    return null
  }
}
