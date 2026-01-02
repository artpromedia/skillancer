'use client';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent } from '@skillancer/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@skillancer/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@skillancer/ui/tooltip';
import {
  RefreshCw,
  Settings,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Plug,
  Unplug,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface IntegrationStatusCardProps {
  integration: {
    id: string;
    integrationType: {
      slug: string;
      name: string;
      logoUrl?: string;
    };
    status: 'PENDING' | 'CONNECTED' | 'EXPIRED' | 'ERROR' | 'DISCONNECTED';
    connectedAt: string | null;
    lastSyncAt: string | null;
    syncStatus: string;
    syncError: string | null;
    enabledWidgets: string[];
  };
  onSync?: () => void;
  onReconnect?: () => void;
  onSettings?: () => void;
  onDisconnect?: () => void;
  isSyncing?: boolean;
}

const STATUS_CONFIG = {
  CONNECTED: {
    label: 'Connected',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  EXPIRED: {
    label: 'Expired',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertCircle,
    iconColor: 'text-yellow-500',
  },
  ERROR: {
    label: 'Error',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-500',
  },
  PENDING: {
    label: 'Pending',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
    iconColor: 'text-blue-500',
  },
  DISCONNECTED: {
    label: 'Disconnected',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Plug,
    iconColor: 'text-gray-500',
  },
};

export function IntegrationStatusCard({
  integration,
  onSync,
  onReconnect,
  onSettings,
  onDisconnect,
  isSyncing = false,
}: IntegrationStatusCardProps) {
  const status = STATUS_CONFIG[integration.status];
  const StatusIcon = status.icon;
  const isHealthy = integration.status === 'CONNECTED';
  const needsReconnect = integration.status === 'EXPIRED' || integration.status === 'ERROR';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card
      className={`relative overflow-hidden transition-all hover:shadow-md ${
        needsReconnect ? 'border-yellow-300' : ''
      }`}
    >
      {/* Status indicator bar */}
      <div
        className={`absolute left-0 right-0 top-0 h-1 ${
          isHealthy ? 'bg-green-500' : needsReconnect ? 'bg-yellow-500' : 'bg-gray-300'
        }`}
      />

      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          {/* Logo and name */}
          <div className="flex items-center gap-3">
            <div className="relative">
              {integration.integrationType.logoUrl ? (
                <img
                  alt={integration.integrationType.name}
                  className="h-10 w-10 rounded-lg"
                  src={integration.integrationType.logoUrl}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <Plug className="h-5 w-5 text-gray-500" />
                </div>
              )}
              {/* Online indicator */}
              <div
                className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${
                  isHealthy ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                {isHealthy ? (
                  <Wifi className="h-2.5 w-2.5 text-white" />
                ) : (
                  <WifiOff className="h-2.5 w-2.5 text-white" />
                )}
              </div>
            </div>
            <div>
              <h3 className="font-medium">{integration.integrationType.name}</h3>
              <Badge className={`${status.color} text-xs`} variant="outline">
                <StatusIcon className={`mr-1 h-3 w-3 ${status.iconColor}`} />
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isHealthy && onSync && (
                <DropdownMenuItem disabled={isSyncing} onClick={onSync}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </DropdownMenuItem>
              )}
              {needsReconnect && onReconnect && (
                <DropdownMenuItem onClick={onReconnect}>
                  <Plug className="mr-2 h-4 w-4" />
                  Reconnect
                </DropdownMenuItem>
              )}
              {onSettings && (
                <DropdownMenuItem onClick={onSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
              )}
              {onDisconnect && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={onDisconnect}
                  >
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help">
                  <p className="text-muted-foreground text-xs">Last synced</p>
                  <p className="font-medium">{formatDate(integration.lastSyncAt)}</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {integration.lastSyncAt
                  ? new Date(integration.lastSyncAt).toLocaleString()
                  : 'Never synced'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div>
            <p className="text-muted-foreground text-xs">Widgets</p>
            <p className="font-medium">{integration.enabledWidgets.length} enabled</p>
          </div>
        </div>

        {/* Error message */}
        {integration.syncError && (
          <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-600">
            {integration.syncError}
          </div>
        )}

        {/* Quick action for needs reconnect */}
        {needsReconnect && onReconnect && (
          <Button
            className="mt-3 w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            size="sm"
            variant="outline"
            onClick={onReconnect}
          >
            <Plug className="mr-2 h-4 w-4" />
            Reconnect to fix
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default IntegrationStatusCard;
