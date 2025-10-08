"use client"

import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useSWR from "swr"
import { fetchRawIndicators, fetchValidatedIndicators } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import { Search } from "lucide-react"

export default function IndicatorsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  // Auto-refresh every 15 seconds (snapshot interval)
  const { data: rawIndicators, isLoading: rawLoading } = useSWR("raw-indicators", () => fetchRawIndicators(500), {
    refreshInterval: 15000,
  })

  const { data: validatedIndicators, isLoading: validatedLoading } = useSWR(
    "validated-indicators",
    () => fetchValidatedIndicators(500),
    {
      refreshInterval: 15000,
    },
  )

  const filteredRaw = rawIndicators?.filter((ind) => ind.indicator.toLowerCase().includes(searchQuery.toLowerCase()))

  const filteredValidated = validatedIndicators?.filter((ind) =>
    ind.indicator.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />

      <main className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Threat Indicators</h1>
          <p className="text-slate-400">Browse and search threat intelligence indicators</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search indicators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-slate-700 bg-slate-800/50 pl-10 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        <Tabs defaultValue="raw" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="raw" className="data-[state=active]:bg-slate-700">
              Raw Indicators
            </TabsTrigger>
            <TabsTrigger value="validated" className="data-[state=active]:bg-slate-700">
              Validated Indicators
            </TabsTrigger>
          </TabsList>

          <TabsContent value="raw">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Raw Indicators</CardTitle>
                <CardDescription className="text-slate-400">
                  Indicators collected from threat intelligence feeds (snapshot updates every 15 minutes)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rawLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredRaw?.slice(0, 100).map((indicator) => (
                      <div
                        key={indicator.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-3"
                      >
                        <div className="flex items-center gap-4">
                          <Badge
                            variant="outline"
                            className={
                              indicator.kind === "ipv4"
                                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                : "border-purple-500/20 bg-purple-500/10 text-purple-400"
                            }
                          >
                            {indicator.kind}
                          </Badge>
                          <code className="font-mono text-sm text-white">{indicator.indicator}</code>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>{indicator.source}</span>
                          <span>{new Date(indicator.first_seen).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validated">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white">Validated Indicators</CardTitle>
                <CardDescription className="text-slate-400">
                  Indicators validated by multiple threat intelligence sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {validatedLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredValidated?.slice(0, 100).map((indicator) => (
                      <div
                        key={indicator.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-3"
                      >
                        <div className="flex items-center gap-4">
                          <Badge
                            variant="outline"
                            className={
                              indicator.kind === "ipv4"
                                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                : "border-purple-500/20 bg-purple-500/10 text-purple-400"
                            }
                          >
                            {indicator.kind}
                          </Badge>
                          <code className="font-mono text-sm text-white">{indicator.indicator}</code>
                          <Badge
                            variant="outline"
                            className={
                              indicator.threat_type === "malicious"
                                ? "border-red-500/20 bg-red-500/10 text-red-400"
                                : "border-green-500/20 bg-green-500/10 text-green-400"
                            }
                          >
                            {indicator.threat_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <div className="font-medium text-white">{indicator.confidence}%</div>
                            <div className="text-xs text-slate-500">confidence</div>
                          </div>
                          {indicator.country && (
                            <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300">
                              {indicator.country}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
