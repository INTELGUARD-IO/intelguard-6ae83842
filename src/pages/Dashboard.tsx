import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Globe, Activity, TrendingUp, Database, Layers, Filter } from 'lucide-react';

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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Parallel queries for raw and validated indicators
      const [
        { count: rawIpv4Count },
        { count: rawDomainCount },
        { data: sourcesData },
        { count: validatedIpv4Count },
        { count: validatedDomainCount },
        { data: deltaData }
      ] = await Promise.all([
        // Raw indicators from raw_indicators
        supabase.from('raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'ipv4').is('removed_at', null),
        supabase.from('raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'domain').is('removed_at', null),
        supabase.from('raw_indicators').select('source').is('removed_at', null),
        // Validated indicators from dynamic_raw_indicators
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'ipv4'),
        supabase.from('dynamic_raw_indicators').select('*', { count: 'exact', head: true }).eq('kind', 'domain'),
        // Daily deltas
        supabase.from('daily_deltas').select('*').order('run_date', { ascending: false }).limit(2)
      ]);

      // Calculate unique sources
      const uniqueSources = new Set(sourcesData?.map(d => d.source) || []).size;

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

      setStats({
        rawTotal: (rawIpv4Count || 0) + (rawDomainCount || 0),
        rawIpv4: rawIpv4Count || 0,
        rawDomains: rawDomainCount || 0,
        rawSources: uniqueSources,
        validatedTotal: (validatedIpv4Count || 0) + (validatedDomainCount || 0),
        validatedIpv4: validatedIpv4Count || 0,
        validatedDomains: validatedDomainCount || 0,
        recentDelta,
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
                  <h3 className="text-sm font-medium">System Status</h3>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Validation System</span>
                      <span className="text-green-600">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Feed Distribution</span>
                      <span className="text-green-600">Operational</span>
                    </div>
                  </div>
                </div>
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
