'use client';

/**
 * API Management Page
 * Manage API keys, view usage, configure webhooks
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Webhook,
  BarChart3,
  AlertCircle,
  Check,
  Clock,
  Shield,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { Badge } from '@skillancer/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { Checkbox } from '@skillancer/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@skillancer/ui/alert';
import { useToast } from '@skillancer/ui/use-toast';

// =============================================================================
// TYPES
// =============================================================================

type ApiKeyScope = 'read' | 'write' | 'admin';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  rateLimit: number;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  createdAt: string;
}

interface ApiUsageStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  avgResponseTimeMs: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
  }>;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await fetch('/api/admin/tenant/api/keys');
  if (!response.ok) throw new Error('Failed to fetch API keys');
  return response.json();
}

async function fetchWebhooks(): Promise<Webhook[]> {
  const response = await fetch('/api/admin/tenant/api/webhooks');
  if (!response.ok) throw new Error('Failed to fetch webhooks');
  return response.json();
}

async function fetchUsageStats(): Promise<ApiUsageStats> {
  const response = await fetch('/api/admin/tenant/api/usage');
  if (!response.ok) throw new Error('Failed to fetch usage stats');
  return response.json();
}

async function createApiKey(params: {
  name: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
  rateLimit?: number;
}): Promise<{ id: string; fullKey: string }> {
  const response = await fetch('/api/admin/tenant/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create API key');
  }
  return response.json();
}

async function revokeApiKey(keyId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/api/keys/${keyId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to revoke API key');
}

async function rotateApiKey(keyId: string): Promise<{ fullKey: string }> {
  const response = await fetch(`/api/admin/tenant/api/keys/${keyId}/rotate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to rotate API key');
  return response.json();
}

async function createWebhook(params: {
  url: string;
  events: string[];
}): Promise<{ id: string; secret: string }> {
  const response = await fetch('/api/admin/tenant/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create webhook');
  }
  return response.json();
}

async function deleteWebhook(webhookId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/api/webhooks/${webhookId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete webhook');
}

// =============================================================================
// COMPONENTS
// =============================================================================

const scopeDescriptions: Record<ApiKeyScope, string> = {
  read: 'Read users, sessions, and reports',
  write: 'Create and update users, policies',
  admin: 'Full access including API key management',
};

const webhookEvents = [
  { value: 'session.started', label: 'Session Started' },
  { value: 'session.ended', label: 'Session Ended' },
  { value: 'user.created', label: 'User Created' },
  { value: 'user.suspended', label: 'User Suspended' },
  { value: 'security.alert', label: 'Security Alert' },
  { value: 'policy.violated', label: 'Policy Violated' },
];

function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (key: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read']);
  const [expiresInDays, setExpiresInDays] = useState<string>('90');
  const [rateLimit, setRateLimit] = useState('1000');

  const mutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (result) => {
      onSuccess(result.fullKey);
      setName('');
      setScopes(['read']);
      setExpiresInDays('90');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      scopes,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
      rateLimit: parseInt(rateLimit),
    });
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              API keys are used to authenticate API requests from your applications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production API Key"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Scopes *</Label>
              <div className="space-y-2">
                {(['read', 'write', 'admin'] as ApiKeyScope[]).map((scope) => (
                  <label key={scope} className="flex items-center gap-3">
                    <Checkbox
                      checked={scopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    <div>
                      <p className="font-medium capitalize">{scope}</p>
                      <p className="text-muted-foreground text-sm">{scopeDescriptions[scope]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expires In</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate Limit (req/min)</Label>
                <Input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  min="100"
                  max="10000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || scopes.length === 0}>
              {mutation.isPending ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewKeyDialog({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast({ title: 'Copied', description: 'API key copied to clipboard' });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            Copy your API key now. You won't be able to see it again!
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            This is the only time your full API key will be shown. Store it securely.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Your API Key</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              readOnly
              className="font-mono"
            />
            <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={copyKey}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyRow({ apiKey, onRefresh }: { apiKey: ApiKey; onRefresh: () => void }) {
  const { toast } = useToast();
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);

  const revokeMutation = useMutation({
    mutationFn: () => revokeApiKey(apiKey.id),
    onSuccess: () => {
      toast({ title: 'API key revoked' });
      onRefresh();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to revoke key', variant: 'destructive' });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateApiKey(apiKey.id),
    onSuccess: (result) => {
      setRotatedKey(result.fullKey);
      onRefresh();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to rotate key', variant: 'destructive' });
    },
  });

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    REVOKED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <>
      <tr className="border-b">
        <td className="px-4 py-4">
          <div>
            <p className="font-medium">{apiKey.name}</p>
            <code className="text-muted-foreground text-sm">{apiKey.keyPrefix}...</code>
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex gap-1">
            {apiKey.scopes.map((scope) => (
              <Badge key={scope} variant="outline" className="capitalize">
                {scope}
              </Badge>
            ))}
          </div>
        </td>
        <td className="px-4 py-4">
          <Badge className={statusColors[apiKey.status]}>{apiKey.status}</Badge>
        </td>
        <td className="text-muted-foreground px-4 py-4 text-sm">{formatDate(apiKey.lastUsedAt)}</td>
        <td className="text-muted-foreground px-4 py-4 text-sm">
          {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : 'Never'}
        </td>
        <td className="px-4 py-4">
          {apiKey.status === 'ACTIVE' && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => rotateMutation.mutate()}
                disabled={rotateMutation.isPending}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => {
                  if (confirm('Are you sure you want to revoke this API key?')) {
                    revokeMutation.mutate();
                  }
                }}
                disabled={revokeMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </td>
      </tr>

      {rotatedKey && <NewKeyDialog apiKey={rotatedKey} onClose={() => setRotatedKey(null)} />}
    </>
  );
}

function WebhooksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: fetchWebhooks,
  });

  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setNewSecret(result.secret);
      setCreateOpen(false);
      setUrl('');
      setEvents([]);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: 'Webhook deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete webhook', variant: 'destructive' });
    },
  });

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Webhooks</h3>
          <p className="text-muted-foreground text-sm">
            Receive real-time notifications for events
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="text-muted-foreground mb-4 h-12 w-12" />
            <p className="text-lg font-medium">No webhooks configured</p>
            <p className="text-muted-foreground mb-4">
              Add a webhook to receive event notifications
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium">{webhook.url}</p>
                    <div className="mt-2 flex gap-2">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline">
                          {event}
                        </Badge>
                      ))}
                    </div>
                    {webhook.lastDeliveryAt && (
                      <p className="text-muted-foreground mt-2 text-sm">
                        Last delivery: {new Date(webhook.lastDeliveryAt).toLocaleString()}
                        {webhook.lastDeliveryStatus && ` (${webhook.lastDeliveryStatus})`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        webhook.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {webhook.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                      onClick={() => {
                        if (confirm('Delete this webhook?')) {
                          deleteMutation.mutate(webhook.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Webhook Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>Configure a URL to receive event notifications</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Endpoint URL *</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks/skillpod"
              />
            </div>

            <div className="space-y-2">
              <Label>Events *</Label>
              <div className="grid grid-cols-2 gap-2">
                {webhookEvents.map((event) => (
                  <label
                    key={event.value}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded border p-2"
                  >
                    <Checkbox
                      checked={events.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                    />
                    <span className="text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({ url, events })}
              disabled={createMutation.isPending || !url || events.length === 0}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Webhook Secret Dialog */}
      {newSecret && (
        <Dialog open={true} onOpenChange={() => setNewSecret(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Webhook Created</DialogTitle>
              <DialogDescription>
                Save this signing secret to verify webhook signatures
              </DialogDescription>
            </DialogHeader>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>This secret will only be shown once!</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Signing Secret</Label>
              <div className="flex gap-2">
                <Input value={newSecret} readOnly className="font-mono text-sm" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(newSecret);
                    toast({ title: 'Copied' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setNewSecret(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function UsageTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['api-usage'],
    queryFn: fetchUsageStats,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Requests Today</p>
            <p className="text-3xl font-bold">{stats.requestsToday.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Requests This Month</p>
            <p className="text-3xl font-bold">{stats.requestsThisMonth.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Avg Response Time</p>
            <p className="text-3xl font-bold">{stats.avgResponseTimeMs.toFixed(0)}ms</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Endpoints (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topEndpoints.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No API activity yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Endpoint</th>
                  <th className="py-2 text-left">Method</th>
                  <th className="py-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {stats.topEndpoints.map((endpoint, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 font-mono text-sm">{endpoint.endpoint}</td>
                    <td className="py-2">
                      <Badge variant="outline">{endpoint.method}</Badge>
                    </td>
                    <td className="py-2 text-right">{endpoint.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ApiManagementPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: fetchApiKeys,
  });

  const handleKeyCreated = (key: string) => {
    setNewApiKey(key);
    setCreateDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">API Access</h1>
        <p className="text-muted-foreground">
          Manage API keys, webhooks, and view usage statistics
        </p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList className="mb-6">
          <TabsTrigger value="keys">
            <Key className="mr-2 h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="mr-2 h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="usage">
            <BarChart3 className="mr-2 h-4 w-4" />
            Usage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">API Keys</h3>
                <p className="text-muted-foreground text-sm">
                  Create and manage API keys for programmatic access
                </p>
              </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Key className="text-muted-foreground mb-4 h-12 w-12" />
                    <p className="text-lg font-medium">No API keys</p>
                    <p className="text-muted-foreground mb-4">Create an API key to get started</p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create API Key
                    </Button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-left">Scopes</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Last Used</th>
                        <th className="px-4 py-3 text-left">Expires</th>
                        <th className="w-24 px-4 py-3 text-left"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((key) => (
                        <ApiKeyRow
                          key={key.id}
                          apiKey={key}
                          onRefresh={() =>
                            queryClient.invalidateQueries({ queryKey: ['api-keys'] })
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* API Documentation Link */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium">API Documentation</p>
                      <p className="text-muted-foreground text-sm">
                        Learn how to integrate with our API
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <a href="/docs/api" target="_blank">
                      View Docs
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        <TabsContent value="usage">
          <UsageTab />
        </TabsContent>
      </Tabs>

      <CreateApiKeyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleKeyCreated}
      />

      {newApiKey && <NewKeyDialog apiKey={newApiKey} onClose={() => setNewApiKey(null)} />}
    </div>
  );
}
