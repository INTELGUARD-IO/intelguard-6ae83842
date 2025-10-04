import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, XCircle } from "lucide-react";

export const ValidatorStatsCard = () => {
  const { data: stats } = useQuery({
    queryKey: ['validator-stats-detailed'],
    queryFn: async () => {
      const { data: dynamic } = await supabase
        .from('dynamic_raw_indicators')
        .select('*')
        .gte('confidence', 50)
        .eq('whitelisted', false);

      if (!dynamic) return null;

      const validators = {
        otx: { checked: 0, malicious: 0 },
        safebrowsing: { checked: 0, malicious: 0 },
        abuseipdb: { checked: 0, malicious: 0 },
        neutrinoapi: { checked: 0, malicious: 0 },
        urlscan: { checked: 0, malicious: 0 },
        honeydb: { checked: 0, malicious: 0 },
        abusech: { checked: 0, malicious: 0 },
        virustotal: { checked: 0, malicious: 0 },
        censys: { checked: 0, malicious: 0 },
      };

      dynamic.forEach(ind => {
        // OTX
        if (ind.otx_checked) {
          validators.otx.checked++;
          if ((ind.otx_score !== null && ind.otx_score >= 3) || ind.otx_verdict === 'malicious') {
            validators.otx.malicious++;
          }
        }

        // SafeBrowsing
        if (ind.safebrowsing_checked) {
          validators.safebrowsing.checked++;
          if (ind.safebrowsing_verdict && ind.safebrowsing_verdict !== 'clean') {
            validators.safebrowsing.malicious++;
          }
        }

        // AbuseIPDB
        if (ind.abuseipdb_checked) {
          validators.abuseipdb.checked++;
          if (ind.abuseipdb_in_blacklist || (ind.abuseipdb_score !== null && ind.abuseipdb_score >= 70)) {
            validators.abuseipdb.malicious++;
          }
        }

        // NeutrinoAPI
        if (ind.neutrinoapi_checked) {
          validators.neutrinoapi.checked++;
          if (ind.neutrinoapi_in_blocklist || (ind.neutrinoapi_host_reputation_score !== null && ind.neutrinoapi_host_reputation_score <= 30)) {
            validators.neutrinoapi.malicious++;
          }
        }

        // URLScan
        if (ind.urlscan_checked) {
          validators.urlscan.checked++;
          if (ind.urlscan_malicious || (ind.urlscan_score !== null && ind.urlscan_score >= 70)) {
            validators.urlscan.malicious++;
          }
        }

        // HoneyDB
        if (ind.honeydb_checked) {
          validators.honeydb.checked++;
          if (ind.honeydb_in_blacklist) {
            validators.honeydb.malicious++;
          }
        }

        // Abuse.ch
        if (ind.abuse_ch_checked) {
          validators.abusech.checked++;
          if (ind.abuse_ch_is_fp === false) {
            validators.abusech.malicious++;
          }
        }

        // VirusTotal
        if (ind.virustotal_checked) {
          validators.virustotal.checked++;
          if (ind.virustotal_malicious || (ind.virustotal_score !== null && ind.virustotal_score >= 5)) {
            validators.virustotal.malicious++;
          }
        }

        // Censys
        if (ind.censys_checked) {
          validators.censys.checked++;
          if (ind.censys_malicious || (ind.censys_score !== null && ind.censys_score >= 70)) {
            validators.censys.malicious++;
          }
        }
      });

      return validators;
    },
    refetchInterval: 60000 // Refresh every 60s
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
        <div className="grid gap-3 md:grid-cols-3">
          {validatorList.map(validator => {
            const data = stats[validator.key as keyof typeof stats];
            const detectionRate = data.checked > 0 ? ((data.malicious / data.checked) * 100) : 0;
            
            return (
              <div key={validator.key} className="space-y-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{validator.name}</span>
                  <Badge variant={detectionRate > 10 ? 'destructive' : detectionRate > 5 ? 'secondary' : 'outline'}>
                    {detectionRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{data.checked.toLocaleString()} checked</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-destructive" />
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
