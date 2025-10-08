import { createClient } from "@/lib/supabase/server"
import { validateWithAbuseIPDB } from "@/lib/validators/abuseipdb"
import { validateWithSafeBrowsing } from "@/lib/validators/google-safebrowsing"
import { validateWithOTX } from "@/lib/validators/otx"
import { calculateConsensus, calculatePriority, type ValidationResult } from "@/lib/consensus-engine"
import { VALIDATORS } from "@/lib/rate-limiter"

/**
 * Orchestrate validation of a single indicator
 */
export async function validateIndicator(indicator: {
  id: number
  indicator: string
  kind: "ipv4" | "domain"
  source_count: number
  first_seen: string
  last_validated: string | null
}) {
  console.log(`[v0] Validating ${indicator.kind} indicator: ${indicator.indicator}`)

  const validationResults: ValidationResult[] = []

  // Validate based on type
  if (indicator.kind === "ipv4") {
    // IP validation
    const abuseipdbResult = await validateWithAbuseIPDB(indicator.indicator, indicator.id)
    if (abuseipdbResult) {
      validationResults.push({
        validatorName: "abuseipdb",
        isMalicious: abuseipdbResult.isMalicious,
        confidenceScore: abuseipdbResult.confidenceScore,
        weight: VALIDATORS.abuseipdb.weight,
      })
    }

    const otxResult = await validateWithOTX(indicator.indicator, "ipv4", indicator.id)
    if (otxResult) {
      validationResults.push({
        validatorName: "otx",
        isMalicious: otxResult.isMalicious,
        confidenceScore: otxResult.confidenceScore,
        weight: VALIDATORS.otx.weight,
      })
    }
  } else if (indicator.kind === "domain") {
    // Domain validation
    const safeBrowsingResult = await validateWithSafeBrowsing(indicator.indicator, indicator.id)
    if (safeBrowsingResult) {
      validationResults.push({
        validatorName: "google_safebrowsing",
        isMalicious: safeBrowsingResult.isMalicious,
        confidenceScore: safeBrowsingResult.confidenceScore,
        weight: VALIDATORS.google_safebrowsing.weight,
      })
    }

    const otxResult = await validateWithOTX(indicator.indicator, "domain", indicator.id)
    if (otxResult) {
      validationResults.push({
        validatorName: "otx",
        isMalicious: otxResult.isMalicious,
        confidenceScore: otxResult.confidenceScore,
        weight: VALIDATORS.otx.weight,
      })
    }
  }

  // Calculate consensus
  const consensus = calculateConsensus(validationResults)

  console.log(
    `[v0] Consensus for ${indicator.indicator}: malicious=${consensus.isMalicious}, confidence=${consensus.finalConfidence}, weight=${consensus.maliciousWeight}/${consensus.totalWeight}`,
  )

  // Update dynamic_raw_indicators table
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    last_validated: new Date().toISOString(),
    confidence: consensus.finalConfidence,
  }

  // Update validator-specific fields
  for (const result of validationResults) {
    if (result.validatorName === "abuseipdb") {
      updateData.abuseipdb_checked = true
      updateData.abuseipdb_score = result.confidenceScore
      updateData.abuseipdb_in_blacklist = result.isMalicious
    } else if (result.validatorName === "google_safebrowsing") {
      updateData.safebrowsing_checked = true
      updateData.safebrowsing_score = result.confidenceScore
      updateData.safebrowsing_verdict = result.isMalicious ? "malicious" : "clean"
    } else if (result.validatorName === "otx") {
      updateData.otx_checked = true
      updateData.otx_score = result.confidenceScore
      updateData.otx_verdict = result.isMalicious ? "malicious" : "clean"
    }
  }

  // Insert or update in dynamic_raw_indicators
  await supabase.from("dynamic_raw_indicators").upsert(
    {
      indicator: indicator.indicator,
      kind: indicator.kind,
      source_count: indicator.source_count,
      first_validated: indicator.last_validated || new Date().toISOString(),
      ...updateData,
    },
    {
      onConflict: "indicator,kind",
    },
  )

  // If consensus says malicious, add to validated_indicators
  if (consensus.isMalicious) {
    await supabase.from("validated_indicators").upsert(
      {
        indicator: indicator.indicator,
        kind: indicator.kind,
        confidence: consensus.finalConfidence,
        threat_type: "malicious",
      },
      {
        onConflict: "indicator,kind",
      },
    )
  }

  return consensus
}

/**
 * Get next batch of indicators to validate based on priority
 */
export async function getValidationQueue(limit = 10) {
  const supabase = await createClient()

  // Get raw indicators that need validation
  const { data: indicators } = await supabase
    .from("raw_indicators")
    .select("*")
    .is("removed_at", null)
    .order("first_seen", { ascending: false })
    .limit(limit * 3) // Get more to calculate priority

  if (!indicators || indicators.length === 0) {
    return []
  }

  // Calculate priority for each
  const withPriority = indicators.map((ind) => ({
    ...ind,
    priority: calculatePriority({
      sourceCount: 1, // TODO: calculate from sources
      firstSeen: new Date(ind.first_seen),
      lastValidated: ind.last_seen ? new Date(ind.last_seen) : null,
    }),
  }))

  // Sort by priority and return top N
  return withPriority.sort((a, b) => b.priority - a.priority).slice(0, limit)
}
