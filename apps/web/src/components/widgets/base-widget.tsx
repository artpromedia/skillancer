'use client';

import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Skeleton } from '@skillancer/ui/skeleton';
import { RefreshCw, Settings, Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface BaseWidgetProps {
  widgetId: string;
  integrationId: string;
  workspaceId: string;
  title: string;
  refreshInterval?: number; // seconds
  config?: Record<string, unknown>;
  children: (data: unknown, isLoading: boolean) => React.ReactNode;
  onSettings?: () => void;
  className?: string;
}

export function BaseWidget({
  widgetId,
  integrationId,
  workspaceId,
  title,
  refreshInterval = 300,
  config = {},
  children,
  onSettings,
  className = '',
}: BaseWidgetProps) {
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        Object.entries(config).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });

        const url = `/api/v1/workspaces/${workspaceId}/integrations/${integrationId}/widgets/${widgetId}/data?${params}`;
        const res = await fetch(url);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch widget data');
        }

        const responseData = await res.json();
        setData(responseData.data);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [widgetId, integrationId, workspaceId, config]
  );

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return lastUpdated.toLocaleTimeString();
  };

  return (
    <Card
      className={`relative overflow-hidden ${isExpanded ? 'col-span-2 row-span-2' : ''} ${className}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="flex items-center gap-1">
            {lastUpdated && (
              <span className="text-muted-foreground mr-2 text-xs">{formatLastUpdated()}</span>
            )}
            <Button
              className="h-6 w-6 p-0"
              disabled={isRefreshing}
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              className="h-6 w-6 p-0"
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            {onSettings && (
              <Button className="h-6 w-6 p-0" size="sm" variant="ghost" onClick={onSettings}>
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-red-400" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        ) : (
          children(data, isLoading)
        )}
      </CardContent>
    </Card>
  );
}

// Skeleton for loading state
export function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

// Hook for fetching widget data
export function useWidgetData(
  workspaceId: string,
  integrationId: string,
  widgetId: string,
  params?: Record<string, unknown>
) {
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
      }

      const url = `/api/v1/workspaces/${workspaceId}/integrations/${integrationId}/widgets/${widgetId}/data?${searchParams}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }

      const responseData = await res.json();
      setData(responseData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, integrationId, widgetId, params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export default BaseWidget;
