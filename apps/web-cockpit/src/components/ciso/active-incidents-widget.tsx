'use client';

import { AlertOctagon, Clock, User } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface Incident {
  id: string;
  title: string;
  severity: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';
  status: string;
  detectedAt: string;
  assignedTo?: string;
}

interface ActiveIncidentsWidgetProps {
  engagementId: string;
  data?: {
    incidents: Incident[];
    summary: {
      total: number;
      bySeverity: {
        P1_CRITICAL: number;
        P2_HIGH: number;
        P3_MEDIUM: number;
        P4_LOW: number;
      };
      oldestHours: number;
    };
  };
  isLoading?: boolean;
  onViewIncident?: (incidentId: string) => void;
}

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  P1_CRITICAL: { label: 'P1', color: 'text-red-600', bg: 'bg-red-100' },
  P2_HIGH: { label: 'P2', color: 'text-orange-600', bg: 'bg-orange-100' },
  P3_MEDIUM: { label: 'P3', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  P4_LOW: { label: 'P4', color: 'text-blue-600', bg: 'bg-blue-100' },
};

const statusLabels: Record<string, string> = {
  DETECTED: 'Detected',
  TRIAGED: 'Triaged',
  CONTAINMENT: 'Containment',
  ERADICATION: 'Eradication',
  RECOVERY: 'Recovery',
  POST_INCIDENT: 'Post-Incident',
  CLOSED: 'Closed',
};

export function ActiveIncidentsWidget({
  engagementId,
  data,
  isLoading,
  onViewIncident,
}: ActiveIncidentsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="h-5 w-5" />
            Active Incidents
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

  const incidents = data?.incidents || [];
  const summary = data?.summary || {
    total: 0,
    bySeverity: { P1_CRITICAL: 0, P2_HIGH: 0, P3_MEDIUM: 0, P4_LOW: 0 },
    oldestHours: 0,
  };

  const formatDuration = (detectedAt: string) => {
    const detected = new Date(detectedAt);
    const now = new Date();
    const hours = Math.floor((now.getTime() - detected.getTime()) / 3600000);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="h-5 w-5" />
            Active Incidents
            {summary.total > 0 && <Badge variant="destructive">{summary.total}</Badge>}
          </CardTitle>
          <Button size="sm" variant="outline">
            New Incident
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Severity Summary */}
        <div className="mb-4 flex gap-2">
          {summary.bySeverity.P1_CRITICAL > 0 && (
            <Badge variant="destructive">{summary.bySeverity.P1_CRITICAL} P1</Badge>
          )}
          {summary.bySeverity.P2_HIGH > 0 && (
            <Badge className="bg-orange-500">{summary.bySeverity.P2_HIGH} P2</Badge>
          )}
          {summary.bySeverity.P3_MEDIUM > 0 && (
            <Badge className="bg-yellow-500 text-black">{summary.bySeverity.P3_MEDIUM} P3</Badge>
          )}
          {summary.bySeverity.P4_LOW > 0 && (
            <Badge variant="secondary">{summary.bySeverity.P4_LOW} P4</Badge>
          )}
        </div>

        {incidents.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <AlertOctagon className="mx-auto mb-2 h-12 w-12 text-green-500" />
            <p>No active incidents</p>
            <p className="text-sm">All systems operational</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.slice(0, 5).map((incident) => {
              const config = severityConfig[incident.severity];
              return (
                <div
                  key={incident.id}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors hover:border-gray-300 ${config.bg}`}
                  onClick={() => onViewIncident?.(incident.id)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Badge className={`${config.bg} ${config.color} border-0`}>
                      {config.label}
                    </Badge>
                    <span className="truncate font-medium">{incident.title}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="rounded bg-white/50 px-2 py-0.5">
                      {statusLabels[incident.status] || incident.status}
                    </span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(incident.detectedAt)}</span>
                    </div>
                    {incident.assignedTo && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{incident.assignedTo}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Oldest Incident Warning */}
        {summary.oldestHours > 24 && (
          <div className="mt-3 rounded border border-orange-200 bg-orange-50 p-2 text-sm text-orange-800">
            ⚠️ Oldest incident open for {Math.floor(summary.oldestHours / 24)} days
          </div>
        )}
      </CardContent>
    </Card>
  );
}
