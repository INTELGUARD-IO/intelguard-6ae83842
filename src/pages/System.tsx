import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, RefreshCw, Database, Activity, Clock, TrendingUp, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function System() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      navigate('/dashboard');
      toast.error('Access denied: Super admin only');
    }
  }, [isSuperAdmin, roleLoading, navigate]);

  if (roleLoading || !isSuperAdmin) {
    return null;
  }

  const testEdgeFunction = async (functionName: string) => {
    setLoading({ ...loading, [functionName]: true });
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {},
      });

      if (error) throw error;

      toast.success(`${functionName} executed successfully`);
      console.log(`${functionName} result:`, data);
    } catch (error: any) {
      console.error(`Error executing ${functionName}:`, error);
      toast.error(error.message || `Failed to execute ${functionName}`);
    } finally {
      setLoading({ ...loading, [functionName]: false });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Testing</h1>
        <p className="text-muted-foreground mt-1">
          Test edge functions and monitor cron jobs
        </p>
      </div>

      <Tabs defaultValue="functions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="functions">Edge Functions</TabsTrigger>
          <TabsTrigger value="validation">Validation Pipeline</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          <TabsTrigger value="logs">Access Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="functions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Ingest Function
                </CardTitle>
                <CardDescription>
                  Ingest raw indicators from external sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  This function processes raw threat indicators and stores them in the database.
                </div>
                <Button
                  onClick={() => testEdgeFunction('ingest')}
                  disabled={loading['ingest']}
                  className="w-full"
                >
                  {loading['ingest'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Ingest
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Schedule Validations
                </CardTitle>
                <CardDescription>
                  Schedule validation jobs for indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Creates validation jobs for recently updated indicators.
                </div>
                <Button
                  onClick={() => testEdgeFunction('schedule-validations')}
                  disabled={loading['schedule-validations']}
                  className="w-full"
                >
                  {loading['schedule-validations'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Schedule
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Run Validations
                </CardTitle>
                <CardDescription>
                  Process pending validation jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Executes queued validation tasks against vendor APIs.
                </div>
                <Button
                  onClick={() => testEdgeFunction('run-validations')}
                  disabled={loading['run-validations']}
                  className="w-full"
                >
                  {loading['run-validations'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Validations
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Abuse.ch Validator
                </CardTitle>
                <CardDescription>
                  Validate against Abuse.ch False Positive list
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Checks indicators against Abuse.ch FP list and populates dynamic_raw_indicators.
                </div>
                <Button
                  onClick={() => testEdgeFunction('abuse-ch-validator')}
                  disabled={loading['abuse-ch-validator']}
                  className="w-full"
                >
                  {loading['abuse-ch-validator'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Abuse.ch
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  AbuseIPDB Validator
                </CardTitle>
                <CardDescription>
                  Validate IPv4 against AbuseIPDB blacklist
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Checks IPs against AbuseIPDB blacklist and validates indicators.
                </div>
                <Button
                  onClick={() => testEdgeFunction('abuseipdb-validator')}
                  disabled={loading['abuseipdb-validator']}
                  className="w-full"
                >
                  {loading['abuseipdb-validator'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run AbuseIPDB
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  URLScan Validator
                </CardTitle>
                <CardDescription>
                  Validate domains against URLScan.io
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Checks domains for malicious activity via URLScan.io API.
                </div>
                <Button
                  onClick={() => testEdgeFunction('urlscan-validator')}
                  disabled={loading['urlscan-validator']}
                  className="w-full"
                >
                  {loading['urlscan-validator'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run URLScan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
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
      </Tabs>
    </div>
  );
}
