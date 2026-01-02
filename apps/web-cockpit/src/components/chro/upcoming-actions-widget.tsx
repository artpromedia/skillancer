'use client';

import { Bell, Calendar, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';

interface UpcomingActionsWidgetProps {
  data?: {
    items: Array<{
      id: string;
      title: string;
      dueDate: string;
      category: 'review' | 'benefits' | 'compliance' | 'training' | 'other';
      affectedCount?: number;
      priority: 'high' | 'medium' | 'low';
      status: 'upcoming' | 'due_soon' | 'overdue';
    }>;
    overdueCount: number;
    dueSoonCount: number;
    upcomingCount: number;
  };
  isLoading?: boolean;
  onMarkComplete?: (itemId: string) => void;
  onSnooze?: (itemId: string) => void;
  onViewDetails?: (itemId: string) => void;
}

const categoryConfig = {
  review: { label: 'Reviews', icon: Users, color: 'bg-blue-100 text-blue-700' },
  benefits: { label: 'Benefits', icon: Calendar, color: 'bg-green-100 text-green-700' },
  compliance: { label: 'Compliance', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700' },
  training: { label: 'Training', icon: CheckCircle2, color: 'bg-purple-100 text-purple-700' },
  other: { label: 'Other', icon: Bell, color: 'bg-gray-100 text-gray-700' },
};

const statusConfig = {
  upcoming: { label: 'Upcoming', variant: 'secondary' as const },
  due_soon: { label: 'Due Soon', variant: 'default' as const },
  overdue: { label: 'Overdue', variant: 'destructive' as const },
};

export function UpcomingActionsWidget({
  data,
  isLoading,
  onMarkComplete,
  onSnooze,
  onViewDetails,
}: UpcomingActionsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Upcoming HR Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-20 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Upcoming HR Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="text-muted-foreground mt-2">All caught up! No pending actions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Upcoming HR Actions
          {data.overdueCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {data.overdueCount} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Pills */}
        <div className="flex gap-2">
          {data.overdueCount > 0 && (
            <Badge variant="destructive">{data.overdueCount} Overdue</Badge>
          )}
          {data.dueSoonCount > 0 && <Badge variant="default">{data.dueSoonCount} Due Soon</Badge>}
          <Badge variant="secondary">{data.upcomingCount} Upcoming</Badge>
        </div>

        {/* Action Items */}
        <div className="space-y-3">
          {data.items.slice(0, 5).map((item) => {
            const category = categoryConfig[item.category];
            const status = statusConfig[item.status];
            const CategoryIcon = category.icon;
            const isOverdue = item.status === 'overdue';

            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${isOverdue ? 'border-red-200 bg-red-50/50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${category.color}`}>
                      <CategoryIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3" />
                        <span>{item.dueDate}</span>
                        {item.affectedCount && (
                          <>
                            <span>•</span>
                            <Users className="h-3 w-3" />
                            <span>{item.affectedCount} employees</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                {/* Action Buttons */}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onMarkComplete?.(item.id)}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onSnooze?.(item.id)}
                  >
                    Snooze
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onViewDetails?.(item.id)}
                  >
                    Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {data.items.length > 5 && (
          <p className="text-muted-foreground text-center text-sm">
            +{data.items.length - 5} more actions
          </p>
        )}
      </CardContent>
    </Card>
  );
}
