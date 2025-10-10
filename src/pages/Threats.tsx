import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, AlertTriangle, Shield } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
interface ThreatIndicator {
  indicator: string;
  kind: string;
  confidence: number;
  threat_type: string;
  country: string;
  asn: string;
  asn_name: string;
  last_seen: string;
  first_seen: string;
  sources_count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}
interface ThreatStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  ipv4: number;
  domains: number;
}
export default function Threats() {
  const [threats, setThreats] = useState<ThreatIndicator[]>([]);
  const [stats, setStats] = useState<ThreatStats>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    ipv4: 0,
    domains: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'ipv4' | 'domain'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [threatTypeFilter, setThreatTypeFilter] = useState<string>('all');
  useEffect(() => {
    loadThreats();
  }, [activeTab, severityFilter, threatTypeFilter]);
  const loadThreats = async () => {
    setLoading(true);
    try {
      let query = supabase.from('validated_indicators').select('*').order('last_validated', {
        ascending: false
      }).limit(1000);
      if (activeTab !== 'all') {
        query = query.eq('kind', activeTab);
      }
      if (threatTypeFilter !== 'all') {
        query = query.eq('threat_type', threatTypeFilter);
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;

      // Map and enrich data
      const threatData: ThreatIndicator[] = (data || []).map((item: any) => {
        // Calculate severity based on confidence
        let severity: 'critical' | 'high' | 'medium' | 'low';
        if (item.confidence >= 90) severity = 'critical';else if (item.confidence >= 80) severity = 'high';else if (item.confidence >= 70) severity = 'medium';else severity = 'low';
        return {
          indicator: item.indicator,
          kind: item.kind,
          confidence: item.confidence,
          threat_type: item.threat_type || 'unknown',
          country: item.country || '',
          asn: item.asn || '',
          asn_name: '',
          last_seen: item.last_validated,
          first_seen: item.last_validated,
          sources_count: 1,
          severity
        };
      });

      // Apply severity filter if needed
      const filteredData = severityFilter !== 'all' ? threatData.filter(t => t.severity === severityFilter) : threatData;
      setThreats(filteredData);

      // Calculate stats
      setStats({
        total: filteredData.length,
        critical: filteredData.filter(t => t.severity === 'critical').length,
        high: filteredData.filter(t => t.severity === 'high').length,
        medium: filteredData.filter(t => t.severity === 'medium').length,
        ipv4: filteredData.filter(t => t.kind === 'ipv4').length,
        domains: filteredData.filter(t => t.kind === 'domain').length
      });
    } catch (error) {
      console.error('Error loading threats:', error);
    } finally {
      setLoading(false);
    }
  };
  const filteredThreats = threats.filter(threat => threat.indicator.toLowerCase().includes(searchTerm.toLowerCase()) || threat.country?.toLowerCase().includes(searchTerm.toLowerCase()) || threat.asn?.toLowerCase().includes(searchTerm.toLowerCase()));
  const exportCSV = () => {
    const csv = [['Indicator', 'Type', 'Threat Category', 'Severity', 'Country', 'ASN', 'ASN Name', 'Sources', 'First Seen', 'Last Seen'].join(','), ...filteredThreats.map(t => [t.indicator, t.kind, t.threat_type || 'unknown', t.severity, t.country || '', t.asn || '', t.asn_name || '', t.sources_count, new Date(t.first_seen).toISOString(), new Date(t.last_seen).toISOString()].join(','))].join('\n');
    const blob = new Blob([csv], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-feed-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };
  const getThreatTypeLabel = (type: string) => {
    switch (type) {
      case 'botnet':
        return 'Botnet/C2';
      case 'malware':
        return 'Malware';
      case 'phishing':
        return 'Phishing';
      case 'proxy_abuse':
        return 'Proxy Abuse';
      case 'spam':
        return 'Spam Source';
      case 'suspicious':
        return 'Suspicious';
      default:
        return 'Unknown';
    }
  };
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Top1K Threat Intelligence Feed</h1>
          <p className="text-muted-foreground mt-1">Curated Top1K Threat Indicators</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Feed
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Threats</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.ipv4.toLocaleString()} IPs • {stats.domains.toLocaleString()} Domains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.critical.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Confidence ≥ 90%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.high.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Confidence 70-90%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.medium.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Confidence 60-70%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Threats</CardTitle>
              <CardDescription>
                {filteredThreats.length} indicators matching filters
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>

              <Select value={threatTypeFilter} onValueChange={setThreatTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Threat Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="botnet">Botnet/C2</SelectItem>
                  <SelectItem value="malware">Malware</SelectItem>
                  <SelectItem value="phishing">Phishing</SelectItem>
                  <SelectItem value="proxy_abuse">Proxy Abuse</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="suspicious">Suspicious</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative w-[280px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search indicators, country, ASN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="ipv4">IPv4 Addresses</TabsTrigger>
              <TabsTrigger value="domain">Domains</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {loading ? <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div> : <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Threat Category</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>ASN</TableHead>
                        <TableHead>Sources</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredThreats.length === 0 ? <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No threats found matching your filters
                          </TableCell>
                        </TableRow> : filteredThreats.map(threat => <TableRow key={threat.indicator}>
                            <TableCell className="font-mono text-sm">
                              {threat.indicator}
                            </TableCell>
                            <TableCell>
                              <Badge variant={threat.kind === 'ipv4' ? 'default' : 'secondary'}>
                                {threat.kind}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {getThreatTypeLabel(threat.threat_type)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getSeverityColor(threat.severity)}>
                                {threat.severity}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {threat.country || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {threat.asn || '-'}
                              {threat.asn_name && <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {threat.asn_name}
                                </div>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {threat.sources_count}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(threat.last_seen).toLocaleDateString()}
                            </TableCell>
                          </TableRow>)}
                    </TableBody>
                  </Table>
                </div>}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
}