import { NextResponse } from "next/server"
import { isSuperAdmin } from "@/lib/auth-utils"

export async function GET() {
  try {
    const isSuper = await isSuperAdmin()
    return NextResponse.json({ isSuperAdmin: isSuper })
  } catch (error) {
    return NextResponse.json({ isSuperAdmin: false })
  }
}
