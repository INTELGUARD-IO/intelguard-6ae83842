import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, RefreshCw, Database, Activity, Clock, TrendingUp, Shield, Globe, Search, Code, FileText, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AuditLogsTab } from '@/components/AuditLogsTab';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EdgeFunction {
  name: string;
  title: string;
  category: string;
  description: string;
  icon: LucideIcon;
}

const edgeFunctions: EdgeFunction[] = [
  // Data Pipeline
  { name: 'ingest', title: 'Ingest Function', category: 'Data Pipeline', description: 'Ingest raw indicators from external sources and store them in the database', icon: Database },
  { name: 'schedule-validations', title: 'Schedule Validations', category: 'Data Pipeline', description: 'Creates validation jobs for recently updated indicators', icon: Clock },
  { name: 'run-validations', title: 'Run Validations', category: 'Data Pipeline', description: 'Executes queued validation tasks against vendor APIs', icon: Activity },
  { name: 'daily-delta', title: 'Daily Delta', category: 'Data Pipeline', description: 'Calculate daily changes in indicator counts and statistics', icon: TrendingUp },
  
  // Validators
  { name: 'abuse-ch-validator', title: 'Abuse.ch Validator', category: 'Validators', description: 'Checks indicators against Abuse.ch False Positive list', icon: Shield },
  { name: 'abuseipdb-validator', title: 'AbuseIPDB Validator', category: 'Validators', description: 'Checks IPs against AbuseIPDB blacklist and validates indicators', icon: Shield },
  { name: 'honeydb-validator', title: 'HoneyDB Validator', category: 'Validators', description: 'Checks IPs against HoneyDB bad hosts database and assigns threat scores', icon: Shield },
  { name: 'neutrinoapi-validator', title: 'NeutrinoAPI Validator', category: 'Validators', description: 'Validates IPs via NeutrinoAPI Blocklist + 150 DNSBLs + IP Probe (VPN/Proxy/Hosting detection)', icon: Shield },
  { name: 'virustotal-validator', title: 'VirusTotal Validator', category: 'Validators', description: 'Queries VirusTotal for IPv4 and domain reputation data (4 req/min, 500/day)', icon: Shield },
  { name: 'urlscan-validator', title: 'URLScan Validator', category: 'Validators', description: 'Checks domains for malicious activity via URLScan.io API', icon: Shield },
  { name: 'censys-validator', title: 'Censys Validator', category: 'Validators', description: 'Validate IPs and domains against Censys threat intelligence database', icon: Shield },
  { name: 'otx-validator', title: 'OTX Validator', category: 'Validators', description: 'Validate indicators against AlienVault OTX (Open Threat Exchange)', icon: Shield },
  { name: 'cloudflare-radar-domain-validator', title: 'Cloudflare Radar Domain Validator', category: 'Validators', description: 'Validates domains against Cloudflare Radar Top 100K whitelist', icon: Shield },
  
  // Enrichment
  { name: 'bgpview-enrich', title: 'BGPview Enrichment', category: 'Enrichment', description: 'Fetches BGPview data (rDNS, ASN info, country) for IPv4 indicators', icon: Globe },
  { name: 'ripestat-enrich', title: 'RIPEstat Enrichment', category: 'Enrichment', description: 'Fetches geolocation, ASN, country, abuse contacts, and network info from RIPEstat', icon: Globe },
  { name: 'cloudflare-radar-enrich', title: 'Cloudflare Radar Enrichment', category: 'Enrichment', description: 'Fetches ASN, country, and prefix data from Cloudflare Radar for IPv4 indicators', icon: Globe },
  { name: 'abuseipdb-enrich', title: 'AbuseIPDB Enrichment', category: 'Enrichment', description: 'Enrich indicators with AbuseIPDB threat intelligence and abuse reports', icon: Globe },
  
  // System
  { name: 'source-health-check', title: 'Source Health Check', category: 'System', description: 'Tests connectivity for all sources and re-enables those that are back online', icon: Activity },
  { name: 'cloudflare-radar-domains-sync', title: 'Cloudflare Radar Top 100K Sync', category: 'System', description: 'Downloads and caches Cloudflare Radar Top 100K domains (7-day TTL)', icon: Database },
];

export default function System() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lastStatus, setLastStatus] = useState<Record<string, 'idle' | 'running' | 'success' | 'error'>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [runningAllValidators, setRunningAllValidators] = useState(false);
  const [validatorProgress, setValidatorProgress] = useState<{
    validator: string;
    processed: number;
    total: number;
  } | null>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      navigate('/dashboard');
      toast.error('Access denied: Super admin only');
    }
  }, [isSuperAdmin, roleLoading, navigate]);

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [progressInterval]);

  if (roleLoading || !isSuperAdmin) {
    return null;
  }

  const logOperation = async (
    operationName: string,
    operationType: 'manual_run' | 'cron_run',
    status: 'started' | 'completed' | 'failed',
    description?: string,
    executionTimeMs?: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (status === 'started') {
        const { data, error } = await supabase
          .from('system_audit_logs')
          .insert({
            user_id: user?.id,
            operation_name: operationName,
            operation_type: operationType,
            description,
            status: 'started',
          })
          .select()
          .single();
        
        if (error) throw error;
        return data?.id;
      } else {
        // Update existing log
        const { data: logs } = await supabase
          .from('system_audit_logs')
          .select('id')
          .eq('operation_name', operationName)
          .eq('user_id', user?.id)
          .eq('status', 'started')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (logs && logs.length > 0) {
          await supabase
            .from('system_audit_logs')
            .update({
              status,
              execution_time_ms: executionTimeMs,
              description,
            })
            .eq('id', logs[0].id);
        }
      }
    } catch (error) {
      console.error('Error logging operation:', error);
    }
  };

  const testEdgeFunction = async (functionName: string) => {
    setLoading({ ...loading, [functionName]: true });
    setLastStatus({ ...lastStatus, [functionName]: 'running' });
    
    const validators = ['abuse-ch-validator', 'honeydb-validator', 'abuseipdb-validator'];
    const isValidator = validators.includes(functionName);
    let interval: NodeJS.Timeout | null = null;
    const startTime = Date.now();
    
    // Log operation start
    await logOperation(functionName, 'manual_run', 'started', `Esecuzione manuale di ${functionName}`);
    
    try {
      // Start progress tracking for validators
      if (isValidator) {
        await trackValidatorProgress(functionName);
        interval = setInterval(() => trackValidatorProgress(functionName), 15000);
        setProgressInterval(interval);
      }
      
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      const executionTime = Date.now() - startTime;
      
      // Log success
      await logOperation(
        functionName, 
        'manual_run', 
        'completed', 
        `Completato con successo in ${(executionTime / 1000).toFixed(1)}s`,
        executionTime
      );

      setLastStatus({ ...lastStatus, [functionName]: 'success' });
      toast.success(`${functionName} executed successfully`);
      console.log(`${functionName} result:`, data);
      
      // Final progress update for validators
      if (isValidator) {
        await trackValidatorProgress(functionName);
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // Log failure
      await logOperation(
        functionName,
        'manual_run',
        'failed',
        `Errore: ${error.message || 'Unknown error'}`,
        executionTime
      );
      
      setLastStatus({ ...lastStatus, [functionName]: 'error' });
      console.error(`Error executing ${functionName}:`, error);
      toast.error(error.message || `Failed to execute ${functionName}`);
    } finally {
      // Cleanup progress tracking
      if (interval) {
        clearInterval(interval);
        setProgressInterval(null);
      }
      if (isValidator) {
        setValidatorProgress(null);
      }
      setLoading({ ...loading, [functionName]: false });
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'running': return 'secondary';
      case 'success': return 'default';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const loadAccessLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load access logs');
    }
  };

  const checkValidationJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('validation_jobs')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      toast.success(`Found ${data?.length || 0} validation jobs`);
      console.log('Validation jobs:', data);
    } catch (error: any) {
      console.error('Error checking jobs:', error);
      toast.error(error.message || 'Failed to check validation jobs');
    }
  };

  const checkDailyDeltas = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_deltas')
        .select('*')
        .order('run_date', { ascending: false })
        .limit(7);

      if (error) throw error;
      
      toast.success(`Found ${data?.length || 0} daily deltas`);
      console.log('Daily deltas:', data);
    } catch (error: any) {
      console.error('Error checking deltas:', error);
      toast.error(error.message || 'Failed to check daily deltas');
    }
  };

  const trackValidatorProgress = async (validatorName: string) => {
    try {
      // Get total indicators
      const { count: totalCount } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true });

      // Get processed count based on validator
      let processedCount = 0;
      if (validatorName === 'abuse-ch-validator') {
        const { count } = await supabase
          .from('dynamic_raw_indicators')
          .select('*', { count: 'exact', head: true })
          .eq('abuse_ch_checked', true);
        processedCount = count || 0;
      } else if (validatorName === 'honeydb-validator') {
        const { count } = await supabase
          .from('dynamic_raw_indicators')
          .select('*', { count: 'exact', head: true })
          .eq('honeydb_checked', true);
        processedCount = count || 0;
      } else if (validatorName === 'abuseipdb-validator') {
        const { count } = await supabase
          .from('dynamic_raw_indicators')
          .select('*', { count: 'exact', head: true })
          .eq('abuseipdb_checked', true);
        processedCount = count || 0;
      }

      setValidatorProgress({
        validator: validatorName,
        processed: processedCount,
        total: totalCount || 0,
      });
    } catch (error) {
      console.error('Error tracking progress:', error);
    }
  };

  const runAllValidators = async () => {
    setRunningAllValidators(true);
    const validators = ['abuse-ch-validator', 'honeydb-validator', 'abuseipdb-validator', 'neutrinoapi-validator', 'virustotal-validator'];

    for (const validator of validators) {
      try {
        setLoading({ ...loading, [validator]: true });
        
        // Start progress tracking
        await trackValidatorProgress(validator);
        const interval = setInterval(() => trackValidatorProgress(validator), 15000);
        setProgressInterval(interval);

        // Run validator
        const { error } = await supabase.functions.invoke(validator, { body: {} });
        
        if (error) throw error;
        
        // Clear interval and update one last time
        clearInterval(interval);
        await trackValidatorProgress(validator);
        
        toast.success(`${validator} completed successfully`);
      } catch (error: any) {
        console.error(`Error running ${validator}:`, error);
        toast.error(error.message || `Failed to run ${validator}`);
      } finally {
        setLoading({ ...loading, [validator]: false });
        if (progressInterval) clearInterval(progressInterval);
      }
    }

    setRunningAllValidators(false);
    setValidatorProgress(null);
    toast.success('All validators completed!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Testing</h1>
        <p className="text-muted-foreground mt-1">
          Test edge functions and monitor cron jobs
        </p>
      </div>

      {/* Run All Validators Button */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Run All Validators</h3>
              <p className="text-sm text-muted-foreground">
                Execute Abuse.ch, HoneyDB, and AbuseIPDB validators sequentially
              </p>
              {validatorProgress && (
                <div className="text-sm font-medium text-primary mt-2">
                  Running {validatorProgress.validator}: {validatorProgress.processed} / {validatorProgress.total}
                </div>
              )}
            </div>
            <Button
              onClick={runAllValidators}
              disabled={runningAllValidators || Object.values(loading).some(v => v)}
              size="lg"
              className="min-w-[200px]"
            >
              {runningAllValidators ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Running All...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Run All Validators
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="functions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="functions">Edge Functions</TabsTrigger>
          <TabsTrigger value="validation">Validation Pipeline</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          <TabsTrigger value="logs">Access Logs</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="functions" className="space-y-4">
          <div className="space-y-2">
            {edgeFunctions.map((func) => (
              <div 
                key={func.name} 
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {/* Icon */}
                <func.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                
                {/* Info principale */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">{func.title}</h3>
                    {lastStatus[func.name] && lastStatus[func.name] !== 'idle' && (
                      <Badge variant={getStatusVariant(lastStatus[func.name])}>
                        {lastStatus[func.name]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-0.5">{func.category}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{func.description}</p>
                  {loading[func.name] && validatorProgress?.validator === func.name && (
                    <p className="text-xs text-primary mt-1">
                      Progress: {validatorProgress.processed} / {validatorProgress.total}
                    </p>
                  )}
                </div>
                
                {/* Bottone */}
                <Button
                  onClick={() => testEdgeFunction(func.name)}
                  disabled={loading[func.name] || runningAllValidators}
                  className="flex-shrink-0"
                  size="default"
                >
                  {loading[func.name] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Dynamic Raw Indicators</CardTitle>
                <CardDescription>
                  High-confidence validated indicators (70%+)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Validated</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        try {
                          const { count } = await supabase
                            .from('dynamic_raw_indicators')
                            .select('*', { count: 'exact', head: true });
                          toast.success(`Total: ${count || 0} validated indicators`);
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                    >
                      Check Count
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4">
                    This table contains indicators that passed Abuse.Ch validation with high confidence scores.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Abuse.Ch FP List</CardTitle>
                <CardDescription>
                  False positive indicators cache (7-day TTL)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cached FP Indicators</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        try {
                          const { count } = await supabase
                            .from('abuse_ch_fplist')
                            .select('*', { count: 'exact', head: true });
                          toast.success(`Total: ${count || 0} FP indicators cached`);
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                    >
                      Check Count
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4">
                    Indicators marked as false positives by Abuse.Ch are cached here to prevent inclusion in validated feeds.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AbuseIPDB Blacklist</CardTitle>
                <CardDescription>
                  High-confidence malicious IPs (6-hour TTL)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Blacklisted IPs</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        try {
                          const { count } = await supabase
                            .from('abuseipdb_blacklist')
                            .select('*', { count: 'exact', head: true });
                          toast.success(`Total: ${count || 0} IPs in blacklist`);
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                    >
                      Check Count
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4">
                    IPs with abuse confidence score ≥70% from AbuseIPDB, cached for 6 hours.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>HoneyDB Blacklist</CardTitle>
                <CardDescription>
                  Bad hosts from HoneyDB (24-hour TTL)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Bad Hosts</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        try {
                          const { count } = await supabase
                            .from('honeydb_blacklist')
                            .select('*', { count: 'exact', head: true });
                          toast.success(`Total: ${count || 0} hosts in blacklist`);
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                    >
                      Check Count
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4">
                    Malicious IPs detected by HoneyDB honeypots with threat scores, cached for 24 hours.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vendor Checks</CardTitle>
                <CardDescription>
                  Enriched IP metadata (ISP, country, ASN)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Enriched IPs</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={async () => {
                        try {
                          const { count } = await supabase
                            .from('vendor_checks')
                            .select('*', { count: 'exact', head: true });
                          toast.success(`Total: ${count || 0} IPs enriched`);
                        } catch (error: any) {
                          toast.error(error.message);
                        }
                      }}
                    >
                      Check Count
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4">
                    Detailed IP information from external vendors for dashboard analytics.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Validation Pipeline Info</CardTitle>
              <CardDescription>
                Multi-stage cross-validation process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="font-medium">Stage 1: Abuse.Ch Validation</div>
                <div className="text-muted-foreground pl-4">
                  • Downloads False Positive list (7-day cache)<br/>
                  • Aggregates raw indicators by source count<br/>
                  • Calculates confidence: 3+ sources = 100%, 2 = 66%<br/>
                  • Filters out FPs, keeps 70%+ confidence
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="font-medium">Stage 2: AbuseIPDB Validation</div>
                <div className="text-muted-foreground pl-4">
                  • Fetches blacklist (confidenceMinimum=70%, 6-hour cache)<br/>
                  • Cross-validates indicators against blacklist<br/>
                  • Boosts confidence if in blacklist with high score<br/>
                  • Updates dynamic_raw_indicators with validation status
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="font-medium">Stage 3: IP Enrichment</div>
                <div className="text-muted-foreground pl-4">
                  • Enriches top indicators with AbuseIPDB Check API<br/>
                  • Fetches ISP, country, usage type, ASN data<br/>
                  • Rate limited to 1000 checks per day<br/>
                  • Stores in vendor_checks for dashboard analytics
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="font-medium">Final Output</div>
                <div className="text-muted-foreground pl-4">
                  Only indicators passing all validations with ≥70% confidence enter dynamic_raw_indicators table for customer feeds.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cron Job Status</CardTitle>
              <CardDescription>
                Monitor scheduled tasks and validation pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Ingest Pipeline</div>
                    <div className="text-sm text-muted-foreground">
                      Runs every 5 minutes
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Schedule Validations</div>
                    <div className="text-sm text-muted-foreground">
                      Runs every 10 minutes
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Run Validations</div>
                    <div className="text-sm text-muted-foreground">
                      Runs every 10 minutes
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Daily Delta</div>
                    <div className="text-sm text-muted-foreground">
                      Runs daily at midnight
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={checkValidationJobs} variant="outline">
                  Check Validation Jobs
                </Button>
                <Button onClick={checkDailyDeltas} variant="outline">
                  Check Daily Deltas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Feed Access Logs</CardTitle>
                  <CardDescription>
                    Recent API access via feed tokens
                  </CardDescription>
                </div>
                <Button onClick={loadAccessLogs} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No access logs yet. Click refresh to load.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>User Agent</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {log.token.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.kind}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ip || '-'}
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">
                            {log.ua || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
