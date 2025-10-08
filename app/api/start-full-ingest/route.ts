import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processFeedBatch, deduplicateIndicators } from "@/lib/ingest/process-feeds"

export async function GET() {
  try {
    const supabase = await createClient()
    const startTime = Date.now()

    console.log("[v0] Starting full ingest process...")

    // Step 1: Clear staging table
    console.log("[v0] Step 1: Clearing staging table...")
    const { error: clearError } = await supabase.from("raw_indicators_staging").delete().neq("id", 0)

    if (clearError) {
      console.error("[v0] Error clearing staging:", clearError)
    }

    // Step 2: Get all enabled feeds
    console.log("[v0] Step 2: Fetching enabled feeds...")
    const { data: feeds, error: feedsError } = await supabase
      .from("feed_sources")
      .select("name, url, priority")
      .eq("enabled", true)
      .order("priority", { ascending: false })

    if (feedsError) throw feedsError

    const totalFeeds = feeds?.length || 0
    console.log(`[v0] Found ${totalFeeds} enabled feeds`)

    if (totalFeeds === 0) {
      return NextResponse.json({
        success: false,
        error: "No enabled feeds found",
      })
    }

    // Step 3: Process all feeds in batches of 10
    console.log("[v0] Step 3: Processing feeds in batches of 10...")
    const batchSize = 10
    const allResults = []

    for (let i = 0; i < feeds.length; i += batchSize) {
      const batch = feeds.slice(i, i + batchSize)
      console.log(`[v0] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(feeds.length / batchSize)}`)

      const batchResults = await processFeedBatch(batch)
      allResults.push(...batchResults)

      console.log(`[v0] Batch complete: ${batchResults.filter((r) => r.success).length}/${batch.length} successful`)
    }

    // Step 4: Count raw indicators in staging
    console.log("[v0] Step 4: Counting raw indicators...")
    const { count: rawCount } = await supabase
      .from("raw_indicators_staging")
      .select("*", { count: "exact", head: true })

    console.log(`[v0] Total raw indicators collected: ${rawCount}`)

    // Step 5: Deduplicate globally
    console.log("[v0] Step 5: Starting global deduplication...")
    const dedupeStats = await deduplicateIndicators()

    // Step 6: Move unique indicators to ingest_buffer
    console.log("[v0] Step 6: Moving unique indicators to ingest_buffer...")
    const { data: uniqueIndicators } = await supabase.rpc("deduplicate_staging_indicators")

    if (uniqueIndicators && uniqueIndicators.length > 0) {
      // Prepare data for ingest_buffer
      const bufferData = uniqueIndicators.map((ind: any) => ({
        indicator_value: ind.indicator_value,
        indicator_type: ind.indicator_type,
        source_name: ind.source_names[0], // Primary source
        source_url: ind.source_urls[0],
        extra_data: ind.merged_columns || {},
        occurrences: ind.occurrences,
        first_seen: ind.first_seen,
        last_seen: ind.last_seen,
        status: "pending",
        priority: 5,
        confidence_score: 50,
      }))

      // Insert into ingest_buffer with upsert
      const { error: bufferError } = await supabase.from("ingest_buffer").upsert(bufferData, {
        onConflict: "indicator_value,indicator_type",
        ignoreDuplicates: false,
      })

      if (bufferError) {
        console.error("[v0] Error moving to ingest_buffer:", bufferError)
      } else {
        console.log(`[v0] Moved ${uniqueIndicators.length} unique indicators to ingest_buffer`)
      }
    }

    // Step 7: Get breakdown by type
    const { data: ipv4Count } = await supabase
      .from("ingest_buffer")
      .select("*", { count: "exact", head: true })
      .eq("indicator_type", "ipv4")

    const { data: domainCount } = await supabase
      .from("ingest_buffer")
      .select("*", { count: "exact", head: true })
      .eq("indicator_type", "domain")

    const totalTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      summary: {
        totalFeeds,
        feedsProcessed: allResults.length,
        feedsSuccessful: allResults.filter((r) => r.success).length,
        feedsFailed: allResults.filter((r) => !r.success).length,
        totalRawIndicators: rawCount || 0,
        totalUniqueIndicators: dedupeStats.totalUnique,
        totalDuplicatesRemoved: dedupeStats.totalDuplicates,
        ipv4Count: ipv4Count || 0,
        domainCount: domainCount || 0,
        totalProcessingTime: totalTime,
      },
      deduplication: dedupeStats,
      feedResults: allResults,
    })
  } catch (error: any) {
    console.error("[v0] Full ingest error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
