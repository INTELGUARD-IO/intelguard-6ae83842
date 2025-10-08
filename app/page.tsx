import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">IntelGuard</h1>
          <p className="text-muted-foreground text-lg">Threat Intelligence Platform - Raw Indicators Management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Check system health and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/api/test">
                <Button variant="outline" className="w-full bg-transparent">
                  Test Database Connection
                </Button>
              </Link>
              <Link href="/api/indicators-count">
                <Button variant="outline" className="w-full bg-transparent">
                  View Indicators Count
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingest System</CardTitle>
              <CardDescription>Manage raw indicators ingestion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/api/load-feeds">
                <Button variant="outline" className="w-full bg-transparent">
                  Load Feed Sources
                </Button>
              </Link>
              <Link href="/api/start-auto-ingest">
                <Button variant="outline" className="w-full bg-transparent">
                  Start Auto Ingest
                </Button>
              </Link>
              <Link href="/api/deduplicate">
                <Button variant="outline" className="w-full bg-transparent">
                  Deduplicate Indicators
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monitoring</CardTitle>
              <CardDescription>View system metrics and logs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/sources">
                <Button variant="outline" className="w-full bg-transparent">
                  Sources Dashboard
                </Button>
              </Link>
              <Link href="/api/sources-report">
                <Button variant="outline" className="w-full bg-transparent">
                  Sources Report
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debug Tools</CardTitle>
              <CardDescription>Troubleshooting and diagnostics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/api/debug">
                <Button variant="outline" className="w-full bg-transparent">
                  System Debug
                </Button>
              </Link>
              <Link href="/api/fix-and-restart">
                <Button variant="outline" className="w-full bg-transparent">
                  Fix & Restart
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">1. Load Feed Sources</h3>
              <p className="text-sm text-muted-foreground">
                Click "Load Feed Sources" to populate the database with 102 threat intelligence feeds
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">2. Start Auto Ingest</h3>
              <p className="text-sm text-muted-foreground">
                Click "Start Auto Ingest" to begin downloading indicators from all feeds in parallel
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">3. Deduplicate</h3>
              <p className="text-sm text-muted-foreground">
                After ingestion completes, run "Deduplicate Indicators" to remove duplicates globally
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">4. Monitor Progress</h3>
              <p className="text-sm text-muted-foreground">
                Use "Sources Dashboard" to monitor feed status, errors, and indicator counts in real-time
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
