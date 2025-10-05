import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Filter } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ValidatorStatsCard } from '@/components/ValidatorStatsCard';
import { DomainValidatorStatus } from '@/components/DomainValidatorStatus';
import { ValidatorCoverageWidget } from '@/components/ValidatorCoverageWidget';

interface Indicator {
  indicator: string;
  kind: string;
  confidence: number;
  last_seen: string;
  first_seen: string;
  country?: string;
  asn?: string;
  asn_name?: string;
  threat_type?: string;
  severity?: string;
  sources_count?: number;
}

export default function Indicators() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'ipv4' | 'domain'>('all');

  useEffect(() => {
    loadIndicators();
  }, [activeTab]);

  const loadIndicators = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('public_threat_indicators')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(1000);

      if (activeTab !== 'all') {
        query = query.eq('kind', activeTab);
      }

      const { data, error } = await query;

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error('Error loading indicators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredIndicators = indicators.filter(ind =>
    ind.indicator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportIPv4 = () => {
    const ipv4Indicators = indicators.filter(ind => ind.kind === 'ipv4');
    
    const csv = [
      ['IPv4 Address', 'Confidence', 'Threat Type', 'Severity', 'Country', 'ASN', 'ASN Name', 'Sources', 'First Seen', 'Last Seen'].join(','),
      ...ipv4Indicators.map(ind =>
        [
          ind.indicator,
          ind.confidence,
          ind.threat_type || '',
          ind.severity || '',
          ind.country || '',
          ind.asn || '',
          ind.asn_name || '',
          ind.sources_count || 0,
          new Date(ind.first_seen).toISOString(),
          new Date(ind.last_seen).toISOString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-ipv4-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportDomains = () => {
    const domainIndicators = indicators.filter(ind => ind.kind === 'domain');
    
    const csv = [
      ['Domain', 'Confidence', 'Threat Type', 'Severity', 'Country', 'ASN', 'ASN Name', 'Sources', 'First Seen', 'Last Seen'].join(','),
      ...domainIndicators.map(ind =>
        [
          ind.indicator,
          ind.confidence,
          ind.threat_type || '',
          ind.severity || '',
          ind.country || '',
          ind.asn || '',
          ind.asn_name || '',
          ind.sources_count || 0,
          new Date(ind.first_seen).toISOString(),
          new Date(ind.last_seen).toISOString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-domains-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Threat Indicators</h1>
          <p className="text-muted-foreground mt-1">
            Validated threats from multi-validator consensus (OTX, SafeBrowsing, AbuseIPDB, NeutrinoAPI, URLScan, HoneyDB, Abuse.ch, VirusTotal, Censys)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportIPv4} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export IPv4
          </Button>
          <Button onClick={exportDomains} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Domains
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ValidatorStatsCard />
        <DomainValidatorStatus />
        <ValidatorCoverageWidget />
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Indicators Database</CardTitle>
                <CardDescription>
                  {filteredIndicators.length} validated threats | 
                  IPv4: {indicators.filter(i => i.kind === 'ipv4').length} | 
                  Domains: {indicators.filter(i => i.kind === 'domain').length}
                </CardDescription>
              </div>
            <div className="flex items-center gap-2">
              <div className="relative w-[300px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search indicators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="ipv4">IPv4</TabsTrigger>
              <TabsTrigger value="domain">Domains</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Threat Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>ASN</TableHead>
                        <TableHead>Sources</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndicators.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No indicators found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredIndicators.map((ind) => (
                          <TableRow key={ind.indicator}>
                            <TableCell className="font-mono text-sm">
                              {ind.indicator}
                            </TableCell>
                            <TableCell>
                              <Badge variant={ind.kind === 'ipv4' ? 'default' : 'secondary'}>
                                {ind.kind}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {ind.threat_type || 'unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  ind.severity === 'critical' ? 'destructive' :
                                  ind.severity === 'high' ? 'default' :
                                  'secondary'
                                }
                              >
                                {ind.severity || 'low'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${(ind.confidence || 0) * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {((ind.confidence || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{ind.country || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {ind.asn || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ind.sources_count || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(ind.last_seen).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
