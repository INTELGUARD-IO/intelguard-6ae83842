import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processFeedBatch, deduplicateIndicators } from "@/lib/ingest/process-feeds"

export async function GET() {
  try {
    const supabase = await createClient()

    console.log("[v0] Starting auto-ingest system...")

    // Get all enabled feed sources
    const { data: feeds, error: feedsError } = await supabase
      .from("feed_sources")
      .select("name, url, priority")
      .eq("enabled", true)
      .order("priority", { ascending: false })

    if (feedsError) throw feedsError

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No enabled feed sources found",
      })
    }

    console.log(`[v0] Found ${feeds.length} enabled feeds`)

    // Process all feeds in batches of 10
    const BATCH_SIZE = 10
    const allResults = []

    for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
      const batch = feeds.slice(i, i + BATCH_SIZE)
      console.log(`[v0] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(feeds.length / BATCH_SIZE)}`)

      const results = await processFeedBatch(batch)
      allResults.push(...results)

      // Small delay between batches to avoid overwhelming the system
      if (i + BATCH_SIZE < feeds.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    // Calculate stats
    const successCount = allResults.filter((r) => r.success).length
    const failedCount = allResults.filter((r) => !r.success).length
    const totalIndicators = allResults.reduce((sum, r) => sum + r.indicatorsFound, 0)

    console.log(
      `[v0] Ingest complete: ${successCount} success, ${failedCount} failed, ${totalIndicators} total indicators`,
    )

    // Now run global deduplication
    console.log("[v0] Starting global deduplication...")
    const dedupeStats = await deduplicateIndicators()

    // Move deduplicated indicators to ingest_buffer
    const { data: movedCount } = await supabase.rpc("move_deduplicated_to_buffer")

    console.log(`[v0] Moved ${movedCount} unique indicators to ingest_buffer`)

    return NextResponse.json({
      success: true,
      ingest: {
        totalFeeds: feeds.length,
        successfulFeeds: successCount,
        failedFeeds: failedCount,
        totalIndicatorsCollected: totalIndicators,
      },
      deduplication: {
        totalRaw: dedupeStats.totalRaw,
        totalUnique: dedupeStats.totalUnique,
        totalDuplicates: dedupeStats.totalDuplicates,
        processingTimeMs: dedupeStats.processingTime,
      },
      buffer: {
        indicatorsMoved: movedCount,
      },
      results: allResults,
    })
  } catch (error: any) {
    console.error("[v0] Auto-ingest error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
