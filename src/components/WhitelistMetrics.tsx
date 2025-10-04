import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Database, Play, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WhitelistStats {
  ciscoCount: number;
  cloudflareCount: number;
  totalUnique: number;
  lastSync: {
    cisco: string | null;
    cloudflare: string | null;
  };
  coverage: {
    whitelistedToday: number;
    deepValidatedToday: number;
    percentageWhitelisted: number;
  };
}

interface ValidationBreakdown {
  totalProcessed: number;
  whitelisted: number;
  ciscoOnly: number;
  cloudflareOnly: number;
  both: number;
  deepValidated: number;
  highConfidence: number;
  lowConfidence: number;
}

export default function WhitelistMetrics() {
  const [stats, setStats] = useState<WhitelistStats>({
    ciscoCount: 0,
    cloudflareCount: 0,
    totalUnique: 0,
    lastSync: { cisco: null, cloudflare: null },
    coverage: { whitelistedToday: 0, deepValidatedToday: 0, percentageWhitelisted: 0 }
  });
  const [breakdown, setBreakdown] = useState<ValidationBreakdown>({
    totalProcessed: 0,
    whitelisted: 0,
    ciscoOnly: 0,
    cloudflareOnly: 0,
    both: 0,
    deepValidated: 0,
    highConfidence: 0,
    lowConfidence: 0
  });
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState<Record<string, boolean>>({});

  const loadStats = async () => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Load whitelist counts
      const [ciscoRes, cloudflareRes] = await Promise.all([
        supabase.from('cisco_umbrella_top_domains').select('*', { count: 'exact', head: true }),
        supabase.from('cloudflare_radar_top_domains').select('*', { count: 'exact', head: true })
      ]);

      // Load last sync times
      const [ciscoLastSync, cloudflareLastSync] = await Promise.all([
        supabase.from('cisco_umbrella_top_domains').select('added_at').order('added_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cloudflare_radar_top_domains').select('added_at').order('added_at', { ascending: false }).limit(1).maybeSingle()
      ]);

      // Load today's coverage
      const [whitelistedToday, deepValidatedToday] = await Promise.all([
        supabase.from('dynamic_raw_indicators')
          .select('*', { count: 'exact', head: true })
          .eq('whitelisted', true)
          .gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators')
          .select('*', { count: 'exact', head: true })
          .eq('whitelisted', false)
          .gte('last_validated', twentyFourHoursAgo)
      ]);

      const totalToday = (whitelistedToday.count || 0) + (deepValidatedToday.count || 0);
      const percentageWhitelisted = totalToday > 0 
        ? Math.round(((whitelistedToday.count || 0) / totalToday) * 100)
        : 0;

      setStats({
        ciscoCount: ciscoRes.count || 0,
        cloudflareCount: cloudflareRes.count || 0,
        totalUnique: Math.max(ciscoRes.count || 0, cloudflareRes.count || 0),
        lastSync: {
          cisco: ciscoLastSync.data?.added_at || null,
          cloudflare: cloudflareLastSync.data?.added_at || null
        },
        coverage: {
          whitelistedToday: whitelistedToday.count || 0,
          deepValidatedToday: deepValidatedToday.count || 0,
          percentageWhitelisted
        }
      });

      // Load validation breakdown
      const [
        totalRes,
        whitelistedRes,
        ciscoOnlyRes,
        cloudflareOnlyRes,
        bothRes,
        deepValidatedRes,
        highConfidenceRes,
        lowConfidenceRes
      ] = await Promise.all([
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelisted', true).gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelist_source', 'cisco').gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelist_source', 'cloudflare').gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelist_source', 'both').gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('whitelisted', false).gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).gte('confidence', 70).eq('whitelisted', false).gte('last_validated', twentyFourHoursAgo),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).lt('confidence', 70).eq('whitelisted', false).gte('last_validated', twentyFourHoursAgo)
      ]);

      setBreakdown({
        totalProcessed: totalRes.count || 0,
        whitelisted: whitelistedRes.count || 0,
        ciscoOnly: ciscoOnlyRes.count || 0,
        cloudflareOnly: cloudflareOnlyRes.count || 0,
        both: bothRes.count || 0,
        deepValidated: deepValidatedRes.count || 0,
        highConfidence: highConfidenceRes.count || 0,
        lowConfidence: lowConfidenceRes.count || 0
      });

    } catch (error) {
      console.error('Error loading whitelist stats:', error);
      toast.error('Failed to load whitelist statistics');
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (functionName: string, displayName: string) => {
    setSyncLoading(prev => ({ ...prev, [functionName]: true }));
    
    try {
      const { error } = await supabase.functions.invoke(functionName, {
        body: { triggered_by: 'manual_ui', timestamp: new Date().toISOString() }
      });

      if (error) throw error;

      toast.success(`${displayName} sync started successfully`);
      
      setTimeout(() => loadStats(), 3000);
    } catch (error: any) {
      console.error(`Error triggering ${functionName}:`, error);
      toast.error(`Failed to start ${displayName}: ${error.message || 'Unknown error'}`);
    } finally {
      setSyncLoading(prev => ({ ...prev, [functionName]: false }));
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const isOutdated = (dateString: string | null) => {
    if (!dateString) return true;
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    return diffDays > 7;
  };

  if (loading) return null;

  const showOutdatedAlert = isOutdated(stats.lastSync.cisco) || isOutdated(stats.lastSync.cloudflare);

  return (
    <div className="space-y-4">
      {showOutdatedAlert && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Whitelists outdated! Cisco: {formatDate(stats.lastSync.cisco)}, Cloudflare: {formatDate(stats.lastSync.cloudflare)}
          </AlertDescription>
        </Alert>
      )}

      {/* Whitelist Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Whitelist Status
          </CardTitle>
          <CardDescription>Top domain lists from trusted sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">Cisco Umbrella</Badge>
                </div>
                <div className="text-2xl font-bold">{stats.ciscoCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last sync: {formatDate(stats.lastSync.cisco)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500">Cloudflare Radar</Badge>
                </div>
                <div className="text-2xl font-bold">{stats.cloudflareCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last sync: {formatDate(stats.lastSync.cloudflare)}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Total Unique</Badge>
                </div>
                <div className="text-2xl font-bold">~{stats.totalUnique.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Combined domains</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Today's Coverage</h4>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">Whitelisted</span>
                    <span className="text-xs font-medium">{stats.coverage.percentageWhitelisted}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${stats.coverage.percentageWhitelisted}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.coverage.whitelistedToday.toLocaleString()} indicators
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">Deep Validated</span>
                    <span className="text-xs font-medium">{100 - stats.coverage.percentageWhitelisted}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${100 - stats.coverage.percentageWhitelisted}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.coverage.deepValidatedToday.toLocaleString()} indicators
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => triggerSync('cisco-umbrella-domains-sync', 'Cisco Umbrella')}
                      disabled={syncLoading['cisco-umbrella-domains-sync']}
                      variant="outline"
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {syncLoading['cisco-umbrella-domains-sync'] ? 'Syncing...' : 'Sync Cisco'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">🔧 Debug: Manual sync (auto-runs daily at 2 AM UTC)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => triggerSync('cloudflare-radar-domains-sync', 'Cloudflare Radar')}
                      disabled={syncLoading['cloudflare-radar-domains-sync']}
                      variant="outline"
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {syncLoading['cloudflare-radar-domains-sync'] ? 'Syncing...' : 'Sync Cloudflare'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">🔧 Debug: Manual sync (auto-runs daily at 3 AM UTC)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => triggerSync('whitelist-cross-validator', 'Cross Validator')}
                      disabled={syncLoading['whitelist-cross-validator']}
                      variant="outline"
                      size="sm"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      {syncLoading['whitelist-cross-validator'] ? 'Validating...' : 'Cross-Validate'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">🔧 Debug: Manual validation (auto-runs hourly)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Validation Breakdown (Last 24h)
          </CardTitle>
          <CardDescription>Distribution of validation results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Total Processed Today</span>
                <span className="text-2xl font-bold">{breakdown.totalProcessed.toLocaleString()}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Whitelisted (confidence=0)</span>
                  <span className="font-semibold">{breakdown.whitelisted.toLocaleString()} ({Math.round((breakdown.whitelisted / breakdown.totalProcessed) * 100)}%)</span>
                </div>
                <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>• Both lists</span>
                    <span>{breakdown.both.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Cisco only</span>
                    <span>{breakdown.ciscoOnly.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Cloudflare only</span>
                    <span>{breakdown.cloudflareOnly.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">Deep Validated</span>
                  <span className="font-semibold">{breakdown.deepValidated.toLocaleString()} ({Math.round((breakdown.deepValidated / breakdown.totalProcessed) * 100)}%)</span>
                </div>
                <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>• High confidence (≥70)</span>
                    <span>{breakdown.highConfidence.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Low confidence (&lt;70)</span>
                    <span>{breakdown.lowConfidence.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {breakdown.whitelisted > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">
                    API Quota Saved
                  </Badge>
                  <span className="font-semibold">~{(breakdown.whitelisted * 10).toLocaleString()} calls</span>
                  <span className="text-muted-foreground">(${Math.round(breakdown.whitelisted * 10 * 0.02).toLocaleString()})</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
