import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 100;

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadIndicators();
  }, [page, debouncedSearch]);

  const loadIndicators = async () => {
    setLoading(true);
    try {
      // Use server-side pagination RPC
      const { data, error } = await supabase
        .rpc('get_paginated_indicators', {
          p_kind: null,
          p_page: page,
          p_limit: pageSize
        });

      if (error) throw error;
      
      const mappedData = (data || []).map((ind: any) => ({
        ...ind,
        first_seen: ind.last_validated,
        last_seen: ind.last_validated,
        sources_count: 1
      }));
      
      setIndicators(mappedData);
      setTotalCount(data?.length || 0);
    } catch (error) {
      console.error('Error loading indicators:', error);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering (for current page only)
  const filteredIndicators = useMemo(() => {
    if (!debouncedSearch) return indicators;
    return indicators.filter(ind =>
      ind.indicator.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [indicators, debouncedSearch]);

  const totalPages = Math.ceil(totalCount / pageSize);

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
                  Page {page} of {totalPages} | Total: {totalCount.toLocaleString()} indicators | 
                  Showing: {filteredIndicators.length}
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
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                                     style={{ width: `${ind.confidence || 0}%` }}
                                   />
                                 </div>
                                 <span className="text-sm text-muted-foreground">
                                   {(ind.confidence || 0).toFixed(0)}%
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
        </CardContent>
      </Card>
    </div>
  );
}
