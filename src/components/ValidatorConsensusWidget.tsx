import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export const ValidatorConsensusWidget = () => {
  const { data: stats } = useQuery({
    queryKey: ['validator-consensus'],
    queryFn: async () => {
      // Get validated indicators by type
      const { data: validated } = await supabase
        .from('validated_indicators')
        .select('kind');

      // Get dynamic indicators with validator results
      const { data: dynamic } = await supabase
        .from('dynamic_raw_indicators')
        .select('kind, otx_checked, safebrowsing_checked, abuseipdb_checked, neutrinoapi_checked, urlscan_checked, honeydb_checked, abuse_ch_checked, virustotal_checked, censys_checked');

      const ipv4Count = validated?.filter(v => v.kind === 'ipv4').length || 0;
      const domainCount = validated?.filter(v => v.kind === 'domain').length || 0;

      // Calculate average validator coverage
      let totalChecked = 0;
      let totalValidators = 0;
      
      dynamic?.forEach(ind => {
        const validators = [
          ind.otx_checked,
          ind.safebrowsing_checked,
          ind.abuseipdb_checked,
          ind.neutrinoapi_checked,
          ind.urlscan_checked,
          ind.honeydb_checked,
          ind.abuse_ch_checked,
          ind.virustotal_checked,
          ind.censys_checked
        ];
        
        totalChecked += validators.filter(v => v).length;
        totalValidators += validators.length;
      });

      const coverage = totalValidators > 0 ? (totalChecked / totalValidators) * 100 : 0;

      return {
        ipv4: ipv4Count,
        domains: domainCount,
        total: ipv4Count + domainCount,
        coverage: coverage
      };
    },
    refetchInterval: 90000, // 90s
    staleTime: 75000, // 75s
    gcTime: 300000, // 5 min
    refetchOnWindowFocus: false,
  });

  if (!stats) return null;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <h3 className="font-semibold text-sm">Validator Consensus</h3>
          </div>
          <span className="text-sm font-medium text-success">
            {stats.total.toLocaleString()} validated
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">IPv4</span>
              <span className="font-medium">{stats.ipv4.toLocaleString()}</span>
            </div>
            <Progress value={(stats.ipv4 / stats.total) * 100} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Domains</span>
              <span className="font-medium">{stats.domains.toLocaleString()}</span>
            </div>
            <Progress value={(stats.domains / stats.total) * 100} className="h-1.5" />
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Validator Coverage</span>
            <span className="font-medium">{stats.coverage.toFixed(1)}%</span>
          </div>
          <Progress value={stats.coverage} className="h-1.5 mt-1" />
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>Multi-source consensus: 2+ validators required</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
