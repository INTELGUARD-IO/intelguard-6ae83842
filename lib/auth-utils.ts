import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types"

/**
 * Get current user profile with role
 */
export async function getCurrentUserProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return profile
}

/**
 * Check if user has required role
 */
export async function hasRole(requiredRole: UserRole): Promise<boolean> {
  const profile = await getCurrentUserProfile()

  if (!profile) return false

  const roleHierarchy: Record<UserRole, number> = {
    superadmin: 4,
    msp_admin: 3,
    msp_user: 2,
    customer: 1,
  }

  return roleHierarchy[profile.role as UserRole] >= roleHierarchy[requiredRole]
}

/**
 * Require specific role or throw error
 */
export async function requireRole(requiredRole: UserRole) {
  const hasRequiredRole = await hasRole(requiredRole)

  if (!hasRequiredRole) {
    throw new Error("Insufficient permissions")
  }
}

/**
 * Check if current user is the superadmin (based on SUPERADMIN_EMAIL env var)
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const superadminEmail = process.env.SUPERADMIN_EMAIL

  if (!superadminEmail) {
    console.warn("[v0] SUPERADMIN_EMAIL not configured")
    return false
  }

  return user.email === superadminEmail
}

/**
 * Require superadmin access or throw error
 */
export async function requireSuperAdmin() {
  const isSuper = await isSuperAdmin()

  if (!isSuper) {
    throw new Error("Superadmin access required")
  }
}
