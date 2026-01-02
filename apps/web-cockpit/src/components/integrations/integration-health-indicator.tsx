'use client';

/**
 * Integration Health Indicator
 * Shows overall health of connected integrations
 */

import { Button } from '@skillancer/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@skillancer/ui/components/popover';
import { cn } from '@skillancer/ui/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';

export interface IntegrationStatus {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'disconnected';
  lastSync?: Date;
  error?: string;
}

interface Props {
  integrations: IntegrationStatus[];
  onRefresh?: (integrationId: string) => void;
  onManage?: () => void;
}

export function IntegrationHealthIndicator({ integrations, onRefresh, onManage }: Props) {
  const [open, setOpen] = useState(false);

  const healthyCount = integrations.filter((i) => i.status === 'healthy').length;
  const degradedCount = integrations.filter((i) => i.status === 'degraded').length;
  const errorCount = integrations.filter(
    (i) => i.status === 'error' || i.status === 'disconnected'
  ).length;

  const overallStatus = errorCount > 0 ? 'error' : degradedCount > 0 ? 'degraded' : 'healthy';

  const getStatusIcon = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getOverallIcon = () => {
    switch (overallStatus) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const formatLastSync = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (integrations.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            'gap-2',
            overallStatus === 'error' && 'text-red-600',
            overallStatus === 'degraded' && 'text-yellow-600'
          )}
          size="sm"
          variant="ghost"
        >
          {getOverallIcon()}
          <span className="text-sm">
            {healthyCount}/{integrations.length} Connected
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Integrations</h4>
            {onManage && (
              <Button size="sm" variant="ghost" onClick={onManage}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between rounded-lg border p-2"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(integration.status)}
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {integration.error || `Synced ${formatLastSync(integration.lastSync)}`}
                    </p>
                  </div>
                </div>
                {onRefresh && integration.status !== 'disconnected' && (
                  <Button
                    className="h-7 w-7"
                    size="icon"
                    variant="ghost"
                    onClick={() => onRefresh(integration.id)}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default IntegrationHealthIndicator;
