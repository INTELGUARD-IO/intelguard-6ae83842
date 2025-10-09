import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Copy, Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FeedToken {
  id: string;
  token: string;
  type: string;
  enabled: boolean;
  created_at: string;
  tenant_id: string;
  customer_id?: string;
}

export default function FeedTokens() {
  const [tokens, setTokens] = useState<FeedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTokenType, setNewTokenType] = useState('ipv4');

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feed_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error('Error loading tokens:', error);
      toast.error('Failed to load feed tokens');
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    try {
      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: tenantMember } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!tenantMember) throw new Error('No tenant found');

      // Generate random token
      const tokenValue = crypto.randomUUID();

      const { error } = await supabase.from('feed_tokens').insert({
        token: tokenValue,
        type: newTokenType,
        enabled: true,
        tenant_id: tenantMember.tenant_id,
      });

      if (error) throw error;

      toast.success('Feed token created successfully');
      setIsCreateDialogOpen(false);
      loadTokens();
    } catch (error) {
      console.error('Error creating token:', error);
      toast.error('Failed to create feed token');
    }
  };

  const toggleToken = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('feed_tokens')
        .update({ enabled })
        .eq('id', id);

      if (error) throw error;

      setTokens(tokens.map(t => t.id === id ? { ...t, enabled } : t));
      toast.success(`Token ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling token:', error);
      toast.error('Failed to update token');
    }
  };

  const deleteToken = async (id: string) => {
    if (!confirm('Are you sure you want to delete this token?')) return;

    try {
      const { error } = await supabase.from('feed_tokens').delete().eq('id', id);

      if (error) throw error;

      setTokens(tokens.filter(t => t.id !== id));
      toast.success('Token deleted successfully');
    } catch (error) {
      console.error('Error deleting token:', error);
      toast.error('Failed to delete token');
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success('Token copied to clipboard');
  };

  const copyFeedUrl = (token: string, type: string) => {
    const url = `${window.location.origin}/api/feed/${token}?type=${type}&format=txt`;
    navigator.clipboard.writeText(url);
    toast.success('Feed URL copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feed Tokens</h1>
          <p className="text-muted-foreground mt-1">
            Manage API tokens for threat intelligence feeds
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Feed Token</DialogTitle>
              <DialogDescription>
                Generate a new token for accessing threat intelligence feeds
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type">Feed Type</Label>
                <Select value={newTokenType} onValueChange={setNewTokenType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ipv4">IPv4 Addresses</SelectItem>
                    <SelectItem value="domains">Domains</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createToken}>Create Token</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Tokens</CardTitle>
          <CardDescription>
            Tokens provide programmatic access to threat intelligence feeds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tokens created yet. Create one to get started.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{token.token}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToken(token.token)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{token.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={token.enabled}
                            onCheckedChange={(checked) => toggleToken(token.id, checked)}
                          />
                          <span className="text-sm">
                            {token.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(token.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyFeedUrl(token.token, token.type)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteToken(token.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
