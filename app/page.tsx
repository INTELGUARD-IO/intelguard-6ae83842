import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { MetricsGrid } from "@/components/dashboard/metrics-grid"
import { ChartsGrid } from "@/components/dashboard/charts-grid"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { Sidebar } from "@/components/dashboard/sidebar"

export default function Page() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">
          <DashboardHeader />
          <MetricsGrid />
          <ChartsGrid />
          <ActivityFeed />
        </div>
      </main>
    </div>
  )
}
