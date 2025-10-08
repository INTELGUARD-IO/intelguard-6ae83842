import type React from "react"
import { requireSuperAdmin } from "@/lib/auth-check"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // This will redirect to dashboard if not superadmin
  await requireSuperAdmin()

  return <>{children}</>
}
