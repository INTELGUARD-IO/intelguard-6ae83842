import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get total raw indicators
    const { count: totalRaw } = await supabase
      .from("raw_indicators")
      .select("*", { count: "exact", head: true })
      .is("removed_at", null)

    // Get total validated indicators
    const { count: totalValidated } = await supabase
      .from("validated_indicators")
      .select("*", { count: "exact", head: true })

    // Get malicious indicators
    const { count: malicious } = await supabase
      .from("validated_indicators")
      .select("*", { count: "exact", head: true })
      .eq("threat_type", "malicious")

    // Get active feeds
    const { count: activeFeeds } = await supabase
      .from("ingest_sources")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)

    return NextResponse.json({
      totalRawIndicators: totalRaw || 0,
      totalValidatedIndicators: totalValidated || 0,
      maliciousIndicators: malicious || 0,
      activeFeeds: activeFeeds || 0,
      lastUpdate: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
