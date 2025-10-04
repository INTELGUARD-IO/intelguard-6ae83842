import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Shield, Globe, Activity, TrendingUp, Database, Layers, Filter, PlayCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Stats {
  // Raw indicators (from raw_indicators table)
  rawTotal: number;
  rawIpv4: number;
  rawDomains: number;
  rawSources: number;
  
  // Validated indicators (from dynamic_raw_indicators table)
  validatedTotal: number;
  validatedIpv4: number;
  validatedDomains: number;
  recentDelta: { added: number; removed: number } | null;
  
  // RIPEstat enrichment stats
  enrichedCount: number;
  topCountries: Array<{ country: string; count: number }>;
  
  // BGPview enrichment stats
  bgpviewEnriched: number;
  bgpviewPtrCount: number;
  bgpviewTopCountries: string[];
  
  // Cloudflare Radar enrichment stats
  cfRadarEnriched: number;
  cfRadarTopCountries: string[];
  
  // Cloudflare Radar whitelist stats
  whitelistDomains: number;
  whitelistedIndicators: number;
  lastWhitelistSync: string | null;
  otxValidated: number;
  
  // Google Safe Browsing stats
  safeBrowsingValidated: number;
  safeBrowsingThreats: number;
}

export default function Dashboard() {
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
  });
  const [loading, setLoading] = useState(true);
  const [syncingWhitelist, setSyncingWhitelist] = useState(false);
  const [validatingDomains, setValidatingDomains] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const syncWhitelist = async () => {
    setSyncingWhitelist(true);
    try {
      toast.info('🔄 Syncing Top 100K domains from Cloudflare Radar...');
      const { error } = await supabase.functions.invoke('cloudflare-radar-domains-sync');
      
      if (error) throw error;
      
      toast.success('✅ Top 100K domains synced successfully!');
      await loadStats(); // Reload stats
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(`❌ Sync failed: ${error.message}`);
    } finally {
      setSyncingWhitelist(false);
    }
  };

  const validateDomains = async () => {
    setValidatingDomains(true);
    try {
      toast.info('🔍 Running domain validation against whitelist...');
      const { error } = await supabase.functions.invoke('cloudflare-radar-domain-validator');
      
      if (error) throw error;
      
      toast.success('✅ Domain validation completed!');
      await loadStats(); // Reload stats
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(`❌ Validation failed: ${error.message}`);
    } finally {
      setValidatingDomains(false);
    }
  };

  const loadStats = async () => {
    try {
      // Parallel queries for raw and validated indicators
      const [
        { count: rawIpv4Count },
        { count: rawDomainCount },
        { data: enabledSourcesData },
        { count: validatedIpv4Count },
        { count: validatedDomainCount },
        { data: deltaData },
        { count: enrichedCount },
        { data: enrichedData },
        { count: bgpviewCount },
        { data: bgpviewData },
        { count: cfRadarCount },
        { data: cfRadarData },
        { count: whitelistedCount },
        { count: otxValidatedCount },
        { count: safeBrowsingValidatedCount },
        { count: safeBrowsingThreatsCount }
      ] = await Promise.all([
        // Raw indicators from raw_indicators
        supabase.from('raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'ipv4').is('removed_at', null),
        supabase.from('raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'domain').is('removed_at', null),
        supabase.from('ingest_sources').select('*').eq('enabled', true),
        // Validated indicators from dynamic_raw_indicators
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'ipv4'),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'domain'),
        // Daily deltas
        supabase.from('daily_deltas').select('*').order('run_date', { ascending: false }).limit(2),
        // RIPEstat enrichment count
        supabase.from('ripestat_enrichment').select('*', { count: 'exact', head: true }),
        // RIPEstat data for country stats
        supabase.from('ripestat_enrichment').select('country_code').gt('expires_at', new Date().toISOString()),
        // BGPview enrichment count
        supabase.from('bgpview_enrichment').select('*', { count: 'exact', head: true }),
        // BGPview data for PTR and country stats
        supabase.from('bgpview_enrichment').select('ptr_record, country_code').gt('expires_at', new Date().toISOString()),
        // Cloudflare Radar enrichment count
        supabase.from('cloudflare_radar_enrichment').select('*', { count: 'exact', head: true }),
        // Cloudflare Radar data for country stats
        supabase.from('cloudflare_radar_enrichment').select('country_code').gt('expires_at', new Date().toISOString()),
        // Whitelisted indicators (confidence = 0)
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'domain').eq('confidence', 0),
        // OTX validated indicators
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('otx_checked', true),
        // Google Safe Browsing validated indicators
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('safebrowsing_checked', true),
        // Google Safe Browsing threats detected (score >= 50)
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('safebrowsing_checked', true).gte('safebrowsing_score', 50)
      ]);

      // Count active enabled sources
      const activeSourcesCount = enabledSourcesData?.length || 0;

      // Calculate recent delta
      let recentDelta = null;
      if (deltaData && deltaData.length > 0) {
        const ipv4Delta = deltaData.find(d => d.kind === 'ipv4');
        const domainDelta = deltaData.find(d => d.kind === 'domain');
        recentDelta = {
          added: (ipv4Delta?.added || 0) + (domainDelta?.added || 0),
          removed: (ipv4Delta?.removed || 0) + (domainDelta?.removed || 0),
        };
      }

      // Calculate top countries from RIPEstat data
      const countryCounts: Record<string, number> = {};
      enrichedData?.forEach(item => {
        if (item.country_code) {
          countryCounts[item.country_code] = (countryCounts[item.country_code] || 0) + 1;
        }
      });
      const topCountries = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // BGPview stats
      const bgpviewPtrCount = bgpviewData?.filter(item => item.ptr_record).length || 0;
      const bgpviewCountryCounts: Record<string, number> = {};
      bgpviewData?.forEach(item => {
        if (item.country_code) {
          bgpviewCountryCounts[item.country_code] = (bgpviewCountryCounts[item.country_code] || 0) + 1;
        }
      });
      const bgpviewTopCountries = Object.entries(bgpviewCountryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country]) => country);

      // Cloudflare Radar stats
      const cfRadarCountryCounts: Record<string, number> = {};
      cfRadarData?.forEach(item => {
        if (item.country_code) {
          cfRadarCountryCounts[item.country_code] = (cfRadarCountryCounts[item.country_code] || 0) + 1;
        }
      });
      const cfRadarTopCountries = Object.entries(cfRadarCountryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country]) => country);

      setStats({
        rawTotal: (rawIpv4Count || 0) + (rawDomainCount || 0),
        rawIpv4: rawIpv4Count || 0,
        rawDomains: rawDomainCount || 0,
        rawSources: activeSourcesCount,
        validatedTotal: (validatedIpv4Count || 0) + (validatedDomainCount || 0),
        validatedIpv4: validatedIpv4Count || 0,
        validatedDomains: validatedDomainCount || 0,
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
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const SectionHeader = ({ 
    title, 
    badge, 
    icon: Icon 
  }: { 
    title: string; 
    badge: string; 
    icon: any;
  }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <span className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
        {badge}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">IntelGuard Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Threat Intelligence Management Platform
        </p>
      </div>

      {/* Raw Indicators Pipeline Section */}
      <div className="space-y-4">
        <SectionHeader 
          title="Raw Indicators Pipeline" 
          badge="Unprocessed Data" 
          icon={Database}
        />
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

      {/* Validated Indicators Section */}
      <div className="space-y-4">
        <SectionHeader 
          title="Validated Indicators" 
          badge="Validated & Active" 
          icon={Shield}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Validated</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.validatedTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Validated threats</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Validated IPv4</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.validatedIpv4.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Malicious IPs validated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Validated Domains</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.validatedDomains.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Malicious domains validated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Change</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stats.recentDelta ? (
                <>
                  <div className="text-2xl font-bold">
                    <span className="text-green-600">+{stats.recentDelta.added}</span>
                    {' / '}
                    <span className="text-red-600">-{stats.recentDelta.removed}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Added / Removed today</p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No data yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threat Intelligence Overview</CardTitle>
              <CardDescription>
                Real-time monitoring and validation of malicious indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Validated Coverage</h3>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>IPv4 Addresses</span>
                      <span className="font-mono">{stats.validatedIpv4.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Domains</span>
                      <span className="font-mono">{stats.validatedDomains.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Validation Rate</span>
                      <span className="font-mono">
                        {stats.rawTotal > 0 ? ((stats.validatedTotal / stats.rawTotal) * 100).toFixed(2) : '0.00'}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Enrichment Status</h3>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>RIPEstat Enriched</span>
                      <span className="font-mono">{stats.enrichedCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>BGPview Enriched</span>
                      <span className="font-mono">{stats.bgpviewEnriched.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Cloudflare Radar</span>
                      <span className="font-mono">{stats.cfRadarEnriched.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>PTR Records</span>
                      <span className="font-mono">{stats.bgpviewPtrCount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Cloudflare Radar Whitelist</h3>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={syncWhitelist}
                        disabled={syncingWhitelist}
                      >
                        <RefreshCcw className={`h-3 w-3 mr-1 ${syncingWhitelist ? 'animate-spin' : ''}`} />
                        Sync
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={validateDomains}
                        disabled={validatingDomains || stats.whitelistDomains === 0}
                      >
                        <PlayCircle className={`h-3 w-3 mr-1 ${validatingDomains ? 'animate-pulse' : ''}`} />
                        Validate
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Top 100K Cached</span>
                      <span className="font-mono">{stats.whitelistDomains.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Whitelisted Domains</span>
                      <span className="font-mono">{stats.whitelistedIndicators.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Last Sync</span>
                      <span className="font-mono text-xs">
                        {stats.lastWhitelistSync 
                          ? new Date(stats.lastWhitelistSync).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">OTX Validator</h3>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={async () => {
                        try {
                          toast.info('🔍 Running OTX validation...');
                          const { error } = await supabase.functions.invoke('otx-validator');
                          if (error) throw error;
                          toast.success('✅ OTX validation completed!');
                          await loadStats();
                        } catch (error: any) {
                          console.error('OTX validation error:', error);
                          toast.error(`❌ OTX validation failed: ${error.message}`);
                        }
                      }}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Run OTX
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>OTX Validated</span>
                      <span className="font-mono">{stats.otxValidated || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="text-xs">Scoring 0-100 | Cache 24h TTL</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Google Safe Browsing</h3>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={async () => {
                        try {
                          toast.info('🔍 Running Google Safe Browsing validation...');
                          const { error } = await supabase.functions.invoke('google-safebrowsing-validator');
                          if (error) throw error;
                          toast.success('✅ Safe Browsing validation completed!');
                          await loadStats();
                        } catch (error: any) {
                          console.error('Safe Browsing validation error:', error);
                          toast.error(`❌ Safe Browsing validation failed: ${error.message}`);
                        }
                      }}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Run Check
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Validated</span>
                      <span className="font-mono">{stats.safeBrowsingValidated || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Threats Detected</span>
                      <span className="font-mono text-destructive">{stats.safeBrowsingThreats || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="text-xs">Batch: 200 URLs | Cache 24h TTL</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
                {stats.topCountries.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Top Countries (RIPEstat)</h3>
                    <div className="space-y-1">
                      {stats.topCountries.map(({ country, count }) => (
                        <div key={country} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{country}</span>
                          </span>
                          <span className="font-mono">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {stats.bgpviewTopCountries.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Top Countries (BGPview)</h3>
                    <div className="space-y-1">
                      {stats.bgpviewTopCountries.map((country) => (
                        <div key={country} className="flex items-center text-sm">
                          <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{country}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {stats.cfRadarTopCountries.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Top Countries (Cloudflare)</h3>
                    <div className="space-y-1">
                      {stats.cfRadarTopCountries.map((country) => (
                        <div key={country} className="flex items-center text-sm">
                          <span className="font-mono text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">{country}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest threat intelligence updates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activity tracking will be displayed here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
