'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface DeployHealthWidgetProps {
  engagementId: string;
  integrationId?: string;
}

interface DeploymentData {
  recentDeployments: Array<{
    id: string;
    environment: string;
    status: 'success' | 'failure' | 'pending' | 'running';
    deployedAt: string;
    duration: number;
    commitSha: string;
    author: string;
  }>;
  successRate: number;
  averageDuration: number;
  lastDeployment: string | null;
  environmentStatus: Record<string, 'healthy' | 'degraded' | 'down'>;
}

export function DeployHealthWidget({ engagementId, integrationId }: DeployHealthWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['widget', 'deploy-health', engagementId, integrationId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: DeploymentData }>(
        `/integrations/${integrationId}/widgets/deploy-health?engagementId=${engagementId}`
      );
      return response.data;
    },
    enabled: !!integrationId,
    refetchInterval: 120000, // 2 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deploy Health
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Deploy Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {integrationId ? 'Failed to load deployment data' : 'Connect CI/CD integration to view'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    success: 'text-green-500',
    failure: 'text-red-500',
    pending: 'text-yellow-500',
    running: 'text-blue-500',
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deploy Health
          </span>
          <span
            className={`text-2xl font-bold ${data.successRate >= 90 ? 'text-green-500' : data.successRate >= 70 ? 'text-yellow-500' : 'text-red-500'}`}
          >
            {data.successRate}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Environment Status */}
        <div className="flex gap-2">
          {Object.entries(data.environmentStatus).map(([env, status]) => (
            <div
              key={env}
              className={`rounded px-2 py-1 text-xs font-medium ${
                status === 'healthy'
                  ? 'bg-green-100 text-green-700'
                  : status === 'degraded'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {env}
            </div>
          ))}
        </div>

        {/* Recent Deployments */}
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">Recent Deployments</h4>
          <div className="space-y-2">
            {data.recentDeployments
              .slice(0, 5)
              .map(
                (deploy: {
                  id: string;
                  environment: string;
                  status: 'success' | 'failure' | 'pending' | 'running';
                  deployedAt: string;
                  duration: number;
                  commitSha: string;
                  author: string;
                }) => (
                  <div key={deploy.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={deploy.status} />
                      <span className="font-mono text-xs">{deploy.commitSha.slice(0, 7)}</span>
                      <span className="text-muted-foreground">{deploy.environment}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(deploy.deployedAt)}
                    </span>
                  </div>
                )
              )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 border-t pt-2">
          <div>
            <p className="text-muted-foreground text-xs">Avg Duration</p>
            <p className="text-lg font-semibold">{formatDuration(data.averageDuration)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Last Deploy</p>
            <p className="text-lg font-semibold">
              {data.lastDeployment ? formatRelativeTime(data.lastDeployment) : 'N/A'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export default DeployHealthWidget;
