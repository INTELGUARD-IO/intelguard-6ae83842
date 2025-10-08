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

    const { data: jobs, error } = await supabase
      .from("cron_jobs_status")
      .select("*")
      .order("last_run", { ascending: false })

    if (error) throw error

    return NextResponse.json(jobs || [])
  } catch (error) {
    console.error("[v0] Error fetching cron status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
