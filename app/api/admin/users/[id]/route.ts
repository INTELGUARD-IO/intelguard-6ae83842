import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth-utils"

/**
 * Update user role (superadmin only)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("superadmin")

    const { id } = await params
    const body = await request.json()
    const { role } = body

    if (!role) {
      return NextResponse.json({ error: "Missing role" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.from("profiles").update({ role }).eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * Delete user (superadmin only)
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("superadmin")

    const { id } = await params
    const supabase = await createClient()

    // Delete auth user (cascade will delete profile)
    const { error } = await supabase.auth.admin.deleteUser(id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
