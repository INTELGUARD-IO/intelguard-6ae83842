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
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-react';
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

  const loadSources = async () => {
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

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (!roleLoading && !isSuperAdmin) {
      navigate('/dashboard');
      toast.error('Access denied: Super admin only');
    }
  }, [isSuperAdmin, roleLoading, navigate]);

  if (roleLoading) {
    return null;
  }

  const toggleSource = async (id: string, enabled: boolean) => {
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

  const deleteSource = async (id: string) => {
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

  const addSource = async () => {
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

  const handleManualUpload = async () => {
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

      const response = await supabase.functions.invoke('manual-ingest', {
        body: formData,
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data;
      
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

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sources</CardTitle>
          <CardDescription>Configure and monitor your threat intelligence sources</CardDescription>
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
              {sources.map((source) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
