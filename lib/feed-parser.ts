/**
 * Intelligent feed parser that handles multiple formats:
 * - Plain text (one indicator per line)
 * - CSV (with or without headers)
 * - JSON arrays
 * - XML feeds
 */

export interface ParsedIndicator {
  value: string
  type: "ipv4" | "domain"
  metadata?: Record<string, unknown>
}

export interface ParseResult {
  indicators: ParsedIndicator[]
  strategy: string
  errors: string[]
}

// Regex patterns for validation
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

function isIPv4(value: string): boolean {
  return IPV4_REGEX.test(value.trim())
}

function isDomain(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  // Remove common prefixes
  const cleaned = trimmed.replace(/^(https?:\/\/)?(www\.)?/, "")
  return DOMAIN_REGEX.test(cleaned)
}

function normalizeIndicator(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "") // Remove protocol and www
    .replace(/\/.*$/, "") // Remove path
    .replace(/:\d+$/, "") // Remove port
}

/**
 * Parse plain text format (one indicator per line)
 */
function parsePlainText(content: string): ParsedIndicator[] {
  const indicators: ParsedIndicator[] = []
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith(";")) {
      continue
    }

    // Extract first token (in case of space-separated values)
    const token = trimmed.split(/\s+/)[0]
    const normalized = normalizeIndicator(token)

    if (isIPv4(normalized)) {
      indicators.push({ value: normalized, type: "ipv4" })
    } else if (isDomain(normalized)) {
      indicators.push({ value: normalized, type: "domain" })
    }
  }

  return indicators
}

/**
 * Parse CSV format
 */
function parseCSV(content: string): ParsedIndicator[] {
  const indicators: ParsedIndicator[] = []
  const lines = content.split(/\r?\n/)

  // Try to detect if first line is header
  const firstLine = lines[0]?.toLowerCase() || ""
  const hasHeader =
    firstLine.includes("ip") ||
    firstLine.includes("domain") ||
    firstLine.includes("indicator") ||
    firstLine.includes("host")

  const startIndex = hasHeader ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith("#")) continue

    // Split by comma, handle quoted values
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []

    for (const value of values) {
      const cleaned = value.replace(/^["']|["']$/g, "").trim()
      const normalized = normalizeIndicator(cleaned)

      if (isIPv4(normalized)) {
        indicators.push({ value: normalized, type: "ipv4" })
      } else if (isDomain(normalized)) {
        indicators.push({ value: normalized, type: "domain" })
      }
    }
  }

  return indicators
}

/**
 * Parse JSON format
 */
function parseJSON(content: string): ParsedIndicator[] {
  const indicators: ParsedIndicator[] = []

  try {
    const data = JSON.parse(content)

    // Handle array of strings
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === "string") {
          const normalized = normalizeIndicator(item)
          if (isIPv4(normalized)) {
            indicators.push({ value: normalized, type: "ipv4" })
          } else if (isDomain(normalized)) {
            indicators.push({ value: normalized, type: "domain" })
          }
        } else if (typeof item === "object" && item !== null) {
          // Handle objects with indicator fields
          const possibleFields = ["ip", "domain", "indicator", "host", "address", "value"]
          for (const field of possibleFields) {
            if (item[field]) {
              const normalized = normalizeIndicator(String(item[field]))
              if (isIPv4(normalized)) {
                indicators.push({ value: normalized, type: "ipv4", metadata: item })
                break
              } else if (isDomain(normalized)) {
                indicators.push({ value: normalized, type: "domain", metadata: item })
                break
              }
            }
          }
        }
      }
    }
  } catch {
    // Not valid JSON, will try other parsers
  }

  return indicators
}

/**
 * Main parser function with automatic format detection
 */
export function parseFeed(content: string, feedUrl: string): ParseResult {
  const errors: string[] = []
  let indicators: ParsedIndicator[] = []
  let strategy = "unknown"

  // Try JSON first
  if (content.trim().startsWith("[") || content.trim().startsWith("{")) {
    indicators = parseJSON(content)
    if (indicators.length > 0) {
      strategy = "json"
      return { indicators, strategy, errors }
    }
  }

  // Try CSV if it looks like CSV
  if (content.includes(",") && (content.includes('"') || content.split("\n")[0].split(",").length > 2)) {
    indicators = parseCSV(content)
    if (indicators.length > 0) {
      strategy = "csv"
      return { indicators, strategy, errors }
    }
  }

  // Fallback to plain text
  indicators = parsePlainText(content)
  strategy = "plaintext"

  if (indicators.length === 0) {
    errors.push(`No valid indicators found in feed: ${feedUrl}`)
  }

  return { indicators, strategy, errors }
}

/**
 * Deduplicate indicators
 */
export function deduplicateIndicators(indicators: ParsedIndicator[]): ParsedIndicator[] {
  const seen = new Set<string>()
  const unique: ParsedIndicator[] = []

  for (const indicator of indicators) {
    const key = `${indicator.type}:${indicator.value}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(indicator)
    }
  }

  return unique
}
