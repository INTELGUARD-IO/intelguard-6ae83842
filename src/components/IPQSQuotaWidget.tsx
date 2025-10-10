import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export const IPQSQuotaWidget = () => {
  const { data: quotaData, isLoading } = useQuery({
    queryKey: ['ipqs-quota'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_current_month_ipqs_quota');
      
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const quota = data[0];
      const percentUsed = (quota.api_calls_count / quota.monthly_limit) * 100;

      return {
        used: quota.api_calls_count,
        remaining: quota.remaining_calls,
        limit: quota.monthly_limit,
        percentUsed
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !quotaData) return null;

  const getStatusColor = () => {
    if (quotaData.percentUsed >= 90) return "text-destructive";
    if (quotaData.percentUsed >= 70) return "text-warning";
    return "text-success";
  };

  const getStatusIcon = () => {
    if (quotaData.percentUsed >= 90) return <AlertCircle className="h-4 w-4" />;
    if (quotaData.percentUsed >= 70) return <Clock className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getProgressColor = () => {
    if (quotaData.percentUsed >= 90) return "bg-destructive";
    if (quotaData.percentUsed >= 70) return "bg-warning";
    return "bg-success";
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={getStatusColor()}>
              {getStatusIcon()}
            </div>
            <h3 className="font-semibold text-sm">IPQualityScore Quota</h3>
          </div>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {quotaData.remaining}/{quotaData.limit}
          </span>
        </div>

        <Progress 
          value={quotaData.percentUsed} 
          className="h-2"
        />

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Used:</span> {quotaData.used}
          </div>
          <div>
            <span className="font-medium">Remaining:</span> {quotaData.remaining}
          </div>
        </div>

        {quotaData.percentUsed >= 90 && (
          <div className="text-xs text-destructive pt-2 border-t">
            ⚠️ Low quota! Premium enrichment will pause at 1000 calls.
          </div>
        )}
      </div>
    </Card>
  );
};
