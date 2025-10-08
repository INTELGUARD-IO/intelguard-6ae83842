import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/auth-utils"

/**
 * Create new feed source (superadmin only)
 */
export async function POST(request: Request) {
  try {
    await requireRole("superadmin")

    const body = await request.json()
    const { name, url, type, priority, enabled, description } = body

    if (!name || !url || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("ingest_sources")
      .insert({
        name,
        url,
        kind: type,
        priority: priority || 1,
        enabled: enabled !== false,
        description: description || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, feed: data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
