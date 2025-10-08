import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/auth-utils"

export async function GET() {
  try {
    await requireSuperAdmin()

    const supabase = await createClient()

    // Get all CRON job statuses
    const { data: cronJobs, error } = await supabase
      .from("cron_jobs_status")
      .select("*")
      .order("last_run", { ascending: false })

    if (error) throw error

    return NextResponse.json({ cronJobs })
  } catch (error) {
    console.error("[v0] Debug CRON error:", error)
    return NextResponse.json({ error: "Unauthorized or error occurred" }, { status: 401 })
  }
}

// Manually trigger a CRON job (superadmin only)
export async function POST(request: Request) {
  try {
    await requireSuperAdmin()

    const { jobName } = await request.json()

    if (!jobName) {
      return NextResponse.json({ error: "Job name required" }, { status: 400 })
    }

    // Trigger the CRON job by calling its endpoint
    const cronSecret = process.env.CRON_SECRET
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/cron/${jobName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const result = await response.json()

    return NextResponse.json({
      success: response.ok,
      result,
    })
  } catch (error) {
    console.error("[v0] Debug CRON trigger error:", error)
    return NextResponse.json({ error: "Unauthorized or error occurred" }, { status: 401 })
  }
}
