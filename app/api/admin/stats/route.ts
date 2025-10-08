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

    // Check if user is superadmin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || profile.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get stats
    const { count: usersCount } = await supabase.from("profiles").select("*", { count: "exact", head: true })

    const { count: feedsCount } = await supabase.from("ingest_sources").select("*", { count: "exact", head: true })

    const { count: tenantsCount } = await supabase.from("tenants").select("*", { count: "exact", head: true })

    return NextResponse.json({
      usersCount: usersCount || 0,
      feedsCount: feedsCount || 0,
      tenantsCount: tenantsCount || 0,
    })
  } catch (error) {
    console.error("[v0] Admin stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
