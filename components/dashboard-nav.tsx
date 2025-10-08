"use client"

import { Shield, LogOut, Activity, Database, Settings, Users, Bug } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useEffect, useState } from "react"

async function fetchUserRole() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return profile?.role || null
}

async function checkIsSuperAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  // Call API to check if user is superadmin
  try {
    const res = await fetch("/api/admin/debug/check-superadmin")
    const data = await res.json()
    return data.isSuperAdmin || false
  } catch {
    return false
  }
}

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: userRole } = useSWR("user-role", fetchUserRole)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    checkIsSuperAdmin().then(setIsSuperAdmin)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: Activity },
    { href: "/dashboard/indicators", label: "Indicators", icon: Database },
    { href: "/dashboard/feeds", label: "Feeds", icon: Settings },
  ]

  // Add admin link for superadmin
  if (userRole === "superadmin") {
    navItems.push({ href: "/admin", label: "Admin", icon: Users })
  }

  if (isSuperAdmin) {
    navItems.push({ href: "/admin/debug", label: "Debug", icon: Bug })
  }

  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">INTELGUARD</span>
          </Link>

          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`gap-2 ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {userRole && (
            <div className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">{userRole}</div>
          )}
          {isSuperAdmin && (
            <div className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">SUPERADMIN</div>
          )}
          <Button variant="ghost" onClick={handleSignOut} className="gap-2 text-slate-400 hover:text-white">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  )
}
