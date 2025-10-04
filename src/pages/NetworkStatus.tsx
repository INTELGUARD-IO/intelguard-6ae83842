import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NetworkActivity {
  id: string;
  started_at: string;
  completed_at: string | null;
  call_type: 'ingest' | 'validator' | 'api_call';
  target_url: string;
  target_name: string;
  method: string;
  status_code: number | null;
  response_time_ms: number | null;
  items_processed: number;
  items_total: number | null;
  status: 'active' | 'completed' | 'failed' | 'timeout';
  error_message: string | null;
  edge_function_name: string | null;
}

export default function NetworkStatus() {
  const [activeConnections, setActiveConnections] = useState<NetworkActivity[]>([]);
  const [recentCompleted, setRecentCompleted] = useState<NetworkActivity[]>([]);
  const [stats, setStats] = useState({
    activeCount: 0,
    avgResponseTime: 0,
    successRate: 0
  });
  const { toast } = useToast();

  const fetchData = async () => {
    // Fetch active connections
    const { data: active } = await supabase
      .from('network_activity_log')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    // Fetch recent completed (last 20)
    const { data: completed } = await supabase
      .from('network_activity_log')
      .select('*')
      .in('status', ['completed', 'failed', 'timeout'])
      .order('completed_at', { ascending: false })
      .limit(20);

    if (active) setActiveConnections(active as NetworkActivity[]);
    if (completed) {
      setRecentCompleted(completed as NetworkActivity[]);
      
      // Calculate stats
      const successCount = completed.filter(c => c.status === 'completed').length;
      const avgTime = completed
        .filter(c => c.response_time_ms)
        .reduce((acc, c) => acc + (c.response_time_ms || 0), 0) / completed.length;
      
      setStats({
        activeCount: active?.length || 0,
        avgResponseTime: Math.round(avgTime) || 0,
        successRate: completed.length > 0 ? Math.round((successCount / completed.length) * 100) : 0
      });
    }
  };

  useEffect(() => {
    fetchData();

    // Setup realtime subscription
    const channel = supabase
      .channel('network-activity')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'network_activity_log'
        },
        (payload) => {
          console.log('Network activity update:', payload);
          fetchData();
          
          // Show toast for failed calls
          if (payload.eventType === 'UPDATE' && payload.new.status === 'failed') {
            toast({
              title: "Call Failed",
              description: `${payload.new.target_name}: ${payload.new.error_message}`,
              variant: "destructive"
            });
          }
        }
      )
      .subscribe();

    // Refresh every 3 seconds
    const interval = setInterval(fetchData, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500"><Activity className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCallTypeIcon = (type: string) => {
    switch (type) {
      case 'ingest':
        return '📥';
      case 'validator':
        return '🛡️';
      default:
        return '📡';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Network Status Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          <Clock className="h-3 w-3 mr-1" /> Live Updates
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgResponseTime}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Active Connections ({activeConnections.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeConnections.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active connections</p>
          ) : (
            <div className="space-y-4">
              {activeConnections.map((conn) => (
                <div key={conn.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCallTypeIcon(conn.call_type)}</span>
                      <div>
                        <p className="font-semibold">{conn.target_name}</p>
                        <p className="text-sm text-muted-foreground">{conn.edge_function_name}</p>
                      </div>
                    </div>
                    {getStatusBadge(conn.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Started</p>
                      <p className="font-mono">{new Date(conn.started_at).toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-mono">{formatDuration(conn.started_at)}</p>
                    </div>
                    {conn.items_total && (
                      <div>
                        <p className="text-muted-foreground">Progress</p>
                        <p className="font-mono">
                          {conn.items_processed} / {conn.items_total} 
                          ({Math.round((conn.items_processed / conn.items_total) * 100)}%)
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Method</p>
                      <p className="font-mono">{conn.method}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Completed Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Completed Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Target</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Duration</th>
                  <th className="text-right p-2">Items</th>
                  <th className="text-left p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCompleted.map((call) => (
                  <tr key={call.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span>{getCallTypeIcon(call.call_type)}</span>
                        <span className="font-medium">{call.target_name}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{call.call_type}</Badge>
                    </td>
                    <td className="p-2">{getStatusBadge(call.status)}</td>
                    <td className="p-2 text-right font-mono">
                      {call.response_time_ms ? `${call.response_time_ms}ms` : '-'}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {call.items_processed || '-'}
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {call.completed_at ? new Date(call.completed_at).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
