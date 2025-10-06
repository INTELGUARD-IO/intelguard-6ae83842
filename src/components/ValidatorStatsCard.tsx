import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, XCircle } from "lucide-react";

export const ValidatorStatsCard = () => {
  const { data: stats } = useQuery({
    queryKey: ['validator-stats-mv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validator_stats_mv')
        .select('*')
        .single();

      if (error) throw error;
      if (!data) return null;

      // Map materialized view columns to component format
      return {
        otx: { 
          checked: data.otx_checked_count || 0, 
          malicious: data.otx_malicious_count || 0 
        },
        safebrowsing: { 
          checked: data.safebrowsing_checked_count || 0, 
          malicious: data.safebrowsing_malicious_count || 0 
        },
        abuseipdb: { 
          checked: data.abuseipdb_checked_count || 0, 
          malicious: data.abuseipdb_malicious_count || 0 
        },
        neutrinoapi: { 
          checked: data.neutrinoapi_checked_count || 0, 
          malicious: data.neutrinoapi_malicious_count || 0 
        },
        urlscan: { 
          checked: data.urlscan_checked_count || 0, 
          malicious: data.urlscan_malicious_count || 0 
        },
        honeydb: { 
          checked: data.honeydb_checked_count || 0, 
          malicious: data.honeydb_malicious_count || 0 
        },
        abusech: { 
          checked: data.abuse_ch_checked_count || 0, 
          malicious: data.abuse_ch_malicious_count || 0 
        },
        virustotal: { 
          checked: data.virustotal_checked_count || 0, 
          malicious: data.virustotal_malicious_count || 0 
        },
        censys: { 
          checked: data.censys_checked_count || 0, 
          malicious: data.censys_malicious_count || 0 
        },
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Cache for 30 seconds
  });

  if (!stats) return null;

  const validatorList = [
    { name: 'OTX', key: 'otx' },
    { name: 'SafeBrowsing', key: 'safebrowsing' },
    { name: 'AbuseIPDB', key: 'abuseipdb' },
    { name: 'NeutrinoAPI', key: 'neutrinoapi' },
    { name: 'URLScan', key: 'urlscan' },
    { name: 'HoneyDB', key: 'honeydb' },
    { name: 'Abuse.ch', key: 'abusech' },
    { name: 'VirusTotal', key: 'virustotal' },
    { name: 'Censys', key: 'censys' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Validator Activity</CardTitle>
        </div>
        <CardDescription>
          Real-time detection rates from all validators
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {validatorList.map(validator => {
            const data = stats[validator.key as keyof typeof stats];
            const detectionRate = data.checked > 0 ? ((data.malicious / data.checked) * 100) : 0;
            
            return (
              <div key={validator.key} className="space-y-3 p-4 border rounded-lg">
                <div className="space-y-2">
                  <span className="text-sm font-medium">{validator.name}</span>
                  <Badge 
                    variant={detectionRate > 10 ? 'destructive' : detectionRate > 5 ? 'secondary' : 'outline'}
                    className="w-fit"
                  >
                    {detectionRate >= 10 
                      ? `${Math.round(detectionRate)}%` 
                      : `${detectionRate.toFixed(1)}%`}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{data.checked.toLocaleString()} checked</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span>{data.malicious.toLocaleString()} malicious</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
