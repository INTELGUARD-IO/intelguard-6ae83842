"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import useSWR from "swr"
import { fetchFeedStatus } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export default function FeedsPage() {
  const [isTriggering, setIsTriggering] = useState(false)

  // Auto-refresh every 30 seconds
  const {
    data: feeds,
    isLoading,
    mutate,
  } = useSWR("feed-status", fetchFeedStatus, {
    refreshInterval: 30000,
  })

  const handleTriggerFetch = async () => {
    setIsTriggering(true)
    try {
      const response = await fetch("/api/admin/feeds/trigger", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to trigger feed fetch")
      }

      const data = await response.json()
      toast.success(`Feed fetch completed: ${data.stats.successCount} successful, ${data.stats.errorCount} errors`)
      mutate() // Refresh the feed status
    } catch (error) {
      toast.error("Failed to trigger feed fetch")
      console.error(error)
    } finally {
      setIsTriggering(false)
    }
  }

  const activeFeeds = feeds?.filter((f) => f.enabled) || []
  const inactiveFeeds = feeds?.filter((f) => !f.enabled) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />

      <main className="container mx-auto p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Feed Sources</h1>
            <p className="text-slate-400">Manage threat intelligence feed sources</p>
          </div>
          <Button onClick={handleTriggerFetch} disabled={isTriggering} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={`h-4 w-4 ${isTriggering ? "animate-spin" : ""}`} />
            {isTriggering ? "Fetching..." : "Trigger Fetch"}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Active Feeds */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Active Feeds ({activeFeeds.length})</CardTitle>
              <CardDescription className="text-slate-400">
                Currently enabled threat intelligence sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full bg-slate-800" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {activeFeeds.map((feed) => {
                    const hasError = feed.last_error !== null
                    const lastRunDate = feed.last_run ? new Date(feed.last_run) : null
                    const lastSuccessDate = feed.last_success ? new Date(feed.last_success) : null

                    return (
                      <div
                        key={feed.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-4"
                      >
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-3">
                            <h3 className="font-medium text-white">{feed.name}</h3>
                            <Badge
                              variant="outline"
                              className={
                                hasError
                                  ? "border-red-500/20 bg-red-500/10 text-red-400"
                                  : "border-green-500/20 bg-green-500/10 text-green-400"
                              }
                            >
                              {hasError ? (
                                <>
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Error
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Active
                                </>
                              )}
                            </Badge>
                          </div>
                          <code className="text-xs text-slate-400">{feed.url}</code>
                          {hasError && <p className="mt-1 text-xs text-red-400">{feed.last_error}</p>}
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <div className="font-medium text-white">{feed.indicators_count || 0}</div>
                            <div className="text-xs text-slate-500">indicators</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-slate-400">
                              <Clock className="h-3 w-3" />
                              {lastSuccessDate ? lastSuccessDate.toLocaleTimeString() : "Never"}
                            </div>
                            <div className="text-xs text-slate-500">last success</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inactive Feeds */}
          {inactiveFeeds.length > 0 && (
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Inactive Feeds ({inactiveFeeds.length})</CardTitle>
                <CardDescription className="text-slate-400">Disabled threat intelligence sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {inactiveFeeds.map((feed) => (
                    <div
                      key={feed.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 p-4 opacity-60"
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-3">
                          <h3 className="font-medium text-white">{feed.name}</h3>
                          <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-400">
                            Disabled
                          </Badge>
                        </div>
                        <code className="text-xs text-slate-500">{feed.url}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
