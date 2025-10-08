import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function requireAuth() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return user
}

export async function requireSuperAdmin() {
  const user = await requireAuth()

  const superAdminEmail = process.env.SUPERADMIN_EMAIL
  if (!superAdminEmail || user.email !== superAdminEmail) {
    redirect("/dashboard")
  }

  return user
}

export async function getUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
