import { createClient } from "@/lib/supabase/server"
import { parseFeed, deduplicateIndicators } from "@/lib/feed-parser"

export interface FeedSource {
  id: string
  name: string
  url: string
  enabled: boolean
  priority: number
  type: string
}

export interface FetchResult {
  success: boolean
  feedName: string
  feedUrl: string
  indicatorsFound: number
  duplicatesRemoved: number
  durationMs: number
  error?: string
  parsingStrategy?: string
}

/**
 * Fetch and parse a single feed source
 */
export async function fetchFeed(feed: FeedSource): Promise<FetchResult> {
  const startTime = Date.now()
  const supabase = await createClient()

  try {
    console.log(`[v0] Fetching feed: ${feed.name} (${feed.url})`)

    // Fetch the feed with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "INTELGUARD/1.0 Threat Intelligence Aggregator",
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    console.log(`[v0] Downloaded ${content.length} bytes from ${feed.name}`)

    // Parse the feed
    const parseResult = parseFeed(content, feed.url)

    if (parseResult.errors.length > 0) {
      console.log(`[v0] Parse errors for ${feed.name}:`, parseResult.errors)
    }

    // Deduplicate
    const uniqueIndicators = deduplicateIndicators(parseResult.indicators)
    const duplicatesRemoved = parseResult.indicators.length - uniqueIndicators.length

    console.log(
      `[v0] Parsed ${parseResult.indicators.length} indicators, ${uniqueIndicators.length} unique (${duplicatesRemoved} duplicates removed)`,
    )

    // Insert into ingest_buffer
    if (uniqueIndicators.length > 0) {
      const records = uniqueIndicators.map((indicator) => ({
        indicator_type: indicator.type,
        indicator_value: indicator.value,
        source_name: feed.name,
        source_url: feed.url,
        status: "pending",
        priority: feed.priority,
        confidence_score: 50, // Default confidence
        extra_data: indicator.metadata || {},
      }))

      // Insert in batches of 1000
      const batchSize = 1000
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        const { error } = await supabase.from("ingest_buffer").insert(batch)

        if (error) {
          console.error(`[v0] Error inserting batch ${i / batchSize + 1}:`, error)
          throw error
        }
      }

      console.log(`[v0] Inserted ${records.length} indicators into ingest_buffer`)
    }

    // Log the ingestion
    await supabase.from("ingest_logs").insert({
      feed_name: feed.name,
      feed_url: feed.url,
      status: "success",
      indicators_found: parseResult.indicators.length,
      duplicates_removed: duplicatesRemoved,
      parsing_strategy: parseResult.strategy,
      duration_ms: Date.now() - startTime,
    })

    // Update feed source stats
    await supabase
      .from("ingest_sources")
      .update({
        last_run: new Date().toISOString(),
        last_success: new Date().toISOString(),
        indicators_count: uniqueIndicators.length,
        last_error: null,
      })
      .eq("id", feed.id)

    return {
      success: true,
      feedName: feed.name,
      feedUrl: feed.url,
      indicatorsFound: parseResult.indicators.length,
      duplicatesRemoved,
      durationMs: Date.now() - startTime,
      parsingStrategy: parseResult.strategy,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[v0] Error fetching feed ${feed.name}:`, errorMessage)

    // Log the error
    await supabase.from("ingest_logs").insert({
      feed_name: feed.name,
      feed_url: feed.url,
      status: "error",
      error_message: errorMessage,
      duration_ms: Date.now() - startTime,
    })

    // Update feed source with error
    await supabase
      .from("ingest_sources")
      .update({
        last_run: new Date().toISOString(),
        last_attempt: new Date().toISOString(),
        last_error: errorMessage,
      })
      .eq("id", feed.id)

    return {
      success: false,
      feedName: feed.name,
      feedUrl: feed.url,
      indicatorsFound: 0,
      duplicatesRemoved: 0,
      durationMs: Date.now() - startTime,
      error: errorMessage,
    }
  }
}

/**
 * Fetch all enabled feeds
 */
export async function fetchAllFeeds(): Promise<FetchResult[]> {
  const supabase = await createClient()

  // Get all enabled feeds ordered by priority
  const { data: feeds, error } = await supabase
    .from("ingest_sources")
    .select("*")
    .eq("enabled", true)
    .order("priority", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching feed sources:", error)
    return []
  }

  if (!feeds || feeds.length === 0) {
    console.log("[v0] No enabled feeds found")
    return []
  }

  console.log(`[v0] Fetching ${feeds.length} enabled feeds`)

  // Fetch feeds sequentially to avoid overwhelming the system
  const results: FetchResult[] = []
  for (const feed of feeds) {
    const result = await fetchFeed(feed as FeedSource)
    results.push(result)

    // Small delay between feeds to be respectful
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return results
}
