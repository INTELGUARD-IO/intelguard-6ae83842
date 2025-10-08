"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function useRequireAuth() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    console.log("[v0] useRequireAuth - Starting auth check")

    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[v0] Auth state changed:", event, "session:", session ? "exists" : "null")

      if (event === "SIGNED_OUT" || !session) {
        console.log("[v0] No session, redirecting to login")
        router.push("/auth/login")
        setIsLoading(false)
        return
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session) {
        console.log("[v0] User authenticated:", session.user.email)
        setUser(session.user)
        setIsLoading(false)
      }
    })

    // Initial check
    const checkInitialAuth = async () => {
      try {
        console.log("[v0] Checking initial auth state")
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        console.log("[v0] Initial session check:", {
          hasSession: !!session,
          error: error?.message,
          userEmail: session?.user?.email,
        })

        if (error) {
          console.error("[v0] Session error:", error)
          router.push("/auth/login")
          setIsLoading(false)
          return
        }

        if (!session) {
          console.log("[v0] No initial session, redirecting to login")
          router.push("/auth/login")
          setIsLoading(false)
          return
        }

        console.log("[v0] Initial session valid, user:", session.user.email)
        setUser(session.user)
        setIsLoading(false)
      } catch (error) {
        console.error("[v0] Auth check error:", error)
        router.push("/auth/login")
        setIsLoading(false)
      }
    }

    checkInitialAuth()

    return () => {
      console.log("[v0] Cleaning up auth subscription")
      subscription.unsubscribe()
    }
  }, [router])

  return { isLoading, user }
}

export function useRequireSuperAdmin() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    console.log("[v0] useRequireSuperAdmin - Starting superadmin check")

    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[v0] Superadmin auth state changed:", event)

      if (event === "SIGNED_OUT" || !session) {
        console.log("[v0] No session, redirecting to login")
        router.push("/auth/login")
        setIsLoading(false)
        return
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session) {
        // Check superadmin status
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", session.user.email)
          .single()

        console.log("[v0] Profile check:", {
          role: profile?.role,
          error: error?.message,
        })

        if (error || !profile || profile.role !== "superadmin") {
          console.log("[v0] Not superadmin, redirecting to dashboard")
          router.push("/dashboard")
          setIsLoading(false)
          return
        }

        console.log("[v0] Superadmin authenticated:", session.user.email)
        setUser(session.user)
        setProfile(profile)
        setIsLoading(false)
      }
    })

    // Initial check
    const checkInitialAuth = async () => {
      try {
        console.log("[v0] Checking initial superadmin auth state")
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError || !session) {
          console.log("[v0] No session, redirecting to login")
          router.push("/auth/login")
          setIsLoading(false)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", session.user.email)
          .single()

        console.log("[v0] Initial profile check:", {
          role: profile?.role,
          error: profileError?.message,
        })

        if (profileError || !profile || profile.role !== "superadmin") {
          console.log("[v0] Not superadmin, redirecting to dashboard")
          router.push("/dashboard")
          setIsLoading(false)
          return
        }

        console.log("[v0] Initial superadmin check passed:", session.user.email)
        setUser(session.user)
        setProfile(profile)
        setIsLoading(false)
      } catch (error) {
        console.error("[v0] Superadmin check error:", error)
        router.push("/dashboard")
        setIsLoading(false)
      }
    }

    checkInitialAuth()

    return () => {
      console.log("[v0] Cleaning up superadmin auth subscription")
      subscription.unsubscribe()
    }
  }, [router])

  return { isLoading, user, profile }
}
