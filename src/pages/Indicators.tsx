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

interface Indicator {
  indicator: string;
  kind: string;
  confidence: number;
  last_validated: string;
  country?: string;
  asn?: string;
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
        .from('validated_indicators')
        .select('*')
        .order('last_validated', { ascending: false })
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

  const exportIndicators = () => {
    const csv = [
      ['Indicator', 'Type', 'Confidence', 'Last Validated', 'Country', 'ASN'].join(','),
      ...filteredIndicators.map(ind =>
        [
          ind.indicator,
          ind.kind,
          ind.confidence,
          new Date(ind.last_validated).toISOString(),
          ind.country || '',
          ind.asn || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indicators-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
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
        <Button onClick={exportIndicators} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <ValidatorStatsCard />

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
                        <TableHead>Confidence</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>ASN</TableHead>
                        <TableHead>Last Validated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndicators.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${ind.confidence * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {(ind.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{ind.country || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {ind.asn || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(ind.last_validated).toLocaleDateString()}
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
