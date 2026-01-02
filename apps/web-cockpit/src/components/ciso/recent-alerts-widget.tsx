'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface SecurityAlert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source: string;
  timestamp: string;
  acknowledged: boolean;
}

interface RecentAlertsWidgetProps {
  engagementId: string;
  data?: {
    alerts: SecurityAlert[];
    unacknowledged: number;
  };
  isLoading?: boolean;
  onAcknowledge?: (alertId: string) => void;
  onCreateIncident?: (alertId: string) => void;
}

const severityConfig: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  critical: {
    color: 'text-red-600',
    icon: <AlertTriangle className="h-4 w-4" />,
    bg: 'bg-red-100',
  },
  high: {
    color: 'text-orange-600',
    icon: <AlertTriangle className="h-4 w-4" />,
    bg: 'bg-orange-100',
  },
  medium: {
    color: 'text-yellow-600',
    icon: <Bell className="h-4 w-4" />,
    bg: 'bg-yellow-100',
  },
  low: {
    color: 'text-blue-600',
    icon: <Info className="h-4 w-4" />,
    bg: 'bg-blue-100',
  },
  info: {
    color: 'text-gray-600',
    icon: <Info className="h-4 w-4" />,
    bg: 'bg-gray-100',
  },
};

export function RecentAlertsWidget({
  engagementId,
  data,
  isLoading,
  onAcknowledge,
  onCreateIncident,
}: RecentAlertsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded bg-gray-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const alerts = data?.alerts || [];
  const unacknowledged = data?.unacknowledged || 0;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" />
            Recent Alerts
            {unacknowledged > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unacknowledged}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
            <p>No recent alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => {
              const config = severityConfig[alert.severity];
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg p-3 ${
                    alert.acknowledged ? 'bg-gray-50' : config.bg
                  }`}
                >
                  <div className={config.color}>{config.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate font-medium ${
                          alert.acknowledged ? 'text-muted-foreground' : ''
                        }`}
                      >
                        {alert.title}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                      <span>{alert.source}</span>
                      <span>•</span>
                      <span>{formatTime(alert.timestamp)}</span>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <Button size="sm" variant="ghost" onClick={() => onAcknowledge?.(alert.id)}>
                      Ack
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
