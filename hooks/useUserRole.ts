"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function useUserRole() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single()

        setRole(data?.role || "user")
      }

      setLoading(false)
    }

    fetchUserRole()
  }, [])

  return { role, loading, isAdmin: role === "admin" }
}
