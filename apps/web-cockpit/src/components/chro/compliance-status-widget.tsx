'use client';

import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface ComplianceStatusWidgetProps {
  data?: {
    score: number;
    byStatus: {
      complete: number;
      inProgress: number;
      notStarted: number;
      overdue: number;
    };
    upcomingDeadlines: Array<{
      id: string;
      title: string;
      dueDate: string;
      category: string;
      jurisdiction: string;
    }>;
    overdueItems: Array<{
      id: string;
      title: string;
      dueDate: string;
    }>;
  };
  isLoading?: boolean;
  onViewAll?: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'Critical';
}

export function ComplianceStatusWidget({
  data,
  isLoading,
  onViewAll,
}: ComplianceStatusWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            HR Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-16 w-1/3 rounded" />
            <div className="bg-muted h-4 w-full rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted h-12 rounded" />
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
            <ShieldCheck className="h-5 w-5" />
            HR Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No compliance items tracked. Add compliance items to monitor HR requirements.
          </p>
        </CardContent>
      </Card>
    );
  }

  const total =
    data.byStatus.complete +
    data.byStatus.inProgress +
    data.byStatus.notStarted +
    data.byStatus.overdue;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          HR Compliance Status
          {data.byStatus.overdue > 0 && (
            <Badge className="ml-2" variant="destructive">
              {data.byStatus.overdue} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score */}
        <div className="flex items-center gap-4">
          <div>
            <span className={`text-4xl font-bold ${getScoreColor(data.score)}`}>{data.score}%</span>
            <p className="text-muted-foreground text-sm">{getScoreLabel(data.score)}</p>
          </div>
          <div className="flex-1">
            <Progress className="h-3" value={data.score} />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-green-50 p-2">
            <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
            <p className="mt-1 text-lg font-bold text-green-600">{data.byStatus.complete}</p>
            <p className="text-muted-foreground text-xs">Complete</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-2">
            <Clock className="mx-auto h-4 w-4 text-blue-600" />
            <p className="mt-1 text-lg font-bold text-blue-600">{data.byStatus.inProgress}</p>
            <p className="text-muted-foreground text-xs">In Progress</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <FileText className="mx-auto h-4 w-4 text-gray-600" />
            <p className="mt-1 text-lg font-bold text-gray-600">{data.byStatus.notStarted}</p>
            <p className="text-muted-foreground text-xs">Not Started</p>
          </div>
          <div className="rounded-lg bg-red-50 p-2">
            <AlertTriangle className="mx-auto h-4 w-4 text-red-600" />
            <p className="mt-1 text-lg font-bold text-red-600">{data.byStatus.overdue}</p>
            <p className="text-muted-foreground text-xs">Overdue</p>
          </div>
        </div>

        {/* Overdue Items */}
        {data.overdueItems.length > 0 && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
            <h4 className="flex items-center gap-1 text-sm font-medium text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Overdue Items
            </h4>
            {data.overdueItems.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.title}</span>
                <span className="text-red-600">{item.dueDate}</span>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Deadlines */}
        {data.upcomingDeadlines.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Upcoming Deadlines</h4>
            {data.upcomingDeadlines.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="bg-muted/50 flex items-center justify-between rounded-lg p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.category} • {item.jurisdiction}
                  </p>
                </div>
                <Badge variant="outline">{item.dueDate}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
