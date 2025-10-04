import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp } from "lucide-react";

interface TimelineData {
  hour: string;
  whitelisted: number;
  deepValidated: number;
  quotaSaved: number;
}

export default function WhitelistTimeline() {
  const [data, setData] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTimelineData = async () => {
    try {
      // Get last 24 hours data, grouped by hour
      const hours: TimelineData[] = [];
      const now = new Date();

      for (let i = 23; i >= 0; i--) {
        const hourStart = new Date(now.getTime() - i * 3600000);
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        
        const [whitelistedRes, deepValidatedRes] = await Promise.all([
          supabase
            .from('dynamic_raw_indicators')
            .select('*', { count: 'exact', head: true })
            .eq('whitelisted', true)
            .gte('last_validated', hourStart.toISOString())
            .lt('last_validated', hourEnd.toISOString()),
          supabase
            .from('dynamic_raw_indicators')
            .select('*', { count: 'exact', head: true })
            .eq('whitelisted', false)
            .gte('last_validated', hourStart.toISOString())
            .lt('last_validated', hourEnd.toISOString())
        ]);

        const whitelisted = whitelistedRes.count || 0;
        const deepValidated = deepValidatedRes.count || 0;

        hours.push({
          hour: hourStart.getHours().toString().padStart(2, '0') + ':00',
          whitelisted,
          deepValidated,
          quotaSaved: whitelisted * 10
        });
      }

      setData(hours);
    } catch (error) {
      console.error('Error loading timeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimelineData();
    const interval = setInterval(loadTimelineData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  const totalWhitelisted = data.reduce((sum, d) => sum + d.whitelisted, 0);
  const totalDeepValidated = data.reduce((sum, d) => sum + d.deepValidated, 0);
  const totalQuotaSaved = data.reduce((sum, d) => sum + d.quotaSaved, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Validation Timeline (Last 24h)
        </CardTitle>
        <CardDescription>
          Real-time distribution of whitelisted vs deep validated indicators
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Whitelisted</p>
              <p className="text-2xl font-bold text-green-600">{totalWhitelisted.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Deep Validated</p>
              <p className="text-2xl font-bold text-blue-600">{totalDeepValidated.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">API Calls Saved</p>
              <p className="text-2xl font-bold text-primary">{totalQuotaSaved.toLocaleString()}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorWhitelisted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDeepValidated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="whitelisted"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#colorWhitelisted)"
                name="Whitelisted"
              />
              <Area
                type="monotone"
                dataKey="deepValidated"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#colorDeepValidated)"
                name="Deep Validated"
              />
            </AreaChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="quotaSaved"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                name="API Calls Saved"
                dot={{ fill: 'hsl(var(--chart-3))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
