import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle, XCircle, Clock } from "lucide-react";

export const DomainValidatorStatus = () => {
  const { data: stats } = useQuery({
    queryKey: ['domain-validator-status'],
    queryFn: async () => {
      // Get total domains
      const { count: totalDomains } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'domain')
        .gte('confidence', 50)
        .eq('whitelisted', false);

      // Get domains checked by SafeBrowsing
      const { count: safebrowsingChecked } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'domain')
        .eq('safebrowsing_checked', true);

      const { count: safebrowsingMalicious } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'domain')
        .eq('safebrowsing_checked', true)
        .not('safebrowsing_verdict', 'eq', 'clean');

      // Get domains checked by Cloudflare URLScan
      const { count: cloudflareChecked } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'domain')
        .eq('cloudflare_urlscan_checked', true);

      const { count: cloudflareMalicious } = await supabase
        .from('dynamic_raw_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'domain')
        .eq('cloudflare_urlscan_checked', true)
        .eq('cloudflare_urlscan_malicious', true);

      // Get validated domains
      const { count: validatedDomains } = await supabase
        .from('validated_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'domain');

      return {
        totalDomains: totalDomains || 0,
        safebrowsing: {
          checked: safebrowsingChecked || 0,
          malicious: safebrowsingMalicious || 0,
        },
        cloudflare: {
          checked: cloudflareChecked || 0,
          malicious: cloudflareMalicious || 0,
        },
        validated: validatedDomains || 0,
      };
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  if (!stats) return null;

  const safebrowsingProgress = stats.totalDomains > 0 
    ? (stats.safebrowsing.checked / stats.totalDomains) * 100 
    : 0;

  const cloudflareProgress = stats.totalDomains > 0 
    ? (stats.cloudflare.checked / stats.totalDomains) * 100 
    : 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Domain Validators Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Domains */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-medium">Total Domains to Check</span>
          <Badge variant="outline" className="text-base font-bold">
            {stats.totalDomains}
          </Badge>
        </div>

        {/* Google Safe Browsing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-medium">Google Safe Browsing</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.safebrowsing.checked} / {stats.totalDomains}
              </Badge>
              {stats.safebrowsing.malicious > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  {stats.safebrowsing.malicious} threats
                </Badge>
              )}
            </div>
          </div>
          <Progress value={safebrowsingProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{safebrowsingProgress.toFixed(1)}% scanned</span>
            {stats.safebrowsing.checked === 0 && (
              <span className="flex items-center gap-1 text-yellow-600">
                <Clock className="h-3 w-3" />
                Waiting for scan
              </span>
            )}
          </div>
        </div>

        {/* Cloudflare URL Scanner */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-sm font-medium">Cloudflare URL Scanner</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.cloudflare.checked} / {stats.totalDomains}
              </Badge>
              {stats.cloudflare.malicious > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  {stats.cloudflare.malicious} threats
                </Badge>
              )}
            </div>
          </div>
          <Progress value={cloudflareProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{cloudflareProgress.toFixed(1)}% scanned</span>
            {stats.cloudflare.checked === 0 && (
              <span className="flex items-center gap-1 text-yellow-600">
                <Clock className="h-3 w-3" />
                Waiting for scan
              </span>
            )}
          </div>
        </div>

        {/* Validated Domains */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">Validated Domains</span>
            </div>
            <Badge className="bg-success text-success-foreground font-bold">
              {stats.validated}
            </Badge>
          </div>
          {stats.validated === 0 && stats.totalDomains > 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Run validators from <a href="/validators" className="text-primary underline">Validators page</a> to validate domains
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
