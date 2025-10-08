import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    const { data: indicators, error } = await supabase
      .from("raw_indicators")
      .select("*")
      .is("removed_at", null)
      .order("first_seen", { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json(indicators || [])
  } catch (error) {
    console.error("[v0] Error fetching raw indicators:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
