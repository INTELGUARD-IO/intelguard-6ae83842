import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertCircle, CheckCircle, Clock, Database, PlayCircle, RefreshCw, XCircle, Download, Gauge, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface MetricData {
  label: string;
  value: number;
  color?: string;
}

interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  jobid: number;
}

interface IngestSource {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  last_run: string | null;
  last_success: string | null;
  indicators_count: number;
  last_error: string | null;
}

interface ValidationJob {
  id: number;
  indicator: string;
  kind: string;
  status: string;
  scheduled_at: string;
  updated_at: string;
  attempts: number;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  metrics: {
    pendingJobs: number;
    failedJobs: number;
    successRate: number;
    lastValidation: string | null;
  };
}

const Monitoring = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // Metrics state
  const [rawIndicators, setRawIndicators] = useState(0);
  const [dynamicIndicators, setDynamicIndicators] = useState(0);
  const [validatedIndicators, setValidatedIndicators] = useState(0);
  const [vendorChecks, setVendorChecks] = useState(0);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [ingestSources, setIngestSources] = useState<IngestSource[]>([]);
  const [validatorStats, setValidatorStats] = useState<any[]>([]);
  const [indicatorsByType, setIndicatorsByType] = useState<MetricData[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [validationJobs, setValidationJobs] = useState<ValidationJob[]>([]);
  const [jobsByStatus, setJobsByStatus] = useState<MetricData[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    issues: [],
    metrics: { pendingJobs: 0, failedJobs: 0, successRate: 100, lastValidation: null }
  });

  // Check if user is super admin with proper session handling
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // First, check if there's an existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (!session) {
          navigate("/auth");
          return;
        }

        // Then verify the user is super admin
        const { data: isAdmin, error } = await supabase.rpc('is_super_admin', { 
          _user_id: session.user.id 
        });
        
        if (!isMounted) return;

        if (error) {
          console.error('Error checking super admin status:', error);
          toast({
            title: "Errore",
            description: "Impossibile verificare i permessi.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        if (!isAdmin) {
          toast({
            title: "Accesso negato",
            description: "Solo i super admin possono accedere a questa pagina.",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        setUserRole('super_admin');
        setSessionChecked(true);
        loadAllData();
      } catch (error) {
        console.error('Error in session check:', error);
        if (isMounted) {
          navigate("/auth");
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        if (event === 'SIGNED_OUT' || !session) {
          navigate("/auth");
        }
      }
    );

    checkSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadMetrics(),
      loadCronJobs(),
      loadIngestSources(),
      loadValidatorStats(),
      loadLogs(),
      loadValidationJobs(),
    ]);
    calculateSystemHealth();
    setLoading(false);
  };

  const loadMetrics = async () => {
    try {
      // Raw indicators count
      const { count: rawCount } = await supabase
        .from('raw_indicators')
        .select('*', { count: 'exact', head: true })
        .is('removed_at', null);
      setRawIndicators(rawCount || 0);

      // Dynamic indicators count
      const { count: dynamicCount } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true });
      setDynamicIndicators(dynamicCount || 0);

      // Validated indicators count
      const { count: validatedCount } = await supabase
        .from('validated_indicators')
        .select('*', { count: 'exact', head: true });
      setValidatedIndicators(validatedCount || 0);

      // Vendor checks count
      const { count: vendorCount } = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true });
      setVendorChecks(vendorCount || 0);

      // Indicators by type
      const { data: typeData } = await supabase
        .from('raw_indicators')
        .select('kind')
        .is('removed_at', null);
      
      if (typeData) {
        const typeCounts = typeData.reduce((acc: any, item) => {
          acc[item.kind] = (acc[item.kind] || 0) + 1;
          return acc;
        }, {});

        setIndicatorsByType(
          Object.entries(typeCounts).map(([label, value]) => ({
            label,
            value: value as number,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const loadCronJobs = async () => {
    try {
      // Use the new get_cron_jobs function to retrieve real CRON jobs
      const { data, error } = await supabase.rpc('get_cron_jobs');
      
      if (error) {
        console.error('Error fetching CRON jobs:', error);
        setCronJobs([]);
        return;
      }

      if (data) {
        setCronJobs(data.map((job: any) => ({
          jobname: job.jobname,
          schedule: job.schedule,
          active: job.active,
          jobid: job.jobid,
        })));
      }
    } catch (error) {
      console.error('Error loading cron jobs:', error);
      setCronJobs([]);
    }
  };

  const loadIngestSources = async () => {
    try {
      const { data, error } = await supabase
        .from('ingest_sources')
        .select('*')
        .order('name');

      if (data) {
        setIngestSources(data);
      }
    } catch (error) {
      console.error('Error loading ingest sources:', error);
    }
  };

  const loadValidatorStats = async () => {
    try {
      // Get abuse_ch stats
      const { count: abuseCh } = await supabase
        .from('abuse_ch_fplist')
        .select('*', { count: 'exact', head: true });

      // Get abuseipdb stats
      const { count: abuseIpDb } = await supabase
        .from('abuseipdb_blacklist')
        .select('*', { count: 'exact', head: true });

      // Get urlscan stats from vendor_checks
      const { count: urlscan } = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true })
        .eq('vendor', 'urlscan');

      // Get dynamic indicators checked by each validator
      const { data: dynamicData } = await supabase
        .from('dynamic_raw_indicators')
        .select('abuse_ch_checked, abuseipdb_checked, urlscan_checked');

      let abuseCHChecked = 0;
      let abuseIPDBChecked = 0;
      let urlscanChecked = 0;

      if (dynamicData) {
        abuseCHChecked = dynamicData.filter(d => d.abuse_ch_checked).length;
        abuseIPDBChecked = dynamicData.filter(d => d.abuseipdb_checked).length;
        urlscanChecked = dynamicData.filter(d => d.urlscan_checked).length;
      }

      setValidatorStats([
        { name: 'Abuse.ch', fpList: abuseCh || 0, checked: abuseCHChecked, color: '#8B5CF6' },
        { name: 'AbuseIPDB', blacklist: abuseIpDb || 0, checked: abuseIPDBChecked, color: '#06B6D4' },
        { name: 'URLScan', vendorChecks: urlscan || 0, checked: urlscanChecked, color: '#10B981' },
      ]);
    } catch (error) {
      console.error('Error loading validator stats:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setLogs(data);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const loadValidationJobs = async () => {
    try {
      // Get all validation jobs
      const { data: allJobs, error } = await supabase
        .from('validation_jobs')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (allJobs) {
        setValidationJobs(allJobs);

        // Count by status
        const statusCounts = allJobs.reduce((acc: any, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {});

        const statusData = Object.entries(statusCounts).map(([label, value]) => ({
          label,
          value: value as number,
          color: label === 'PENDING' ? '#F59E0B' : label === 'COMPLETED' ? '#10B981' : '#EF4444'
        }));

        setJobsByStatus(statusData);
      }
    } catch (error) {
      console.error('Error loading validation jobs:', error);
    }
  };

  const calculateSystemHealth = async () => {
    try {
      const { count: pendingCount } = await supabase
        .from('validation_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: failedCount } = await supabase
        .from('validation_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'FAILED');

      const { count: completedCount } = await supabase
        .from('validation_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'COMPLETED');

      const { data: lastValidation } = await supabase
        .from('validation_jobs')
        .select('updated_at')
        .eq('status', 'COMPLETED')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const pending = pendingCount || 0;
      const failed = failedCount || 0;
      const completed = completedCount || 0;
      const total = pending + failed + completed;
      const successRate = total > 0 ? ((completed / total) * 100) : 100;

      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Critical checks
      if (failed > 10) {
        issues.push(`🚨 ${failed} validation jobs falliti`);
        status = 'critical';
      }

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      if (lastValidation && lastValidation.updated_at < twoHoursAgo) {
        issues.push('🚨 Nessuna validazione completata nelle ultime 2 ore');
        status = 'critical';
      }

      // Warning checks
      if (pending > 500) {
        issues.push(`⚠️ Coda validazioni elevata: ${pending} job in attesa`);
        if (status === 'healthy') status = 'warning';
      }

      if (successRate < 90 && total > 10) {
        issues.push(`⚠️ Tasso di successo basso: ${successRate.toFixed(1)}%`);
        if (status === 'healthy') status = 'warning';
      }

      // Show alerts
      if (status === 'critical' && issues.length > 0) {
        toast({
          title: "⚠️ Alert Critico",
          description: issues.join('\n'),
          variant: "destructive",
        });
      }

      setSystemHealth({
        status,
        issues,
        metrics: {
          pendingJobs: pending,
          failedJobs: failed,
          successRate,
          lastValidation: lastValidation?.updated_at || null
        }
      });
    } catch (error) {
      console.error('Error calculating system health:', error);
    }
  };

  const exportMetrics = () => {
    const csvData = [
      ['Metrica', 'Valore'],
      ['Raw Indicators', rawIndicators],
      ['Dynamic Indicators', dynamicIndicators],
      ['Validated Indicators', validatedIndicators],
      ['Vendor Checks', vendorChecks],
      ['Validation Jobs Pending', systemHealth.metrics.pendingJobs],
      ['Validation Jobs Failed', systemHealth.metrics.failedJobs],
      ['Success Rate', `${systemHealth.metrics.successRate.toFixed(2)}%`],
      ['System Status', systemHealth.status],
      ['Export Date', new Date().toISOString()],
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "✅ Export completato",
      description: "Metriche esportate con successo",
    });
  };

  const testEdgeFunction = async (functionName: string) => {
    try {
      toast({
        title: "Test in corso...",
        description: `Esecuzione di ${functionName}`,
      });

      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) throw error;

      toast({
        title: "Test completato",
        description: `${functionName} eseguito con successo`,
      });

      // Reload data after test
      setTimeout(() => loadAllData(), 2000);
    } catch (error: any) {
      toast({
        title: "Errore nel test",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (userRole === 'super_admin') {
      const interval = setInterval(() => {
        loadAllData();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [userRole]);

  if (loading || !userRole) {
    return null;
  }

  const COLORS = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B'];

  const pieChartConfig = {
    value: {
      label: "Indicatori",
    },
  };

  const barChartConfig = {
    count: {
      label: "Conteggio",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Sistema di Monitoring</h1>
          <p className="text-muted-foreground">Dashboard di monitoraggio in tempo reale</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportMetrics} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={loadAllData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* System Health Widget */}
      <Card className={
        systemHealth.status === 'critical' ? 'border-destructive' :
        systemHealth.status === 'warning' ? 'border-yellow-500' :
        'border-green-500'
      }>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className={
                systemHealth.status === 'critical' ? 'text-destructive' :
                systemHealth.status === 'warning' ? 'text-yellow-500' :
                'text-green-500'
              } />
              <CardTitle>System Health</CardTitle>
            </div>
            <Badge variant={
              systemHealth.status === 'critical' ? 'destructive' :
              systemHealth.status === 'warning' ? 'secondary' :
              'default'
            } className={
              systemHealth.status === 'warning' ? 'bg-yellow-500' :
              systemHealth.status === 'healthy' ? 'bg-green-500' : ''
            }>
              {systemHealth.status === 'critical' ? '🔴 CRITICO' :
               systemHealth.status === 'warning' ? '🟡 ATTENZIONE' :
               '🟢 OPERATIVO'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Job in Coda</p>
              <p className="text-2xl font-bold">{systemHealth.metrics.pendingJobs}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job Falliti</p>
              <p className="text-2xl font-bold text-destructive">{systemHealth.metrics.failedJobs}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasso Successo</p>
              <p className="text-2xl font-bold text-green-500">{systemHealth.metrics.successRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ultima Validazione</p>
              <p className="text-sm font-medium">
                {systemHealth.metrics.lastValidation 
                  ? new Date(systemHealth.metrics.lastValidation).toLocaleTimeString('it-IT')
                  : 'N/A'}
              </p>
            </div>
          </div>
          {systemHealth.issues.length > 0 && (
            <div className="space-y-1">
              {systemHealth.issues.map((issue, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Raw Indicators</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{rawIndicators.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Indicatori grezzi totali</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dynamic Indicators</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{dynamicIndicators.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {rawIndicators > 0 ? `${((dynamicIndicators / rawIndicators) * 100).toFixed(2)}%` : '0%'} dei raw
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validated</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{validatedIndicators.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Indicatori validati finali</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendor Checks</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{vendorChecks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Controlli vendor effettuati</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Status</TabsTrigger>
          <TabsTrigger value="queue">Validation Queue</TabsTrigger>
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="sources">Ingest Sources</TabsTrigger>
          <TabsTrigger value="cron">CRON Jobs</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Indicatori per Tipo</CardTitle>
                <CardDescription>Distribuzione degli indicatori raw per categoria</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={pieChartConfig} className="h-[300px]">
                  <PieChart>
                    <Pie
                      data={indicatorsByType}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ label, value }) => `${label}: ${value.toLocaleString()}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {indicatorsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Funnel di Validazione</CardTitle>
                <CardDescription>Flusso di elaborazione indicatori</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={barChartConfig} className="h-[300px]">
                  <BarChart
                    data={[
                      { stage: 'Raw', count: rawIndicators },
                      { stage: 'Dynamic', count: dynamicIndicators },
                      { stage: 'Validated', count: validatedIndicators },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#06B6D4" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Job PENDING</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">
                  {jobsByStatus.find(j => j.label === 'PENDING')?.value || 0}
                </div>
                <p className="text-xs text-muted-foreground">In attesa di validazione</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Job COMPLETED</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {jobsByStatus.find(j => j.label === 'COMPLETED')?.value || 0}
                </div>
                <p className="text-xs text-muted-foreground">Validazioni completate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Job FAILED</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {jobsByStatus.find(j => j.label === 'FAILED')?.value || 0}
                </div>
                <p className="text-xs text-muted-foreground">Da investigare</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuzione Job per Status</CardTitle>
                <CardDescription>Stato attuale della coda di validazione</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={pieChartConfig} className="h-[300px]">
                  <PieChart>
                    <Pie
                      data={jobsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ label, value }) => `${label}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {jobsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ultimi 20 Validation Jobs</CardTitle>
                <CardDescription>Job recenti nella coda</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tentativi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationJobs.slice(0, 20).map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="text-xs font-mono max-w-[150px] truncate">
                            {job.indicator}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.kind}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              job.status === 'PENDING' ? 'secondary' :
                              job.status === 'COMPLETED' ? 'default' :
                              'destructive'
                            } className={
                              job.status === 'PENDING' ? 'bg-yellow-500' :
                              job.status === 'COMPLETED' ? 'bg-green-500' : ''
                            }>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{job.attempts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tabella Completa Validation Jobs (Ultimi 100)</CardTitle>
              <CardDescription>Cronologia completa dei job di validazione</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Indicator</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled At</TableHead>
                      <TableHead>Updated At</TableHead>
                      <TableHead>Tentativi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.id}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">
                          {job.indicator}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.kind}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            job.status === 'PENDING' ? 'secondary' :
                            job.status === 'COMPLETED' ? 'default' :
                            'destructive'
                          } className={
                            job.status === 'PENDING' ? 'bg-yellow-500' :
                            job.status === 'COMPLETED' ? 'bg-green-500' : ''
                          }>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(job.scheduled_at).toLocaleString('it-IT')}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(job.updated_at).toLocaleString('it-IT')}
                        </TableCell>
                        <TableCell>{job.attempts}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validators" className="space-y-4">
          <div className="grid gap-4">
            {validatorStats.map((validator) => (
              <Card key={validator.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{validator.name}</CardTitle>
                      <CardDescription>
                        {validator.checked.toLocaleString()} indicatori processati
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testEdgeFunction(
                        validator.name === 'Abuse.ch' ? 'abuse-ch-validator' :
                        validator.name === 'AbuseIPDB' ? 'abuseipdb-validator' :
                        'urlscan-validator'
                      )}
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Test
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {validator.fpList !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">False Positive List</p>
                        <p className="text-2xl font-bold">{validator.fpList.toLocaleString()}</p>
                      </div>
                    )}
                    {validator.blacklist !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Blacklist Entries</p>
                        <p className="text-2xl font-bold">{validator.blacklist.toLocaleString()}</p>
                      </div>
                    )}
                    {validator.vendorChecks !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Vendor Checks</p>
                        <p className="text-2xl font-bold">{validator.vendorChecks.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Indicatori Controllati</p>
                      <p className="text-2xl font-bold">{validator.checked.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fonti di Ingestion</CardTitle>
              <CardDescription>Stato delle sorgenti di dati configurate</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Indicatori</TableHead>
                    <TableHead>Ultima Esecuzione</TableHead>
                    <TableHead>Ultimo Successo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingestSources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="font-medium">{source.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{source.kind}</Badge>
                      </TableCell>
                      <TableCell>
                        {source.enabled ? (
                          <Badge className="bg-accent">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Disabilitato
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{source.indicators_count?.toLocaleString() || 0}</TableCell>
                      <TableCell>
                        {source.last_run ? new Date(source.last_run).toLocaleString('it-IT') : 'Mai'}
                      </TableCell>
                      <TableCell>
                        {source.last_success ? new Date(source.last_success).toLocaleString('it-IT') : 'Mai'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">Totale Indicatori:</TableCell>
                    <TableCell>
                      {ingestSources.reduce((sum, source) => sum + (source.indicators_count || 0), 0).toLocaleString()}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CRON Jobs Attivi</CardTitle>
              <CardDescription>Scheduling automatico dei task di sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome Job</TableHead>
                    <TableHead>Schedule (Cron)</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronJobs.map((job) => (
                    <TableRow key={job.jobid}>
                      <TableCell className="font-medium">{job.jobname}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{job.schedule}</code>
                      </TableCell>
                      <TableCell>
                        {job.active ? (
                          <Badge className="bg-accent">
                            <Clock className="h-3 w-3 mr-1" />
                            Attivo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inattivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{job.jobid}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Logs (Ultimi 50)</CardTitle>
              <CardDescription>Registro degli accessi ai feed</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>User Agent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {new Date(log.created_at).toLocaleString('it-IT')}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.token.substring(0, 12)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.kind}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{log.ip || 'N/A'}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">{log.ua || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Monitoring;
