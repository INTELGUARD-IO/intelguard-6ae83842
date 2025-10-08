"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Rss, Database, Settings } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import useSWR from "swr"

async function fetchStats() {
  const response = await fetch("/api/admin/stats")
  if (!response.ok) throw new Error("Failed to fetch stats")
  return response.json()
}

export default function AdminPage() {
  const { data: stats } = useSWR("admin-stats", fetchStats)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />

      <main className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-slate-400">System administration and management</p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Total Users</CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.usersCount || 0}</div>
              <p className="text-xs text-slate-500">Registered accounts</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Feed Sources</CardTitle>
              <Rss className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.feedsCount || 0}</div>
              <p className="text-xs text-slate-500">Configured feeds</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Tenants</CardTitle>
              <Database className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.tenantsCount || 0}</div>
              <p className="text-xs text-slate-500">Organizations</p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">System Status</CardTitle>
              <Settings className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">Healthy</div>
              <p className="text-xs text-slate-500">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">User Management</CardTitle>
              <CardDescription className="text-slate-400">Manage users, roles, and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/admin/users">Manage Users</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Feed Management</CardTitle>
              <CardDescription className="text-slate-400">Configure threat intelligence feed sources</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                <Link href="/admin/feeds">Manage Feeds</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Debug Panel</CardTitle>
              <CardDescription className="text-slate-400">Backend operations and system monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-red-600 hover:bg-red-700">
                <Link href="/admin/debug">Debug Panel</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">System Settings</CardTitle>
              <CardDescription className="text-slate-400">Configure global system settings</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-orange-600 hover:bg-orange-700">
                <Link href="/admin/settings">System Settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
