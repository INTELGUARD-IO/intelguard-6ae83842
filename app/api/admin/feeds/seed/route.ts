import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check if user is superadmin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if feeds already exist
    const { count } = await supabase.from("feed_sources").select("*", { count: "exact", head: true })

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Feed sources already exist. Clear them first if you want to re-seed." },
        { status: 400 },
      )
    }

    // Read and execute the SQL script
    const sqlScript = await fetch(
      `${process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000"}/scripts/01-init-feed-sources.sql`,
    ).then((res) => res.text())

    // Note: Supabase client doesn't support raw SQL execution
    // You need to run this script manually in Supabase SQL Editor
    // or use the Supabase Management API

    return NextResponse.json({
      message: "Please run the SQL script manually in Supabase SQL Editor",
      script: "/scripts/01-init-feed-sources.sql",
    })
  } catch (error) {
    console.error("[v0] Error seeding feeds:", error)
    return NextResponse.json({ error: "Failed to seed feeds" }, { status: 500 })
  }
}
