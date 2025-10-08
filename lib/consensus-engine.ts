export interface ValidationResult {
  validatorName: string
  isMalicious: boolean
  confidenceScore: number
  weight: number
}

export interface ConsensusResult {
  isMalicious: boolean
  finalConfidence: number
  totalWeight: number
  maliciousWeight: number
  validatorsUsed: number
  breakdown: ValidationResult[]
}

/**
 * Consensus voting system with weighted validators
 * Threshold: 6 points to consider malicious
 * Tier 1 validators: weight 3
 * Tier 2 validators: weight 2-3
 * Tier 3 validators: weight 1-2
 */
export function calculateConsensus(results: ValidationResult[]): ConsensusResult {
  let totalWeight = 0
  let maliciousWeight = 0

  for (const result of results) {
    totalWeight += result.weight

    if (result.isMalicious) {
      maliciousWeight += result.weight
    }
  }

  // Threshold: 6 points
  const THRESHOLD = 6
  const isMalicious = maliciousWeight >= THRESHOLD

  // Calculate final confidence as weighted average
  let weightedConfidence = 0
  for (const result of results) {
    if (result.isMalicious) {
      weightedConfidence += result.confidenceScore * result.weight
    }
  }

  const finalConfidence = maliciousWeight > 0 ? Math.round(weightedConfidence / maliciousWeight) : 0

  return {
    isMalicious,
    finalConfidence,
    totalWeight,
    maliciousWeight,
    validatorsUsed: results.length,
    breakdown: results,
  }
}

/**
 * Get priority score for an indicator
 * Higher score = higher priority for validation
 */
export function calculatePriority(indicator: {
  sourceCount: number
  firstSeen: Date
  lastValidated?: Date | null
}): number {
  let priority = 0

  // Priority 1: Seen in multiple feeds (high confidence)
  if (indicator.sourceCount >= 3) {
    priority += 100
  } else if (indicator.sourceCount >= 2) {
    priority += 50
  }

  // Priority 2: New indicators (< 24h)
  const ageHours = (Date.now() - indicator.firstSeen.getTime()) / (1000 * 60 * 60)
  if (ageHours < 24) {
    priority += 75
  } else if (ageHours < 48) {
    priority += 25
  }

  // Priority 3: Never validated or old validation
  if (!indicator.lastValidated) {
    priority += 50
  } else {
    const validationAgeHours = (Date.now() - indicator.lastValidated.getTime()) / (1000 * 60 * 60)
    if (validationAgeHours > 168) {
      // > 7 days
      priority += 10
    }
  }

  return priority
}
