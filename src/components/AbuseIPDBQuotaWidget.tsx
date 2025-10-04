import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

export const AbuseIPDBQuotaWidget = () => {
  const { data: quotaData } = useQuery({
    queryKey: ['abuseipdb-quota'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Count today's API calls
      const { count: usedQuota } = await supabase
        .from('vendor_checks')
        .select('*', { count: 'exact', head: true })
        .eq('vendor', 'abuseipdb')
        .gte('checked_at', `${today}T00:00:00Z`);

      // Get last validator run
      const { data: validatorStatus } = await supabase
        .from('validator_status')
        .select('updated_at, status')
        .eq('validator_name', 'abuseipdb-validator')
        .maybeSingle();

      const used = usedQuota || 0;
      const limit = 1000;
      const remaining = limit - used;
      const percentUsed = (used / limit) * 100;

      return {
        used,
        remaining,
        limit,
        percentUsed,
        lastValidatorRun: validatorStatus?.updated_at,
        validatorStatus: validatorStatus?.status
      };
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  if (!quotaData) return null;

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

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h3 className="font-semibold text-sm">AbuseIPDB Quota</h3>
          </div>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {quotaData.remaining}/{quotaData.limit}
          </span>
        </div>

        <Progress value={quotaData.percentUsed} className="h-2" />

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Used:</span> {quotaData.used}
          </div>
          <div>
            <span className="font-medium">Remaining:</span> {quotaData.remaining}
          </div>
        </div>

        {quotaData.lastValidatorRun && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Last validator run: {new Date(quotaData.lastValidatorRun).toLocaleString()}
          </div>
        )}

        {quotaData.percentUsed >= 90 && (
          <div className="text-xs text-destructive pt-2 border-t">
            ⚠️ Low quota! Enrichment paused until tomorrow.
          </div>
        )}
      </div>
    </Card>
  );
};
