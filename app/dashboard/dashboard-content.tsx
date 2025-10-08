"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Shield, AlertTriangle, Rss } from "lucide-react"
import useSWR from "swr"
import { fetchDashboardStats, fetchCronStatus } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export function DashboardContent() {
  // Auto-refresh every 15 seconds
  const { data: stats, isLoading: statsLoading } = useSWR("dashboard-stats", fetchDashboardStats, {
    refreshInterval: 15000,
  })

  const { data: cronJobs, isLoading: cronLoading } = useSWR("cron-status", fetchCronStatus, {
    refreshInterval: 10000,
  })

  return (
    <main className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-slate-400">Real-time threat intelligence monitoring</p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Raw Indicators</CardTitle>
            <Database className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white">{stats?.totalRawIndicators.toLocaleString()}</div>
            )}
            <p className="text-xs text-slate-500">Total collected</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Validated</CardTitle>
            <Shield className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white">{stats?.totalValidatedIndicators.toLocaleString()}</div>
            )}
            <p className="text-xs text-slate-500">Processed indicators</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Malicious</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-red-400">{stats?.maliciousIndicators.toLocaleString()}</div>
            )}
            <p className="text-xs text-slate-500">Confirmed threats</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Active Feeds</CardTitle>
            <Rss className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white">{stats?.activeFeeds}</div>
            )}
            <p className="text-xs text-slate-500">Sources enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* CRON Jobs Status */}
      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white">System Status</CardTitle>
          <CardDescription className="text-slate-400">CRON jobs and automation status</CardDescription>
        </CardHeader>
        <CardContent>
          {cronLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full bg-slate-800" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {cronJobs?.map((job) => (
                <div
                  key={job.job_name}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <Activity
                      className={`h-5 w-5 ${
                        job.status === "completed"
                          ? "text-green-400"
                          : job.status === "running"
                            ? "text-blue-400"
                            : "text-red-400"
                      }`}
                    />
                    <div>
                      <div className="font-medium text-white">{job.job_name.replace(/_/g, " ").toUpperCase()}</div>
                      <div className="text-sm text-slate-400">
                        {job.last_run ? `Last run: ${new Date(job.last_run).toLocaleString()}` : "Never run"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {job.indicators_processed !== null && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{job.indicators_processed}</div>
                        <div className="text-xs text-slate-500">processed</div>
                      </div>
                    )}
                    {job.duration_ms !== null && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-white">{(job.duration_ms / 1000).toFixed(1)}s</div>
                        <div className="text-xs text-slate-500">duration</div>
                      </div>
                    )}
                    <Badge
                      variant={
                        job.status === "completed" ? "default" : job.status === "running" ? "secondary" : "destructive"
                      }
                      className={
                        job.status === "completed"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : job.status === "running"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function Database(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
}
