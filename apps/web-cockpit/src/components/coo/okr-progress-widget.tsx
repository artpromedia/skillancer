'use client';

import { Target, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface OKRProgressWidgetProps {
  data?: {
    totalObjectives: number;
    totalKeyResults: number;
    avgProgress: number;
    byStatus: {
      onTrack: number;
      atRisk: number;
      behind: number;
      completed: number;
    };
    objectives: Array<{
      id: string;
      title: string;
      progress: number;
      status: string;
      owner: { id: string; name: string };
      keyResultsCount: number;
    }>;
  };
  isLoading?: boolean;
}

const statusConfig = {
  ON_TRACK: {
    label: 'On Track',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    icon: TrendingUp,
  },
  AT_RISK: {
    label: 'At Risk',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    icon: AlertTriangle,
  },
  BEHIND: { label: 'Behind', color: 'bg-red-500', textColor: 'text-red-600', icon: AlertTriangle },
  COMPLETED: {
    label: 'Completed',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    icon: CheckCircle2,
  },
};

export function OKRProgressWidget({ data, isLoading }: OKRProgressWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            OKR Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-8 w-1/3 rounded" />
            <div className="bg-muted h-4 w-full rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted h-16 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            OKR Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No OKR data available. Create your first objective to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          OKR Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{data.avgProgress}%</p>
            <p className="text-muted-foreground text-sm">Overall Progress</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.totalObjectives}</p>
            <p className="text-muted-foreground text-sm">Active Objectives</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <Progress className="h-3" value={data.avgProgress} />
        </div>

        {/* Status Breakdown */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.byStatus).map(([status, count]) => {
            const config =
              statusConfig[status.toUpperCase() as keyof typeof statusConfig] ||
              statusConfig.ON_TRACK;
            if (count === 0) return null;
            return (
              <Badge key={status} className="gap-1" variant="secondary">
                <span className={`h-2 w-2 rounded-full ${config.color}`} />
                {config.label}: {count}
              </Badge>
            );
          })}
        </div>

        {/* Objective List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Key Objectives</h4>
          {data.objectives.map((objective) => {
            const status = objective.status.toUpperCase() as keyof typeof statusConfig;
            const config = statusConfig[status] || statusConfig.ON_TRACK;
            const StatusIcon = config.icon;

            return (
              <div
                key={objective.id}
                className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <StatusIcon className={`h-4 w-4 ${config.textColor} shrink-0`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{objective.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {objective.owner.name} • {objective.keyResultsCount} Key Results
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Progress className="h-2 w-16" value={objective.progress} />
                  <span className="w-10 text-right text-sm font-medium">{objective.progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
