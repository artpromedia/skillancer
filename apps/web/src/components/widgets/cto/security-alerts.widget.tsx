'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui';
import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, XCircle, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface SecurityAlertsWidgetProps {
  engagementId: string;
  integrationId?: string;
}

interface SecurityData {
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  total: number;
  criticalIssues: Array<{
    id: string;
    title: string;
    severity: string;
    type: string;
    package?: string;
    cve?: string;
    fixAvailable: boolean;
    introducedDate: string;
  }>;
  licenseIssues: number;
  lastScanDate: string | null;
  trend: 'improving' | 'stable' | 'worsening';
}

export function SecurityAlertsWidget({ engagementId, integrationId }: SecurityAlertsWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['widget', 'security-alerts', engagementId, integrationId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: SecurityData }>(
        `/integrations/${integrationId}/widgets/vulnerability-summary?engagementId=${engagementId}`
      );
      return response.data;
    },
    enabled: !!integrationId,
    refetchInterval: 300000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
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
            Security Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {integrationId ? 'Failed to load security data' : 'Connect Snyk/Dependabot to view'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Shield className="h-4 w-4 text-blue-500" />;
    }
  };

  const securityScore = calculateSecurityScore(data.counts);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </span>
          <span className={`text-2xl font-bold ${getScoreColor(securityScore)}`}>
            {securityScore}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Severity Breakdown */}
        <div className="grid grid-cols-4 gap-2">
          <SeverityBadge
            color="bg-red-100 text-red-700"
            count={data.counts.critical}
            label="Critical"
          />
          <SeverityBadge
            color="bg-orange-100 text-orange-700"
            count={data.counts.high}
            label="High"
          />
          <SeverityBadge
            color="bg-yellow-100 text-yellow-700"
            count={data.counts.medium}
            label="Medium"
          />
          <SeverityBadge color="bg-blue-100 text-blue-700" count={data.counts.low} label="Low" />
        </div>

        {/* Critical Issues List */}
        {data.criticalIssues && data.criticalIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
              <XCircle className="h-3 w-3 text-red-500" />
              Critical Issues
            </h4>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {data.criticalIssues
                .slice(0, 5)
                .map(
                  (issue: {
                    id: string;
                    title: string;
                    severity: string;
                    type: string;
                    package?: string;
                    cve?: string;
                    fixAvailable: boolean;
                    introducedDate: string;
                  }) => (
                    <div key={issue.id} className="rounded-md bg-red-50 p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(issue.severity)}
                          <span className="line-clamp-1 font-medium text-red-900">
                            {issue.title}
                          </span>
                        </div>
                        {issue.fixAvailable && (
                          <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                            Fix available
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex gap-2 text-xs text-red-700">
                        {issue.cve && <span className="font-mono">{issue.cve}</span>}
                        {issue.package && <span>in {issue.package}</span>}
                      </div>
                    </div>
                  )
                )}
            </div>
          </div>
        )}

        {/* All Clear State */}
        {data.total === 0 && (
          <div className="flex flex-col items-center py-4">
            <CheckCircle className="mb-2 h-12 w-12 text-green-500" />
            <p className="font-medium text-green-700">All Clear!</p>
            <p className="text-muted-foreground text-sm">No security vulnerabilities detected</p>
          </div>
        )}

        {/* Stats Footer */}
        <div className="grid grid-cols-2 gap-4 border-t pt-2 text-sm">
          <div>
            <p className="text-muted-foreground">Total Issues</p>
            <p className="text-lg font-semibold">{data.total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">License Issues</p>
            <p className="text-lg font-semibold">{data.licenseIssues}</p>
          </div>
        </div>

        {/* Last Scan */}
        {data.lastScanDate && (
          <p className="text-muted-foreground text-center text-xs">
            Last scanned: {formatRelativeTime(data.lastScanDate)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-md p-2 text-center ${color}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function calculateSecurityScore(counts: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}): number {
  const weights = { critical: 25, high: 10, medium: 3, low: 1 };
  const penalty =
    counts.critical * weights.critical +
    counts.high * weights.high +
    counts.medium * weights.medium +
    counts.low * weights.low;
  return Math.max(0, 100 - penalty);
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
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

export default SecurityAlertsWidget;
