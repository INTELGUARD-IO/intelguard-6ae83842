import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, RefreshCw, Database, Activity, Clock, TrendingUp } from 'lucide-react';
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
          </div>
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
