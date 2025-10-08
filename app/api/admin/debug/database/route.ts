import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/auth-utils"

export async function GET() {
  try {
    await requireSuperAdmin()

    const supabase = await createClient()

    // Get database statistics
    const [rawCount, bufferCount, validatedCount, feedsCount, usersCount] = await Promise.all([
      supabase.from("raw_indicators").select("*", { count: "exact", head: true }),
      supabase.from("ingest_buffer").select("*", { count: "exact", head: true }),
      supabase.from("validated_indicators").select("*", { count: "exact", head: true }),
      supabase.from("feed_sources").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ])

    return NextResponse.json({
      database: {
        raw_indicators: rawCount.count,
        ingest_buffer: bufferCount.count,
        validated_indicators: validatedCount.count,
        feed_sources: feedsCount.count,
        users: usersCount.count,
      },
    })
  } catch (error) {
    console.error("[v0] Debug database error:", error)
    return NextResponse.json({ error: "Unauthorized or error occurred" }, { status: 401 })
  }
}
