import { NextResponse } from "next/server"
import { fetchAllFeeds } from "@/lib/feed-fetcher"
import { createClient } from "@/lib/supabase/server"

/**
 * Manual trigger endpoint for feed fetching (for testing/admin)
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is superadmin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden: Superadmin only" }, { status: 403 })
    }

    console.log("[v0] Manual feed fetch triggered by superadmin")

    const results = await fetchAllFeeds()

    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length
    const totalIndicators = results.reduce((sum, r) => sum + r.indicatorsFound, 0)

    return NextResponse.json({
      success: true,
      message: "Feed fetch completed",
      results,
      stats: {
        totalFeeds: results.length,
        successCount,
        errorCount,
        totalIndicators,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Manual feed fetch error:", errorMessage)

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
