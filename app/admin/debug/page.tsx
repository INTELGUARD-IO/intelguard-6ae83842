"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, Zap, Shield, FileText, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { DashboardNav } from "@/components/dashboard-nav"

export default function DebugPage() {
  const [loading, setLoading] = useState(true)
  const [dbStats, setDbStats] = useState<any>(null)
  const [cronJobs, setCronJobs] = useState<any[]>([])
  const [validators, setValidators] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dbRes, cronRes, validatorRes, logsRes] = await Promise.all([
        fetch("/api/admin/debug/database"),
        fetch("/api/admin/debug/cron"),
        fetch("/api/admin/debug/validators"),
        fetch("/api/admin/debug/logs?limit=50"),
      ])

      if (!dbRes.ok || !cronRes.ok || !validatorRes.ok || !logsRes.ok) {
        throw new Error("Unauthorized or error fetching debug data")
      }

      const [dbData, cronData, validatorData, logsData] = await Promise.all([
        dbRes.json(),
        cronRes.json(),
        validatorRes.json(),
        logsRes.json(),
      ])

      setDbStats(dbData.database)
      setCronJobs(cronData.cronJobs || [])
      setValidators(validatorData.validators || [])
      setLogs(logsData.logs || [])
    } catch (error) {
      console.error("[v0] Debug fetch error:", error)
      toast.error("Failed to load debug data. Are you the superadmin?")
    } finally {
      setLoading(false)
    }
  }

  const triggerCronJob = async (jobName: string) => {
    try {
      toast.loading(`Triggering ${jobName}...`)
      const res = await fetch("/api/admin/debug/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobName }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(`${jobName} triggered successfully`)
        fetchData()
      } else {
        toast.error(`Failed to trigger ${jobName}`)
      }
    } catch (error) {
      toast.error("Error triggering CRON job")
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <DashboardNav />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
            <p className="text-slate-400">Loading debug panel...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">🔧 Superadmin Debug Panel</h1>
            <p className="text-slate-400">Backend operations and system monitoring</p>
          </div>
          <Button
            onClick={fetchData}
            variant="outline"
            className="border-slate-700 text-white hover:bg-slate-800 bg-transparent"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="database" className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="database" className="data-[state=active]:bg-slate-800">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
            <TabsTrigger value="cron" className="data-[state=active]:bg-slate-800">
              <Zap className="h-4 w-4 mr-2" />
              CRON Jobs
            </TabsTrigger>
            <TabsTrigger value="validators" className="data-[state=active]:bg-slate-800">
              <Shield className="h-4 w-4 mr-2" />
              Validators
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800">
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dbStats &&
                Object.entries(dbStats).map(([key, value]) => (
                  <Card key={key}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{value as number}</div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="cron" className="space-y-4">
            <div className="grid gap-4">
              {cronJobs.map((job) => (
                <Card key={job.job_name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{job.job_name}</CardTitle>
                        <CardDescription>
                          Last run: {job.last_run ? new Date(job.last_run).toLocaleString() : "Never"}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={job.status === "success" ? "default" : "destructive"}>{job.status}</Badge>
                        <Button size="sm" onClick={() => triggerCronJob(job.job_name)}>
                          <Zap className="h-4 w-4 mr-2" />
                          Trigger
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {job.error_message && (
                    <CardContent>
                      <p className="text-sm text-destructive">{job.error_message}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="validators" className="space-y-4">
            <div className="grid gap-4">
              {validators.map((validator) => (
                <Card key={validator.validator_name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{validator.validator_name}</CardTitle>
                        <CardDescription>
                          Last check: {validator.last_check ? new Date(validator.last_check).toLocaleString() : "Never"}
                        </CardDescription>
                      </div>
                      <Badge variant={validator.is_operational ? "default" : "destructive"}>
                        {validator.is_operational ? "Operational" : "Down"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requests today:</span>
                        <span className="font-medium">{validator.requests_today || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Success rate:</span>
                        <span className="font-medium">{validator.success_rate || 0}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Validation Logs</CardTitle>
                <CardDescription>Last 50 validation results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div className="flex-1">
                        <div className="font-medium">{log.indicator_value}</div>
                        <div className="text-muted-foreground">
                          {log.validator_name} • {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={log.is_malicious ? "destructive" : "secondary"}>
                        {log.is_malicious ? "Malicious" : "Clean"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
