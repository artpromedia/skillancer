'use client';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@skillancer/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';
import { useToast } from '@skillancer/ui/use-toast';
import {
  RefreshCw,
  Settings,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Plug,
  PlugZap,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface IntegrationType {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  category: string;
  tier: 'BASIC' | 'PRO' | 'ENTERPRISE' | 'ADDON';
  widgets: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

interface WorkspaceIntegration {
  id: string;
  integrationTypeId: string;
  integrationType: IntegrationType;
  status: 'PENDING' | 'CONNECTED' | 'EXPIRED' | 'ERROR' | 'DISCONNECTED';
  connectedAt: string | null;
  lastSyncAt: string | null;
  syncStatus: string;
  syncError: string | null;
  enabledWidgets: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  ACCOUNTING: 'Accounting',
  ANALYTICS: 'Analytics',
  DEVTOOLS: 'Developer Tools',
  SECURITY: 'Security',
  HR: 'Human Resources',
  MARKETING: 'Marketing',
  PRODUCTIVITY: 'Productivity',
  COMMUNICATION: 'Communication',
  CLOUD: 'Cloud Services',
  CRM: 'CRM',
};

const STATUS_CONFIG = {
  CONNECTED: { label: 'Connected', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  EXPIRED: { label: 'Expired', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  PENDING: { label: 'Pending', color: 'bg-blue-100 text-blue-800', icon: Clock },
  DISCONNECTED: { label: 'Disconnected', color: 'bg-gray-100 text-gray-800', icon: Plug },
};

export default function IntegrationsPage({ params }: { params: { engagementId: string } }) {
  const { engagementId } = params;
  const { toast } = useToast();

  const [availableIntegrations, setAvailableIntegrations] = useState<IntegrationType[]>([]);
  const [connectedIntegrations, setConnectedIntegrations] = useState<WorkspaceIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('connected');

  useEffect(() => {
    loadIntegrations();
  }, [engagementId]);

  const loadIntegrations = async () => {
    setIsLoading(true);
    try {
      // Fetch available integrations
      const availableRes = await fetch('/api/v1/integrations');
      const availableData = await availableRes.json();
      setAvailableIntegrations(availableData.integrations || []);

      // Fetch connected integrations for this workspace
      const connectedRes = await fetch(`/api/v1/workspaces/${engagementId}/integrations`);
      const connectedData = await connectedRes.json();
      setConnectedIntegrations(connectedData.integrations || []);
    } catch (error) {
      toast({
        title: 'Error loading integrations',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (integration: IntegrationType) => {
    setIsConnecting(true);
    try {
      const res = await fetch(
        `/api/v1/workspaces/${engagementId}/integrations/${integration.slug}/connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await res.json();

      if (data.authorizationUrl) {
        // Open OAuth in popup or redirect
        window.location.href = data.authorizationUrl;
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Unable to initiate connection. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
      setSelectedIntegration(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      await fetch(`/api/v1/workspaces/${engagementId}/integrations/${integrationId}/disconnect`, {
        method: 'POST',
      });

      toast({
        title: 'Integration disconnected',
        description: 'The integration has been removed.',
      });

      loadIntegrations();
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: 'Unable to disconnect. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (integrationId: string) => {
    try {
      await fetch(`/api/v1/workspaces/${engagementId}/integrations/${integrationId}/sync`, {
        method: 'POST',
      });

      toast({
        title: 'Sync started',
        description: 'Integration data is being refreshed.',
      });

      // Reload after short delay
      setTimeout(loadIntegrations, 2000);
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Unable to sync. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleReconnect = async (integrationId: string) => {
    try {
      const res = await fetch(
        `/api/v1/workspaces/${engagementId}/integrations/${integrationId}/reconnect`,
        {
          method: 'POST',
        }
      );

      const data = await res.json();

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (error) {
      toast({
        title: 'Reconnect failed',
        description: 'Unable to reconnect. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Group available integrations by category
  const groupedIntegrations = availableIntegrations.reduce(
    (acc, integration) => {
      const category = integration.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(integration);
      return acc;
    },
    {} as Record<string, IntegrationType[]>
  );

  // Filter out already connected
  const connectedSlugs = new Set(connectedIntegrations.map((i) => i.integrationType.slug));

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect your tools to enhance your workspace</p>
        </div>
        <Button variant="outline" onClick={loadIntegrations}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connected">Connected ({connectedIntegrations.length})</TabsTrigger>
          <TabsTrigger value="available">
            Available ({availableIntegrations.length - connectedIntegrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="connected">
          {connectedIntegrations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PlugZap className="mb-4 h-12 w-12 text-gray-400" />
                <h3 className="text-lg font-medium">No integrations connected</h3>
                <p className="text-muted-foreground mb-4">
                  Connect your first integration to get started
                </p>
                <Button onClick={() => setActiveTab('available')}>Browse Integrations</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connectedIntegrations.map((integration) => {
                const status = STATUS_CONFIG[integration.status];
                const StatusIcon = status.icon;

                return (
                  <Card key={integration.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {integration.integrationType.logoUrl ? (
                            <img
                              alt={integration.integrationType.name}
                              className="h-10 w-10 rounded"
                              src={integration.integrationType.logoUrl}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                              <Plug className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-base">
                              {integration.integrationType.name}
                            </CardTitle>
                            <Badge className={status.color} variant="secondary">
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {integration.lastSyncAt && (
                        <p className="text-muted-foreground text-xs">
                          Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                        </p>
                      )}
                      {integration.syncError && (
                        <p className="text-xs text-red-600">{integration.syncError}</p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {integration.enabledWidgets.length} widgets enabled
                      </p>
                      <div className="flex gap-2">
                        {integration.status === 'CONNECTED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSync(integration.id)}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Sync
                          </Button>
                        )}
                        {integration.status === 'EXPIRED' && (
                          <Button size="sm" onClick={() => handleReconnect(integration.id)}>
                            Reconnect
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          className="text-red-600 hover:text-red-700"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-6 space-y-8" value="available">
          {Object.entries(groupedIntegrations).map(([category, integrations]) => {
            const availableInCategory = integrations.filter((i) => !connectedSlugs.has(i.slug));

            if (availableInCategory.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="mb-4 text-lg font-semibold">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableInCategory.map((integration) => (
                    <Card
                      key={integration.id}
                      className="hover:border-primary cursor-pointer transition-colors"
                      onClick={() => setSelectedIntegration(integration)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          {integration.logoUrl ? (
                            <img
                              alt={integration.name}
                              className="h-10 w-10 rounded"
                              src={integration.logoUrl}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                              <Plug className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-base">{integration.name}</CardTitle>
                            {integration.tier !== 'BASIC' && (
                              <Badge className="text-xs" variant="secondary">
                                {integration.tier}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="line-clamp-2">
                          {integration.description}
                        </CardDescription>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {integration.widgets.length} widgets available
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Integration Detail Dialog */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg">
          {selectedIntegration && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {selectedIntegration.logoUrl ? (
                    <img
                      alt={selectedIntegration.name}
                      className="h-12 w-12 rounded"
                      src={selectedIntegration.logoUrl}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100">
                      <Plug className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <DialogTitle>{selectedIntegration.name}</DialogTitle>
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[selectedIntegration.category] ||
                        selectedIntegration.category}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-muted-foreground">{selectedIntegration.description}</p>

                <div>
                  <h4 className="mb-2 font-medium">Available Widgets</h4>
                  <ul className="space-y-2">
                    {selectedIntegration.widgets.map((widget) => (
                      <li key={widget.id} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{widget.name}</p>
                          <p className="text-muted-foreground text-xs">{widget.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1"
                    disabled={isConnecting}
                    onClick={() => handleConnect(selectedIntegration)}
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Connect
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedIntegration(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
