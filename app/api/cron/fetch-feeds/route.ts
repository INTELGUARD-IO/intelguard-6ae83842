import { NextResponse } from "next/server"
import { fetchAllFeeds } from "@/lib/feed-fetcher"
import { createClient } from "@/lib/supabase/server"

/**
 * CRON endpoint to fetch all feeds
 * This should be called every 30 seconds by Vercel Cron or external scheduler
 */
export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    // Verify authorization (optional: add a secret token)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Starting feed fetch CRON job")

    // Update CRON job status
    const supabase = await createClient()
    await supabase
      .from("cron_jobs_status")
      .upsert({
        job_name: "fetch_feeds",
        status: "running",
        last_run: new Date().toISOString(),
      })
      .select()

    // Fetch all feeds
    const results = await fetchAllFeeds()

    // Calculate stats
    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length
    const totalIndicators = results.reduce((sum, r) => sum + r.indicatorsFound, 0)
    const durationMs = Date.now() - startTime

    console.log(
      `[v0] Feed fetch completed: ${successCount} success, ${errorCount} errors, ${totalIndicators} indicators`,
    )

    // Update CRON job status
    await supabase
      .from("cron_jobs_status")
      .update({
        status: "completed",
        indicators_processed: totalIndicators,
        duration_ms: durationMs,
        errors_count: errorCount,
        updated_at: new Date().toISOString(),
      })
      .eq("job_name", "fetch_feeds")

    return NextResponse.json({
      success: true,
      results,
      stats: {
        totalFeeds: results.length,
        successCount,
        errorCount,
        totalIndicators,
        durationMs,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] CRON job error:", errorMessage)

    // Update CRON job status with error
    const supabase = await createClient()
    await supabase
      .from("cron_jobs_status")
      .update({
        status: "error",
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("job_name", "fetch_feeds")

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}
