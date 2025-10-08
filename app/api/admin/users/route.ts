import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth-utils"

/**
 * Get all users (superadmin only)
 */
export async function GET() {
  try {
    await requireRole("superadmin")

    const supabase = await createClient()

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(profiles || [])
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: error instanceof Error && error.message === "Insufficient permissions" ? 403 : 500 },
    )
  }
}

/**
 * Create new user (superadmin only)
 */
export async function POST(request: Request) {
  try {
    await requireRole("superadmin")

    const body = await request.json()
    const { email, password, role } = body

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email,
      role,
    })

    if (profileError) throw profileError

    return NextResponse.json({ success: true, user: authData.user })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
