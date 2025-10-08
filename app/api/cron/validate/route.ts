import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getValidationQueue, validateIndicator } from "@/lib/validation-orchestrator"

/**
 * CRON endpoint to validate indicators
 * This should be called every 1 minute
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

    console.log("[v0] Starting validation CRON job")

    const supabase = await createClient()

    // Update CRON job status
    await supabase.from("cron_jobs_status").upsert({
      job_name: "validate_indicators",
      status: "running",
      last_run: new Date().toISOString(),
    })

    // Get indicators to validate (batch of 10)
    const queue = await getValidationQueue(10)

    if (queue.length === 0) {
      console.log("[v0] No indicators in validation queue")
      return NextResponse.json({ success: true, message: "No indicators to validate" })
    }

    console.log(`[v0] Validating ${queue.length} indicators`)

    // Validate each indicator
    const results = []
    for (const indicator of queue) {
      try {
        const consensus = await validateIndicator({
          id: indicator.id,
          indicator: indicator.indicator,
          kind: indicator.kind,
          source_count: 1,
          first_seen: indicator.first_seen,
          last_validated: indicator.last_seen,
        })

        results.push({
          indicator: indicator.indicator,
          kind: indicator.kind,
          isMalicious: consensus.isMalicious,
          confidence: consensus.finalConfidence,
        })

        // Small delay between validations
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`[v0] Error validating ${indicator.indicator}:`, error)
      }
    }

    const maliciousCount = results.filter((r) => r.isMalicious).length
    const durationMs = Date.now() - startTime

    // Update CRON job status
    await supabase
      .from("cron_jobs_status")
      .update({
        status: "completed",
        indicators_processed: results.length,
        duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      })
      .eq("job_name", "validate_indicators")

    console.log(`[v0] Validation completed: ${results.length} validated, ${maliciousCount} malicious`)

    return NextResponse.json({
      success: true,
      stats: {
        totalValidated: results.length,
        maliciousCount,
        cleanCount: results.length - maliciousCount,
        durationMs,
      },
      results,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Validation CRON error:", errorMessage)

    const supabase = await createClient()
    await supabase
      .from("cron_jobs_status")
      .update({
        status: "error",
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("job_name", "validate_indicators")

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
