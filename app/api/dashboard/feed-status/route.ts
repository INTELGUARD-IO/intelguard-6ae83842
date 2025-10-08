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

    const { data: feeds, error } = await supabase
      .from("ingest_sources")
      .select("*")
      .order("priority", { ascending: false })

    if (error) throw error

    return NextResponse.json(feeds || [])
  } catch (error) {
    console.error("[v0] Error fetching feed status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
