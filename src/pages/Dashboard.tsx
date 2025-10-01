import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Globe, Activity, TrendingUp } from 'lucide-react';

interface Stats {
  totalIndicators: number;
  ipv4Count: number;
  domainCount: number;
  recentDelta: { added: number; removed: number } | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalIndicators: 0,
    ipv4Count: 0,
    domainCount: 0,
    recentDelta: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get total validated indicators by kind
      const { data: ipv4Data } = await supabase
        .from('validated_indicators')
        .select('indicator', { count: 'exact', head: true })
        .eq('kind', 'ipv4');

      const { data: domainData } = await supabase
        .from('validated_indicators')
        .select('indicator', { count: 'exact', head: true })
        .eq('kind', 'domain');

      // Get most recent daily delta
      const { data: deltaData } = await supabase
        .from('daily_deltas')
        .select('*')
        .order('run_date', { ascending: false })
        .limit(2);

      const ipv4Count = ipv4Data?.length || 0;
      const domainCount = domainData?.length || 0;

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
        totalIndicators: ipv4Count + domainCount,
        ipv4Count,
        domainCount,
        recentDelta,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Indicators</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIndicators.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Validated threats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IPv4 Addresses</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ipv4Count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Malicious IPs tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Domains</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.domainCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Malicious domains tracked</p>
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
                  <h3 className="text-sm font-medium">Coverage</h3>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>IPv4 Addresses</span>
                      <span className="font-mono">{stats.ipv4Count}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Domains</span>
                      <span className="font-mono">{stats.domainCount}</span>
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
