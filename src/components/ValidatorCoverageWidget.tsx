import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, Loader2 } from "lucide-react";

interface CoverageData {
  kind: string;
  total_indicators: number;
  safebrowsing_checked: number;
  safebrowsing_pct: number;
  urlscan_checked: number;
  urlscan_pct: number;
  virustotal_checked: number;
  virustotal_pct: number;
  abuseipdb_checked: number;
  abuseipdb_pct: number;
  otx_checked: number;
  otx_pct: number;
}

export function ValidatorCoverageWidget() {
  const { data: coverage, isLoading } = useQuery({
    queryKey: ['validator-coverage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validator_coverage')
        .select('*');
      
      if (error) throw error;
      return data as CoverageData[];
    },
    refetchInterval: 120000, // 2 min
    staleTime: 90000, // 90s
    gcTime: 300000, // 5 min
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Validator Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const ipv4Data = coverage?.find(c => c.kind === 'ipv4');
  const domainData = coverage?.find(c => c.kind === 'domain');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Validator Coverage
        </CardTitle>
        <CardDescription>
          Percentage of indicators checked by each validator
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* IPv4 Coverage */}
        {ipv4Data && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">IPv4 ({ipv4Data.total_indicators} total)</span>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">SafeBrowsing</span>
                  <span className="font-medium">{ipv4Data.safebrowsing_pct}%</span>
                </div>
                <Progress value={ipv4Data.safebrowsing_pct} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">URLScan</span>
                  <span className="font-medium">{ipv4Data.urlscan_pct}%</span>
                </div>
                <Progress value={ipv4Data.urlscan_pct} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">VirusTotal</span>
                  <span className="font-medium">{ipv4Data.virustotal_pct}%</span>
                </div>
                <Progress value={ipv4Data.virustotal_pct} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">AbuseIPDB</span>
                  <span className="font-medium">{ipv4Data.abuseipdb_pct}%</span>
                </div>
                <Progress value={ipv4Data.abuseipdb_pct} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">OTX</span>
                  <span className="font-medium">{ipv4Data.otx_pct}%</span>
                </div>
                <Progress value={ipv4Data.otx_pct} className="h-1.5" />
              </div>
            </div>
          </div>
        )}

        {/* Domain Coverage */}
        {domainData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Domains ({domainData.total_indicators} total)</span>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">SafeBrowsing</span>
                  <span className="font-medium">{domainData.safebrowsing_pct}%</span>
                </div>
                <Progress value={domainData.safebrowsing_pct} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">URLScan</span>
                  <span className="font-medium">{domainData.urlscan_pct}%</span>
                </div>
                <Progress value={domainData.urlscan_pct} className="h-1.5" />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">VirusTotal</span>
                  <span className="font-medium">{domainData.virustotal_pct}%</span>
                </div>
                <Progress value={domainData.virustotal_pct} className="h-1.5" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
