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
                  Execute pending validation jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Processes validation jobs and updates indicator confidence scores.
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
                  <TrendingUp className="h-5 w-5" />
                  Daily Delta
                </CardTitle>
                <CardDescription>
                  Calculate daily indicator changes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Compares today's indicators vs yesterday to track changes.
                </div>
                <Button
                  onClick={() => testEdgeFunction('daily-delta')}
                  disabled={loading['daily-delta']}
                  className="w-full"
                >
                  {loading['daily-delta'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Delta
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Abuse.Ch Validator
                </CardTitle>
                <CardDescription>
                  Validate indicators against Abuse.Ch FP list
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Downloads Abuse.Ch False Positive list and validates raw indicators with 70%+ confidence.
                </div>
                <Button
                  onClick={() => testEdgeFunction('abuse-ch-validator')}
                  disabled={loading['abuse-ch-validator']}
                  className="w-full"
                  variant="default"
                >
                  {loading['abuse-ch-validator'] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Validation
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Validation Pipeline Info</CardTitle>
              <CardDescription>
                How the Abuse.Ch validation works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="font-medium">Step 1: False Positive List Download</div>
                <div className="text-muted-foreground pl-4">
                  Downloads latest FP list from Abuse.Ch API and caches it for 7 days.
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="font-medium">Step 2: Indicator Aggregation</div>
                <div className="text-muted-foreground pl-4">
                  Groups raw indicators by value, counting unique sources for each.
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="font-medium">Step 3: Confidence Calculation</div>
                <div className="text-muted-foreground pl-4">
                  Calculates confidence: 3+ sources = 100%, 2 sources = 66%. Minimum 70% required.
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="font-medium">Step 4: FP List Check</div>
                <div className="text-muted-foreground pl-4">
                  Indicators in FP list are skipped. Others with 70%+ confidence go to dynamic_raw_indicators.
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
