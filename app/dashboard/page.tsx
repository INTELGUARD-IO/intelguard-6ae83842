"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { DashboardContent } from "./dashboard-content"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />
      <DashboardContent />
    </div>
  )
}
