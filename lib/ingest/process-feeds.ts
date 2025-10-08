import { createClient } from "@/lib/supabase/server"

export interface FeedProcessResult {
  feedName: string
  feedUrl: string
  success: boolean
  indicatorsFound: number
  error?: string
  duration: number
}

export async function processFeedBatch(
  feedUrls: Array<{ name: string; url: string; priority: number }>,
): Promise<FeedProcessResult[]> {
  const results: FeedProcessResult[] = []

  // Process feeds in parallel
  const promises = feedUrls.map(async (feed) => {
    const startTime = Date.now()

    try {
      console.log(`[v0] Processing feed: ${feed.name}`)

      // Fetch feed content with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(feed.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "IntelGuard/1.0 Threat Intelligence Aggregator",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const content = await response.text()
      console.log(`[v0] Downloaded ${content.length} bytes from ${feed.name}`)

      // Parse indicators with additional columns
      const indicators = parseIndicators(content, feed.name, feed.url)
      console.log(`[v0] Extracted ${indicators.length} indicators from ${feed.name}`)

      // Insert into staging table (NO deduplication here)
      if (indicators.length > 0) {
        const supabase = await createClient()

        const { error: insertError } = await supabase.from("raw_indicators_staging").insert(indicators)

        if (insertError) {
          console.error(`[v0] Insert error for ${feed.name}:`, insertError)
          throw insertError
        }
      }

      // Log success
      const supabase = await createClient()
      await supabase.from("ingest_logs").insert({
        feed_name: feed.name,
        feed_url: feed.url,
        status: "success",
        indicators_found: indicators.length,
        duration_ms: Date.now() - startTime,
        parsing_strategy: "multi-column",
      })

      // Update feed_sources
      await supabase
        .from("feed_sources")
        .update({
          last_run: new Date().toISOString(),
          last_success: new Date().toISOString(),
          total_indicators: indicators.length,
        })
        .eq("url", feed.url)

      return {
        feedName: feed.name,
        feedUrl: feed.url,
        success: true,
        indicatorsFound: indicators.length,
        duration: Date.now() - startTime,
      }
    } catch (error: any) {
      console.error(`[v0] Error processing ${feed.name}:`, error)

      // Log error
      const supabase = await createClient()
      await supabase.from("ingest_logs").insert({
        feed_name: feed.name,
        feed_url: feed.url,
        status: "error",
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      })

      // Update feed_sources with error
      await supabase
        .from("feed_sources")
        .update({
          last_run: new Date().toISOString(),
          last_error: error.message,
        })
        .eq("url", feed.url)

      return {
        feedName: feed.name,
        feedUrl: feed.url,
        success: false,
        indicatorsFound: 0,
        error: error.message,
        duration: Date.now() - startTime,
      }
    }
  })

  results.push(...(await Promise.all(promises)))
  return results
}

function parseIndicators(content: string, sourceName: string, sourceUrl: string) {
  const indicators: any[] = []
  const lines = content.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";") || trimmed.startsWith("//")) {
      continue
    }

    // Split by common delimiters (tab, comma, semicolon, pipe, space)
    const columns = trimmed
      .split(/[\t,;|]/)
      .map((c) => c.trim())
      .filter((c) => c)

    if (columns.length === 0) continue

    const firstColumn = columns[0]

    // Check if first column is an IP (without CIDR)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

    let indicatorType: string | null = null
    let indicatorValue: string | null = null

    if (ipv4Regex.test(firstColumn)) {
      indicatorType = "ipv4"
      indicatorValue = firstColumn
    } else if (ipv6Regex.test(firstColumn)) {
      indicatorType = "ipv6"
      indicatorValue = firstColumn
    } else if (domainRegex.test(firstColumn)) {
      indicatorType = "domain"
      indicatorValue = firstColumn
    }

    // Only add if we found a valid indicator
    if (indicatorType && indicatorValue) {
      indicators.push({
        source_name: sourceName,
        source_url: sourceUrl,
        indicator_type: indicatorType,
        indicator_value: indicatorValue,
        // Extract additional columns if present
        column_2: columns[1] || null, // Could be ASN, country, etc.
        column_3: columns[2] || null, // Could be host, description, etc.
        column_4: columns[3] || null, // Additional metadata
        column_5: columns[4] || null, // Additional metadata
        created_at: new Date().toISOString(),
      })
    }
  }

  return indicators
}

export async function deduplicateIndicators() {
  const startTime = Date.now()
  const supabase = await createClient()

  console.log("[v0] Starting global deduplication...")

  // Count total raw indicators in staging
  const { count: totalRaw } = await supabase.from("raw_indicators_staging").select("*", { count: "exact", head: true })

  console.log(`[v0] Total raw indicators in staging: ${totalRaw}`)

  // Find duplicates and merge additional info
  // Group by indicator_value and indicator_type, keep first occurrence
  // Merge column_2, column_3, column_4, column_5 from all occurrences
  const { data: uniqueIndicators, error } = await supabase.rpc("deduplicate_staging_indicators")

  if (error) {
    console.error("[v0] Deduplication error:", error)
    throw error
  }

  const totalUnique = uniqueIndicators?.length || 0
  const totalDuplicates = (totalRaw || 0) - totalUnique

  console.log(`[v0] Deduplication complete: ${totalUnique} unique, ${totalDuplicates} duplicates removed`)

  // Log deduplication stats
  await supabase.from("deduplication_stats").insert({
    total_raw: totalRaw,
    total_unique: totalUnique,
    total_duplicates: totalDuplicates,
    processing_time_ms: Date.now() - startTime,
    run_at: new Date().toISOString(),
  })

  return {
    totalRaw: totalRaw || 0,
    totalUnique,
    totalDuplicates,
    processingTime: Date.now() - startTime,
  }
}
