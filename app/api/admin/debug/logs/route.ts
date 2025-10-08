import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/auth-utils"

export async function GET(request: Request) {
  try {
    await requireSuperAdmin()

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100")

    const supabase = await createClient()

    // Get recent validation results for debugging
    const { data: recentValidations, error } = await supabase
      .from("validation_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ logs: recentValidations })
  } catch (error) {
    console.error("[v0] Debug logs error:", error)
    return NextResponse.json({ error: "Unauthorized or error occurred" }, { status: 401 })
  }
}
