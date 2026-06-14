import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Copy, Plus, Trash2, Key, Clock } from 'lucide-react';
import type { ApiToken } from '@shared/schema';

export default function TokenManager() {
  const [tokenName, setTokenName] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch API tokens
  const { data: tokens = [], isLoading, refetch } = useQuery<ApiToken[]>({
    queryKey: ['/api/tokens'],
  });

  // Create token mutation
  const createToken = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest('POST', '/api/tokens', data);
      return response.json();
    },
    onSuccess: (newToken) => {
      toast({
        title: 'Token Created',
        description: `New permanent token "${newToken.name}" created successfully. Copy it now - you won't see it again!`
      });
      setTokenName('');
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create token',
        variant: 'destructive'
      });
    }
  });

  // Delete token mutation
  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/tokens/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Token Deleted',
        description: 'Permanent token deleted successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete token',
        variant: 'destructive'
      });
    }
  });

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a token name',
        variant: 'destructive'
      });
      return;
    }
    createToken.mutate({ name: tokenName.trim() });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Token copied to clipboard'
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Tokens
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Generate permanent tokens for n8n, automation tools, and API integrations
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-token">
                <Plus className="h-4 w-4 mr-2" />
                Create Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Token</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateToken} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenName">Token Name</Label>
                  <Input
                    id="tokenName"
                    placeholder="e.g., n8n Integration, Zapier Webhook"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    data-testid="input-token-name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a descriptive name to identify this token later
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createToken.isPending}
                    data-testid="button-confirm-create-token"
                  >
                    {createToken.isPending ? 'Creating...' : 'Create Token'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading tokens...</div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No API Tokens</h3>
            <p className="text-muted-foreground mb-4">
              Create your first permanent token for API integrations
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <div 
                key={token.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`token-${token.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium">{token.name}</h4>
                    <Badge variant="secondary">Permanent</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Created: {formatDate(token.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last used: {formatDate(token.lastUsedAt)}
                      </span>
                    </div>
                    <div className="font-mono text-xs bg-muted p-2 rounded border break-all">
                      {token.token}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(token.token)}
                    data-testid={`button-copy-token-${token.id}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-token-${token.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Token</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the token "{token.name}"? 
                          This action cannot be undone and will immediately revoke access for any integrations using this token.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteToken.mutate(token.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Token
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}