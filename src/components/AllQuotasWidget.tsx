import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuotaInfo {
  name: string;
  used: number;
  limit: number;
  period: string;
  resetTime?: string;
  status: 'ok' | 'warning' | 'critical';
}

export const AllQuotasWidget = () => {
  const { data: quotas } = useQuery({
    queryKey: ['all-validator-quotas'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      
      // AbuseIPDB - 1000/day for /check endpoint
      const { count: abuseipdbUsed } = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true })
        .eq('vendor', 'abuseipdb')
        .gte('checked_at', `${today}T00:00:00Z`);

      // VirusTotal - estimate from cache (free: 4/min, 500/day)
      const { count: vtUsed } = await supabase
        .from('virustotal_cache')
        .select('*', { count: 'exact', head: true })
        .gte('checked_at', `${today}T00:00:00Z`);

      // Censys - 100/month
      const { data: censysUsage } = await supabase
        .rpc('get_current_month_censys_usage');
      
      const censysUsed = censysUsage?.[0]?.api_calls_count || 0;

      // URLScan - estimate from vendor_checks (free: ~1000/month)
      const { count: urlscanUsed } = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true })
        .eq('vendor', 'urlscan')
        .gte('checked_at', `${startOfMonth}T00:00:00Z`);

      // NeutrinoAPI - estimate (we use IP Probe + Host Reputation)
      const { count: neutrinoUsed } = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true })
        .eq('vendor', 'neutrinoapi')
        .gte('checked_at', `${today}T00:00:00Z`);

      // Google SafeBrowsing - batch requests (10k lookups/day free)
      const { count: safebrowsingUsed } = await supabase
        .from('google_safebrowsing_cache')
        .select('*', { count: 'exact', head: true })
        .gte('checked_at', `${today}T00:00:00Z`);

      // OTX - very generous limits (1M/month free)
      const { count: otxUsed } = await supabase
        .from('otx_enrichment')
        .select('*', { count: 'exact', head: true })
        .gte('refreshed_at', `${today}T00:00:00Z`);

      // HoneyDB - check network logs
      const { count: honeydbUsed } = await supabase
        .from('network_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('target_name', 'HoneyDB API')
        .gte('started_at', `${today}T00:00:00Z`);

      const quotasData: QuotaInfo[] = [
        {
          name: 'AbuseIPDB',
          used: abuseipdbUsed || 0,
          limit: 1000,
          period: 'day',
          status: getStatus(abuseipdbUsed || 0, 1000),
        },
        {
          name: 'VirusTotal',
          used: vtUsed || 0,
          limit: 500,
          period: 'day',
          status: getStatus(vtUsed || 0, 500),
        },
        {
          name: 'Censys',
          used: censysUsed,
          limit: 100,
          period: 'month',
          status: getStatus(censysUsed, 100),
        },
        {
          name: 'URLScan',
          used: urlscanUsed || 0,
          limit: 1000,
          period: 'month',
          status: getStatus(urlscanUsed || 0, 1000),
        },
        {
          name: 'NeutrinoAPI',
          used: neutrinoUsed || 0,
          limit: 5000,
          period: 'day',
          status: getStatus(neutrinoUsed || 0, 5000),
        },
        {
          name: 'SafeBrowsing',
          used: safebrowsingUsed || 0,
          limit: 10000,
          period: 'day',
          status: getStatus(safebrowsingUsed || 0, 10000),
        },
        {
          name: 'OTX',
          used: otxUsed || 0,
          limit: 30000,
          period: 'month',
          status: getStatus(otxUsed || 0, 30000),
        },
        {
          name: 'HoneyDB',
          used: honeydbUsed || 0,
          limit: 10000,
          period: 'day',
          status: getStatus(honeydbUsed || 0, 10000),
        },
      ];

      return quotasData;
    },
    refetchInterval: 120000, // 2 min
    staleTime: 90000, // 90s
    gcTime: 300000, // 5 min
    refetchOnWindowFocus: false,
  });

  if (!quotas) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Quotas Monitor</CardTitle>
            <CardDescription>
              Real-time usage tracking for all validators
            </CardDescription>
          </div>
          <Badge variant="outline">
            {quotas.filter(q => q.status === 'ok').length}/{quotas.length} OK
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quotas.map((quota) => {
            const percentUsed = (quota.used / quota.limit) * 100;
            
            return (
              <div key={quota.name} className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{quota.name}</span>
                  {quota.status === 'critical' && <AlertCircle className="h-4 w-4 text-destructive" />}
                  {quota.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {quota.status === 'ok' && <CheckCircle className="h-4 w-4 text-success" />}
                </div>

                <Progress 
                  value={percentUsed} 
                  className={`h-2 ${quota.status === 'critical' ? 'bg-destructive/20' : quota.status === 'warning' ? 'bg-yellow-500/20' : ''}`}
                />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Used: {quota.used.toLocaleString()}</span>
                  <span>Limit: {quota.limit.toLocaleString()}/{quota.period}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${
                    quota.status === 'critical' ? 'text-destructive' :
                    quota.status === 'warning' ? 'text-yellow-500' :
                    'text-success'
                  }`}>
                    {(quota.limit - quota.used).toLocaleString()} remaining
                  </span>
                  <span className="text-muted-foreground">
                    {percentUsed.toFixed(1)}%
                  </span>
                </div>

                {quota.status === 'critical' && (
                  <div className="text-xs text-destructive pt-1 border-t">
                    ⚠️ Quota exhausted or near limit!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

function getStatus(used: number, limit: number): 'ok' | 'warning' | 'critical' {
  const percent = (used / limit) * 100;
  if (percent >= 95) return 'critical';
  if (percent >= 80) return 'warning';
  return 'ok';
}
