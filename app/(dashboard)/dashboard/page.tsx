"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe, Activity, Database, Layers } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Stats {
  rawTotal: number
  rawIpv4: number
  rawDomains: number
  rawSources: number
  validatedTotal: number
  validatedIpv4: number
  validatedDomains: number
  recentDelta: { added: number; removed: number } | null
  enrichedCount: number
  topCountries: Array<{ country: string; count: number }>
  bgpviewEnriched: number
  bgpviewPtrCount: number
  bgpviewTopCountries: string[]
  cfRadarEnriched: number
  cfRadarTopCountries: string[]
  whitelistDomains: number
  whitelistedIndicators: number
  lastWhitelistSync: string | null
  otxValidated: number
  safeBrowsingValidated: number
  safeBrowsingThreats: number
}

export default function Dashboard() {
  const { toast } = useToast()

  const [stats, setStats] = useState<Stats>({
    rawTotal: 0,
    rawIpv4: 0,
    rawDomains: 0,
    rawSources: 0,
    validatedTotal: 0,
    validatedIpv4: 0,
    validatedDomains: 0,
    recentDelta: null,
    enrichedCount: 0,
    topCountries: [],
    bgpviewEnriched: 0,
    bgpviewPtrCount: 0,
    bgpviewTopCountries: [],
    cfRadarEnriched: 0,
    cfRadarTopCountries: [],
    whitelistDomains: 0,
    whitelistedIndicators: 0,
    lastWhitelistSync: null,
    otxValidated: 0,
    safeBrowsingValidated: 0,
    safeBrowsingThreats: 0,
  })
  const [loading, setLoading] = useState(true)
  const [syncingWhitelist, setSyncingWhitelist] = useState(false)
  const [validatingDomains, setValidatingDomains] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const syncWhitelist = async () => {
    if (syncingWhitelist) return
    setSyncingWhitelist(true)
    try {
      toast({ title: "🔄 Syncing Top 100K domains from Cloudflare Radar..." })
      const { error } = await supabase.functions.invoke("cloudflare-radar-domains-sync")

      if (error) throw error

      toast({ title: "✅ Top 100K domains synced successfully!" })
      setTimeout(loadStats, 1000)
    } catch (error: any) {
      console.error("Sync error:", error)
      toast({ title: `❌ Sync failed: ${error.message}`, variant: "destructive" })
    } finally {
      setSyncingWhitelist(false)
    }
  }

  const validateDomains = async () => {
    if (validatingDomains) return
    setValidatingDomains(true)
    try {
      toast({ title: "🔍 Running domain validation against whitelist..." })
      const { error } = await supabase.functions.invoke("cloudflare-radar-domain-validator")

      if (error) throw error

      toast({ title: "✅ Domain validation completed!" })
      setTimeout(loadStats, 1000)
    } catch (error: any) {
      console.error("Validation error:", error)
      toast({ title: `❌ Validation failed: ${error.message}`, variant: "destructive" })
    } finally {
      setValidatingDomains(false)
    }
  }

  const loadStats = async () => {
    try {
      const [
        { data: rawStatsArray },
        { data: dashboardStatsArray },
        { data: enabledSourcesData },
        { data: deltaData },
      ] = await Promise.all([
        supabase.rpc("get_raw_indicator_stats"),
        supabase.rpc("get_dashboard_stats"),
        supabase.from("ingest_sources").select("id").eq("enabled", true),
        supabase.from("daily_deltas").select("*").order("run_date", { ascending: false }).limit(2),
      ])

      const rawStats = rawStatsArray?.[0]
      const ipv4Stats = dashboardStatsArray?.find((s: any) => s.kind === "ipv4")
      const domainStats = dashboardStatsArray?.find((s: any) => s.kind === "domain")

      const [
        { count: enrichedCount },
        { data: enrichedData },
        { count: bgpviewCount },
        { data: bgpviewData },
        { count: cfRadarCount },
        { data: cfRadarData },
      ] = await Promise.all([
        supabase.from("ripestat_enrichment").select("*", { count: "exact", head: true }),
        supabase
          .from("ripestat_enrichment")
          .select("country_code")
          .gt("expires_at", new Date().toISOString())
          .limit(10000),
        supabase.from("bgpview_enrichment").select("*", { count: "exact", head: true }),
        supabase
          .from("bgpview_enrichment")
          .select("ptr_record, country_code")
          .gt("expires_at", new Date().toISOString())
          .limit(10000),
        supabase.from("cloudflare_radar_enrichment").select("*", { count: "exact", head: true }),
        supabase
          .from("cloudflare_radar_enrichment")
          .select("country_code")
          .gt("expires_at", new Date().toISOString())
          .limit(10000),
      ])

      const [
        { count: whitelistedCount },
        { count: otxValidatedCount },
        { count: safeBrowsingValidatedCount },
        { count: safeBrowsingThreatsCount },
      ] = await Promise.all([
        supabase
          .from("dynamic_raw_indicators")
          .select("*", { count: "exact", head: true })
          .eq("kind", "domain")
          .eq("whitelisted", true),
        supabase.from("dynamic_raw_indicators").select("*", { count: "exact", head: true }).eq("otx_checked", true),
        supabase
          .from("dynamic_raw_indicators")
          .select("*", { count: "exact", head: true })
          .eq("safebrowsing_checked", true),
        supabase
          .from("dynamic_raw_indicators")
          .select("*", { count: "exact", head: true })
          .eq("safebrowsing_checked", true)
          .gte("safebrowsing_score", 50),
      ])

      let recentDelta = null
      if (deltaData && deltaData.length > 0) {
        const ipv4Delta = deltaData.find((d) => d.kind === "ipv4")
        const domainDelta = deltaData.find((d) => d.kind === "domain")
        recentDelta = {
          added: (ipv4Delta?.added || 0) + (domainDelta?.added || 0),
          removed: (ipv4Delta?.removed || 0) + (domainDelta?.removed || 0),
        }
      }

      const countryCounts: Record<string, number> = {}
      enrichedData?.forEach((item) => {
        if (item.country_code) {
          countryCounts[item.country_code] = (countryCounts[item.country_code] || 0) + 1
        }
      })
      const topCountries = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const bgpviewPtrCount = bgpviewData?.filter((item) => item.ptr_record).length || 0
      const bgpviewCountryCounts: Record<string, number> = {}
      bgpviewData?.forEach((item) => {
        if (item.country_code) {
          bgpviewCountryCounts[item.country_code] = (bgpviewCountryCounts[item.country_code] || 0) + 1
        }
      })
      const bgpviewTopCountries = Object.entries(bgpviewCountryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country]) => country)

      const cfRadarCountryCounts: Record<string, number> = {}
      cfRadarData?.forEach((item) => {
        if (item.country_code) {
          cfRadarCountryCounts[item.country_code] = (cfRadarCountryCounts[item.country_code] || 0) + 1
        }
      })
      const cfRadarTopCountries = Object.entries(cfRadarCountryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country]) => country)

      setStats({
        rawTotal: rawStats?.total_count || 0,
        rawIpv4: rawStats?.ipv4_count || 0,
        rawDomains: rawStats?.domain_count || 0,
        rawSources: enabledSourcesData?.length || 0,
        validatedTotal: (ipv4Stats?.validated_count || 0) + (domainStats?.validated_count || 0),
        validatedIpv4: ipv4Stats?.validated_count || 0,
        validatedDomains: domainStats?.validated_count || 0,
        recentDelta,
        enrichedCount: enrichedCount || 0,
        topCountries,
        bgpviewEnriched: bgpviewCount || 0,
        bgpviewPtrCount,
        bgpviewTopCountries,
        cfRadarEnriched: cfRadarCount || 0,
        cfRadarTopCountries,
        whitelistDomains: 0,
        whitelistedIndicators: whitelistedCount || 0,
        lastWhitelistSync: null,
        otxValidated: otxValidatedCount || 0,
        safeBrowsingValidated: safeBrowsingValidatedCount || 0,
        safeBrowsingThreats: safeBrowsingThreatsCount || 0,
      })
    } catch (error) {
      console.error("Error loading stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const SectionHeader = ({
    title,
    badge,
    icon: Icon,
  }: {
    title: string
    badge: string
    icon: any
  }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <span className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">{badge}</span>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">IntelGuard Dashboard</h1>
        <p className="text-muted-foreground mt-2">Threat Intelligence Management Platform</p>
      </div>

      <div className="space-y-4">
        <SectionHeader title="Raw Indicators Pipeline" badge="Unprocessed Data" icon={Database} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Raw</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rawTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All collected indicators</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Raw IPv4</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rawIpv4.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">IP addresses collected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Raw Domains</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rawDomains.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Domains collected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sources</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rawSources}</div>
              <p className="text-xs text-muted-foreground">Active data sources</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
