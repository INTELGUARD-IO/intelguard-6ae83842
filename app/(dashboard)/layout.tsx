"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useUserRole } from "@/hooks/useUserRole"
import { Toaster } from "sonner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const { isSuperAdmin, loading: roleLoading } = useUserRole()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session) {
        router.push("/auth")
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) {
        router.push("/auth")
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth")
  }

  if (!user || roleLoading) {
    return null
  }

  const isActive = (path: string) => pathname === path

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${
                isActive("/dashboard") ? "text-primary" : "hover:text-primary"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/threats"
              className={`text-sm font-medium transition-colors ${
                isActive("/threats") ? "text-primary" : "hover:text-primary"
              }`}
            >
              Threats
            </Link>
            <Link
              href="/indicators"
              className={`text-sm font-medium transition-colors ${
                isActive("/indicators") ? "text-primary" : "hover:text-primary"
              }`}
            >
              Indicators
            </Link>
            <Link
              href="/feed-tokens"
              className={`text-sm font-medium transition-colors ${
                isActive("/feed-tokens") ? "text-primary" : "hover:text-primary"
              }`}
            >
              Feed Tokens
            </Link>
            {isSuperAdmin && (
              <>
                <Link
                  href="/system"
                  className={`text-sm font-medium transition-colors ${
                    isActive("/system") ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  System
                </Link>
                <Link
                  href="/ingest-sources"
                  className={`text-sm font-medium transition-colors ${
                    isActive("/ingest-sources") ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  Sources
                </Link>
                <Link
                  href="/validators"
                  className={`text-sm font-medium transition-colors ${
                    isActive("/validators") ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  Validators
                </Link>
                <Link
                  href="/monitoring"
                  className={`text-sm font-medium transition-colors ${
                    isActive("/monitoring") ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  Monitoring
                </Link>
                <Link
                  href="/network-status"
                  className={`text-sm font-medium transition-colors ${
                    isActive("/network-status") ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  Network Status
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
