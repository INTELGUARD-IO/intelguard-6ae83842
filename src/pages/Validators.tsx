import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ValidatorStats {
  name: string;
  totalChecks: number;
  recentChecks: number;
  avgScore: number;
  lastCheck: string | null;
}

interface ValidationJobStats {
  pending: number;
  completed: number;
  failed: number;
  totalProcessed: number;
}

interface RecentJob {
  id: number;
  indicator: string;
  kind: string;
  status: string;
  scheduled_at: string;
  updated_at: string;
  attempts: number;
}

export default function Validators() {
  const [validators, setValidators] = useState<ValidatorStats[]>([]);
  const [jobStats, setJobStats] = useState<ValidationJobStats>({
    pending: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0
  });
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);

  const validatorList = [
    { name: 'AbuseIPDB', column: 'abuseipdb_checked' },
    { name: 'Abuse.ch', column: 'abuse_ch_checked' },
    { name: 'VirusTotal', column: 'virustotal_checked' },
    { name: 'URLScan', column: 'urlscan_checked' },
    { name: 'NeutrinoAPI', column: 'neutrinoapi_checked' },
    { name: 'HoneyDB', column: 'honeydb_checked' },
    { name: 'Censys', column: 'censys_checked' },
    { name: 'OTX', column: 'otx_checked' },
    { name: 'Google Safe Browsing', column: 'safebrowsing_checked' }
  ];

  const loadValidatorStats = async () => {
    try {
      const stats: ValidatorStats[] = [];

      // AbuseIPDB
      const abuseipdbData = await supabase
        .from('dynamic_raw_indicators')
        .select('abuseipdb_score, last_validated')
        .eq('abuseipdb_checked', true);
      
      const abuseipdbRecentCount = await supabase
        .from('abuseipdb_blacklist')
        .select('*', { count: 'exact', head: true })
        .gte('added_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'AbuseIPDB',
        totalChecks: abuseipdbData.data?.length || 0,
        recentChecks: abuseipdbRecentCount.count || 0,
        avgScore: abuseipdbData.data?.length ? 
          abuseipdbData.data.reduce((sum, r) => sum + (r.abuseipdb_score || 0), 0) / abuseipdbData.data.length : 0,
        lastCheck: abuseipdbData.data?.[0]?.last_validated || null
      });

      // Abuse.ch
      const abusechData = await supabase
        .from('dynamic_raw_indicators')
        .select('last_validated')
        .eq('abuse_ch_checked', true);

      const abusechRecentCount = await supabase
        .from('abuse_ch_fplist')
        .select('*', { count: 'exact', head: true })
        .gte('added_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'Abuse.ch',
        totalChecks: abusechData.data?.length || 0,
        recentChecks: abusechRecentCount.count || 0,
        avgScore: 0,
        lastCheck: abusechData.data?.[0]?.last_validated || null
      });

      // VirusTotal
      const vtData = await supabase
        .from('vendor_checks')
        .select('score, checked_at')
        .ilike('vendor', 'virustotal')
        .order('checked_at', { ascending: false });

      const vtRecentCount = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true })
        .ilike('vendor', 'virustotal')
        .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'VirusTotal',
        totalChecks: vtData.data?.length || 0,
        recentChecks: vtRecentCount.count || 0,
        avgScore: vtData.data?.length ?
          vtData.data.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / vtData.data.length : 0,
        lastCheck: vtData.data?.[0]?.checked_at || null
      });

      // URLScan
      const urlscanData = await supabase
        .from('dynamic_raw_indicators')
        .select('urlscan_score, last_validated')
        .eq('urlscan_checked', true);

      const urlscanRecentCount = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('urlscan_checked', true)
        .gte('last_validated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'URLScan',
        totalChecks: urlscanData.data?.length || 0,
        recentChecks: urlscanRecentCount.count || 0,
        avgScore: urlscanData.data?.length ?
          urlscanData.data.reduce((sum, r) => sum + (r.urlscan_score || 0), 0) / urlscanData.data.length : 0,
        lastCheck: urlscanData.data?.[0]?.last_validated || null
      });

      // NeutrinoAPI
      const neutrinoData = await supabase
        .from('dynamic_raw_indicators')
        .select('neutrinoapi_host_reputation_score, last_validated')
        .eq('neutrinoapi_checked', true);

      const neutrinoRecentCount = await supabase
        .from('neutrinoapi_blocklist')
        .select('*', { count: 'exact', head: true })
        .gte('added_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'NeutrinoAPI',
        totalChecks: neutrinoData.data?.length || 0,
        recentChecks: neutrinoRecentCount.count || 0,
        avgScore: neutrinoData.data?.length ?
          neutrinoData.data.reduce((sum, r) => sum + (r.neutrinoapi_host_reputation_score || 0), 0) / neutrinoData.data.length : 0,
        lastCheck: neutrinoData.data?.[0]?.last_validated || null
      });

      // HoneyDB
      const honeydbData = await supabase
        .from('dynamic_raw_indicators')
        .select('honeydb_threat_score, last_validated')
        .eq('honeydb_checked', true);

      const honeydbRecentCount = await supabase
        .from('honeydb_blacklist')
        .select('*', { count: 'exact', head: true })
        .gte('added_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'HoneyDB',
        totalChecks: honeydbData.data?.length || 0,
        recentChecks: honeydbRecentCount.count || 0,
        avgScore: honeydbData.data?.length ?
          honeydbData.data.reduce((sum, r) => sum + (r.honeydb_threat_score || 0), 0) / honeydbData.data.length : 0,
        lastCheck: honeydbData.data?.[0]?.last_validated || null
      });

      // Censys
      const censysData = await supabase
        .from('dynamic_raw_indicators')
        .select('censys_score, last_validated')
        .eq('censys_checked', true);

      const censysRecentCount = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('censys_checked', true)
        .gte('last_validated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'Censys',
        totalChecks: censysData.data?.length || 0,
        recentChecks: censysRecentCount.count || 0,
        avgScore: censysData.data?.length ?
          censysData.data.reduce((sum, r) => sum + (r.censys_score || 0), 0) / censysData.data.length : 0,
        lastCheck: censysData.data?.[0]?.last_validated || null
      });

      // OTX
      const otxData = await supabase
        .from('otx_enrichment')
        .select('score, refreshed_at')
        .order('refreshed_at', { ascending: false });

      const otxRecentCount = await supabase
        .from('otx_enrichment')
        .select('*', { count: 'exact', head: true })
        .gte('refreshed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'OTX',
        totalChecks: otxData.data?.length || 0,
        recentChecks: otxRecentCount.count || 0,
        avgScore: otxData.data?.length ?
          otxData.data.reduce((sum, r) => sum + (r.score || 0), 0) / otxData.data.length : 0,
        lastCheck: otxData.data?.[0]?.refreshed_at || null
      });

      // Google Safe Browsing
      const safebrowsingData = await supabase
        .from('google_safebrowsing_cache')
        .select('score, checked_at')
        .order('checked_at', { ascending: false });

      const safebrowsingRecentCount = await supabase
        .from('google_safebrowsing_cache')
        .select('*', { count: 'exact', head: true })
        .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stats.push({
        name: 'Google Safe Browsing',
        totalChecks: safebrowsingData.data?.length || 0,
        recentChecks: safebrowsingRecentCount.count || 0,
        avgScore: safebrowsingData.data?.length ?
          safebrowsingData.data.reduce((sum, r) => sum + (r.score || 0), 0) / safebrowsingData.data.length : 0,
        lastCheck: safebrowsingData.data?.[0]?.checked_at || null
      });

      setValidators(stats);
    } catch (error) {
      console.error('Error loading validator stats:', error);
      toast.error('Failed to load validator statistics');
    }
  };

  const loadJobStats = async () => {
    try {
      const [
        { count: pendingCount },
        { count: completedCount },
        { count: failedCount }
      ] = await Promise.all([
        supabase.from('validation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('validation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
        supabase.from('validation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'FAILED')
      ]);

      setJobStats({
        pending: pendingCount || 0,
        completed: completedCount || 0,
        failed: failedCount || 0,
        totalProcessed: (completedCount || 0) + (failedCount || 0)
      });
    } catch (error) {
      console.error('Error loading job stats:', error);
    }
  };

  const loadRecentJobs = async () => {
    try {
      const { data } = await supabase
        .from('validation_jobs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      setRecentJobs(data || []);
    } catch (error) {
      console.error('Error loading recent jobs:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        loadValidatorStats(),
        loadJobStats(),
        loadRecentJobs()
      ]);
      setLoading(false);
    };

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'FAILED':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Activity className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Validation System Status</h1>
        <p className="text-muted-foreground">Real-time monitoring of all validators and validation jobs</p>
      </div>

      {/* Job Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Jobs</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.pending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Waiting for processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.completed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Jobs</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.failed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.totalProcessed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time total</p>
          </CardContent>
        </Card>
      </div>

      {/* Validator Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Validator Status
          </CardTitle>
          <CardDescription>Performance and activity metrics for each validation service</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Validator</TableHead>
                <TableHead className="text-right">Total Checks</TableHead>
                <TableHead className="text-right">Last 24h</TableHead>
                <TableHead className="text-right">Avg Score</TableHead>
                <TableHead>Last Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validators.map((validator) => (
                <TableRow key={validator.name}>
                  <TableCell className="font-medium">{validator.name}</TableCell>
                  <TableCell className="text-right">{validator.totalChecks.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-primary/10">
                      {validator.recentChecks.toLocaleString()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant="outline" 
                      className={validator.avgScore > 50 ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}
                    >
                      {validator.avgScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(validator.lastCheck)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Validation Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recent Validation Jobs
          </CardTitle>
          <CardDescription>Latest 10 validation jobs from the queue</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicator</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No validation jobs found
                  </TableCell>
                </TableRow>
              ) : (
                recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.indicator}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.kind}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      <Badge variant={job.attempts > 1 ? "destructive" : "outline"}>
                        {job.attempts}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(job.scheduled_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(job.updated_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
