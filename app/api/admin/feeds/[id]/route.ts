import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth-utils"

/**
 * Update feed source (superadmin only)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("superadmin")

    const { id } = await params
    const body = await request.json()

    const supabase = await createClient()

    const { error } = await supabase.from("ingest_sources").update(body).eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * Delete feed source (superadmin only)
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("superadmin")

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase.from("ingest_sources").delete().eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
