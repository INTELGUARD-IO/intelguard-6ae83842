import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * CRON endpoint to deduplicate ingest_buffer and move to raw_indicators
 * This should be called every 5 minutes
 */
export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Starting deduplication CRON job")

    const supabase = await createClient()

    // Update CRON job status
    await supabase.from("cron_jobs_status").upsert({
      job_name: "deduplicate_buffer",
      status: "running",
      last_run: new Date().toISOString(),
    })

    // Get all pending indicators from ingest_buffer
    const { data: bufferData, error: fetchError } = await supabase
      .from("ingest_buffer")
      .select("*")
      .eq("status", "pending")

    if (fetchError) throw fetchError

    if (!bufferData || bufferData.length === 0) {
      console.log("[v0] No pending indicators in buffer")
      return NextResponse.json({ success: true, message: "No pending indicators" })
    }

    console.log(`[v0] Processing ${bufferData.length} indicators from buffer`)

    // Group by indicator_value and indicator_type
    const grouped = new Map<string, typeof bufferData>()

    for (const item of bufferData) {
      const key = `${item.indicator_type}:${item.indicator_value}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(item)
    }

    console.log(`[v0] Found ${grouped.size} unique indicators after deduplication`)

    // Insert unique indicators into raw_indicators
    const rawIndicators = Array.from(grouped.entries()).map(([key, items]) => {
      const first = items[0]
      const sources = [...new Set(items.map((i) => i.source_name))].join(", ")

      return {
        indicator: first.indicator_value,
        kind: first.indicator_type,
        source: sources,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      }
    })

    // Insert in batches
    const batchSize = 1000
    let insertedCount = 0

    for (let i = 0; i < rawIndicators.length; i += batchSize) {
      const batch = rawIndicators.slice(i, i + batchSize)

      // Use upsert to handle duplicates
      const { error: insertError } = await supabase.from("raw_indicators").upsert(batch, {
        onConflict: "indicator,kind",
        ignoreDuplicates: false,
      })

      if (insertError) {
        console.error(`[v0] Error inserting batch:`, insertError)
      } else {
        insertedCount += batch.length
      }
    }

    // Mark buffer items as processed
    const bufferIds = bufferData.map((item) => item.id)
    await supabase.from("ingest_buffer").update({ status: "processed" }).in("id", bufferIds)

    // Log deduplication stats
    await supabase.from("deduplication_stats").insert({
      total_raw: bufferData.length,
      total_unique: grouped.size,
      total_duplicates: bufferData.length - grouped.size,
      processing_time_ms: Date.now() - startTime,
    })

    // Update CRON job status
    await supabase
      .from("cron_jobs_status")
      .update({
        status: "completed",
        indicators_processed: insertedCount,
        duration_ms: Date.now() - startTime,
        updated_at: new Date().toISOString(),
      })
      .eq("job_name", "deduplicate_buffer")

    console.log(`[v0] Deduplication completed: ${insertedCount} unique indicators inserted`)

    return NextResponse.json({
      success: true,
      stats: {
        totalProcessed: bufferData.length,
        uniqueIndicators: grouped.size,
        duplicatesRemoved: bufferData.length - grouped.size,
        insertedCount,
        durationMs: Date.now() - startTime,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Deduplication CRON error:", errorMessage)

    const supabase = await createClient()
    await supabase
      .from("cron_jobs_status")
      .update({
        status: "error",
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("job_name", "deduplicate_buffer")

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
