import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle, Upload, ArrowRight, Database, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useUserRole } from '@/hooks/useUserRole';

interface IngestSource {
  id: string;
  url: string;
  kind: 'ipv4' | 'domain';
  name: string;
  description: string | null;
  enabled: boolean;
  last_success: string | null;
  last_error: string | null;
  last_run: string | null;
  indicators_count: number;
  created_at: string;
  updated_at: string;
}

export default function IngestSources() {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawIndicatorStats, setRawIndicatorStats] = useState<{
    total: number;
    ipv4: number;
    domain: number;
    sources: number;
    uniqueIpv4: number;
    uniqueDomains: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadConfig, setUploadConfig] = useState({
    kind: 'ipv4' as 'ipv4' | 'domain',
    sourceName: '',
    file: null as File | null,
  });
  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    kind: 'ipv4' as 'ipv4' | 'domain',
    description: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshDebounce, setRefreshDebounce] = useState(false);
  const itemsPerPage = 20;

  async function loadSources() {
    try {
      const { data, error } = await supabase
        .from('ingest_sources')
        .select('*')
        .order('kind', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setSources((data || []) as IngestSource[]);
    } catch (error) {
      console.error('Error loading sources:', error);
      toast.error('Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  async function loadRawIndicatorStats(forceRefresh = false) {
    // Debounce refresh calls
    if (forceRefresh && refreshDebounce) {
      toast.info('Please wait before refreshing again');
      return;
    }

    if (forceRefresh) {
      setRefreshDebounce(true);
      setTimeout(() => setRefreshDebounce(false), 1000);
    }

    try {
      const cacheKey = 'raw_indicator_stats';
      const cacheTTL = 5 * 60 * 1000; // 5 minutes
      const cached = localStorage.getItem(cacheKey);
      
      // Always show cached data immediately if available
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        setRawIndicatorStats(cachedData);
        
        const age = Date.now() - timestamp;
        
        // If cache is fresh and not forcing refresh, skip fetch
        if (!forceRefresh && age < cacheTTL) {
          return;
        }
      }

      // Fetch fresh data in background if cache is stale or forced
      const { data, error } = await supabase
        .rpc('get_raw_indicator_stats' as any);

      if (error) throw error;

      const stats = data?.[0];
      const statsData = {
        total: Number(stats?.total_count) || 0,
        ipv4: Number(stats?.ipv4_count) || 0,
        domain: Number(stats?.domain_count) || 0,
        sources: Number(stats?.unique_sources_count) || 0,
        uniqueIpv4: Number(stats?.unique_ipv4_count) || 0,
        uniqueDomains: Number(stats?.unique_domain_count) || 0
      };
      
      setRawIndicatorStats(statsData);
      
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({
        data: statsData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error loading raw indicator stats:', error);
      toast.error('Failed to load database statistics. Please try again.');
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (!roleLoading && isSuperAdmin) {
      loadRawIndicatorStats();
    }
    if (!roleLoading && !isSuperAdmin) {
      navigate('/dashboard');
      toast.error('Access denied: Super admin only');
    }
  }, [isSuperAdmin, roleLoading, navigate]);

  if (roleLoading) {
    return null;
  }

  async function toggleSource(id: string, enabled: boolean) {
    try {
      const { error } = await supabase
        .from('ingest_sources')
        .update({ enabled })
        .eq('id', id);

      if (error) throw error;
      toast.success(enabled ? 'Source enabled' : 'Source disabled');
      loadSources();
    } catch (error) {
      console.error('Error toggling source:', error);
      toast.error('Failed to update source');
    }
  };

  async function deleteSource(id: string) {
    if (!confirm('Are you sure you want to delete this source?')) return;

    try {
      const { error } = await supabase
        .from('ingest_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Source deleted');
      loadSources();
    } catch (error) {
      console.error('Error deleting source:', error);
      toast.error('Failed to delete source');
    }
  };

  async function addSource() {
    if (!newSource.name || !newSource.url) {
      toast.error('Name and URL are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('ingest_sources')
        .insert({
          name: newSource.name,
          url: newSource.url,
          kind: newSource.kind,
          description: newSource.description || null,
        });

      if (error) throw error;
      toast.success('Source added');
      setDialogOpen(false);
      setNewSource({ name: '', url: '', kind: 'ipv4', description: '' });
      loadSources();
    } catch (error) {
      console.error('Error adding source:', error);
      toast.error('Failed to add source');
    }
  };

  const getStatusIcon = (source: IngestSource) => {
    if (!source.last_run) return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    if (source.last_error) return <XCircle className="h-4 w-4 text-destructive" />;
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  const getStatusBadge = (source: IngestSource) => {
    if (!source.last_run) return <Badge variant="secondary">Never Run</Badge>;
    if (source.last_error) return <Badge variant="destructive">Error</Badge>;
    return <Badge className="bg-green-600 hover:bg-green-700">Success</Badge>;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      toast.error('Only .txt files are supported');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadConfig({ ...uploadConfig, file });
  };

  async function handleManualUpload() {
    if (!uploadConfig.file || !uploadConfig.sourceName) {
      toast.error('Please select a file and provide a source name');
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const formData = new FormData();
      formData.append('file', uploadConfig.file);
      formData.append('kind', uploadConfig.kind);
      formData.append('sourceName', uploadConfig.sourceName);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-ingest`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(
          `Upload complete: ${result.added} added, ${result.duplicates} duplicates, ${result.errors} errors`
        );
        if (result.errorDetails.length > 0) {
          console.warn('Upload errors:', result.errorDetails);
        }
        setUploadDialogOpen(false);
        setUploadConfig({ kind: 'ipv4', sourceName: '', file: null });
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadSources();
        loadRawIndicatorStats(true); // Force refresh after upload
      } else {
        toast.error('Upload failed: ' + result.errorDetails.join(', '));
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const ipv4Sources = sources.filter(s => s.kind === 'ipv4');
  const domainSources = sources.filter(s => s.kind === 'domain');

  // Pagination logic
  const totalPages = Math.ceil(sources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSources = sources.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Ingest Sources</h1>
          <p className="text-muted-foreground mt-2">
            Manage threat intelligence data sources
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Manual Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manual Import</DialogTitle>
                  <DialogDescription>
                    Upload a .txt file with one indicator per line (Admin only)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upload-source-name">Source Name</Label>
                    <Input
                      id="upload-source-name"
                      value={uploadConfig.sourceName}
                      onChange={(e) => setUploadConfig({ ...uploadConfig, sourceName: e.target.value })}
                      placeholder="My Custom List"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-kind">Type</Label>
                    <Select value={uploadConfig.kind} onValueChange={(v) => setUploadConfig({ ...uploadConfig, kind: v as 'ipv4' | 'domain' })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ipv4">IPv4</SelectItem>
                        <SelectItem value="domain">Domain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-file">File (.txt, max 10MB)</Label>
                    <Input
                      id="upload-file"
                      type="file"
                      accept=".txt"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    {uploadConfig.file && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {uploadConfig.file.name} ({(uploadConfig.file.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
                    Cancel
                  </Button>
                  <Button onClick={handleManualUpload} disabled={uploading || !uploadConfig.file || !uploadConfig.sourceName}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Source
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Source</DialogTitle>
              <DialogDescription>
                Add a new threat intelligence data source
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="EmergingThreats"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">Type</Label>
                <Select value={newSource.kind} onValueChange={(v) => setNewSource({ ...newSource, kind: v as 'ipv4' | 'domain' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ipv4">IPv4</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={newSource.description}
                  onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={addSource}>Add Source</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>IPv4 Sources</CardTitle>
            <CardDescription>{ipv4Sources.filter(s => s.enabled).length} of {ipv4Sources.length} enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ipv4Sources.reduce((sum, s) => sum + s.indicators_count, 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total indicators collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domain Sources</CardTitle>
            <CardDescription>{domainSources.filter(s => s.enabled).length} of {domainSources.length} enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domainSources.reduce((sum, s) => sum + s.indicators_count, 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total indicators collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Raw Indicators</CardTitle>
            <CardDescription>
              <Badge variant="outline" className="mr-2">
                {rawIndicatorStats ? `${rawIndicatorStats.sources} sources` : 'Loading sources...'}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rawIndicatorStats ? (
                rawIndicatorStats.total.toLocaleString()
              ) : (
                '...'
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {rawIndicatorStats ? (
                <>
                  IPv4: {rawIndicatorStats.ipv4.toLocaleString()} / Domains: {rawIndicatorStats.domain.toLocaleString()}
                </>
              ) : (
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Processing Funnel - Always visible */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Data Processing Pipeline
          </CardTitle>
          <CardDescription>
            Visual representation of indicator deduplication and processing flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {/* Stage 1: Raw Indicators */}
            <div className="flex-1 text-center p-6 bg-card rounded-lg border-2 border-primary/30 shadow-sm">
              <Database className="h-8 w-8 mx-auto mb-3 text-primary" />
              <div className="text-3xl font-bold text-primary mb-2">
                {rawIndicatorStats ? rawIndicatorStats.total.toLocaleString() : '...'}
              </div>
              <div className="text-sm font-medium mb-1">Total Raw Indicators</div>
              <div className="text-xs text-muted-foreground">
                From {rawIndicatorStats ? rawIndicatorStats.sources : '...'} sources
              </div>
            </div>

            <ArrowRight className="h-8 w-8 text-muted-foreground flex-shrink-0" />

            {/* Stage 2: Unique IPv4 */}
            <div className="flex-1 text-center p-6 bg-card rounded-lg border-2 border-blue-500/30 shadow-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-3 text-blue-600" />
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {rawIndicatorStats ? rawIndicatorStats.uniqueIpv4.toLocaleString() : '...'}
              </div>
              <div className="text-sm font-medium mb-1">Unique IPv4 Addresses</div>
              <div className="text-xs text-muted-foreground">
                {rawIndicatorStats && rawIndicatorStats.ipv4 > 0 ? (
                  <>
                    {((rawIndicatorStats.uniqueIpv4 / rawIndicatorStats.ipv4) * 100).toFixed(1)}% of {rawIndicatorStats.ipv4.toLocaleString()} raw
                  </>
                ) : '...'}
              </div>
            </div>

            <ArrowRight className="h-8 w-8 text-muted-foreground flex-shrink-0" />

            {/* Stage 3: Unique Domains */}
            <div className="flex-1 text-center p-6 bg-card rounded-lg border-2 border-green-500/30 shadow-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-3 text-green-600" />
              <div className="text-3xl font-bold text-green-600 mb-2">
                {rawIndicatorStats ? rawIndicatorStats.uniqueDomains.toLocaleString() : '...'}
              </div>
              <div className="text-sm font-medium mb-1">Unique Domains</div>
              <div className="text-xs text-muted-foreground">
                {rawIndicatorStats && rawIndicatorStats.domain > 0 ? (
                  <>
                    {((rawIndicatorStats.uniqueDomains / rawIndicatorStats.domain) * 100).toFixed(1)}% of {rawIndicatorStats.domain.toLocaleString()} raw
                  </>
                ) : '...'}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Duplicates Removed</div>
              <div className="text-2xl font-bold text-destructive">
                {rawIndicatorStats 
                  ? (rawIndicatorStats.total - rawIndicatorStats.uniqueIpv4 - rawIndicatorStats.uniqueDomains).toLocaleString()
                  : '...'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Deduplication Rate</div>
              <div className="text-2xl font-bold text-primary">
                {rawIndicatorStats && rawIndicatorStats.total > 0 
                  ? (((rawIndicatorStats.total - rawIndicatorStats.uniqueIpv4 - rawIndicatorStats.uniqueDomains) / rawIndicatorStats.total) * 100).toFixed(1)
                  : '0'}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Sources</CardTitle>
              <CardDescription>
                Configure and monitor your threat intelligence sources ({sources.length} total)
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadRawIndicatorStats(true)}
              disabled={refreshDebounce}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshDebounce ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Indicators</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(source)}
                      {getStatusBadge(source)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{source.name}</div>
                      {source.description && (
                        <div className="text-xs text-muted-foreground">{source.description}</div>
                      )}
                      {source.last_error && (
                        <div className="text-xs text-destructive mt-1">
                          Error: {source.last_error.substring(0, 50)}...
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{source.kind}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{source.indicators_count.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {source.last_run ? formatDistanceToNow(new Date(source.last_run), { addSuffix: true }) : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={(checked) => toggleSource(source.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSource(source.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {sources.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, sources.length)} of {sources.length} sources
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-sm font-medium px-3">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
