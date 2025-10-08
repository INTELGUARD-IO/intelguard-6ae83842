import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/auth-utils"

export async function GET() {
  try {
    await requireSuperAdmin()

    const supabase = await createClient()

    // Get validator statistics
    const { data: validatorStats, error } = await supabase
      .from("validator_status")
      .select("*")
      .order("last_check", { ascending: false })

    if (error) throw error

    // Get quota information
    const { data: quotaInfo } = await supabase.from("abuseipdb_quota").select("*").single()

    return NextResponse.json({
      validators: validatorStats,
      quota: quotaInfo,
    })
  } catch (error) {
    console.error("[v0] Debug validators error:", error)
    return NextResponse.json({ error: "Unauthorized or error occurred" }, { status: 401 })
  }
}
