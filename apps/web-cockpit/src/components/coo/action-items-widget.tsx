'use client';

import { CheckSquare, Clock, AlertCircle, MoreHorizontal, ExternalLink } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@skillancer/ui/dropdown-menu';

interface ActionItem {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  source: 'meeting' | 'okr' | 'project' | 'manual';
  sourceRef?: string;
  priority: 'high' | 'medium' | 'low';
  isOverdue?: boolean;
}

interface ActionItemsWidgetProps {
  engagementId: string;
  data?: {
    actionItems: ActionItem[];
    overdueCount: number;
    dueTodayCount: number;
  };
  isLoading?: boolean;
  onComplete?: (itemId: string) => void;
  onViewAll?: () => void;
}

const priorityStyles: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200',
};

const sourceLabels: Record<string, string> = {
  meeting: 'Meeting Note',
  okr: 'OKR',
  project: 'Project',
  manual: 'Manual',
};

export function ActionItemsWidget({
  engagementId,
  data,
  isLoading,
  onComplete,
  onViewAll,
}: ActionItemsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-5 w-5" />
            Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded bg-gray-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const actionItems = data?.actionItems || [];
  const overdueCount = data?.overdueCount || 0;
  const dueTodayCount = data?.dueTodayCount || 0;

  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatDueDate = (dueDate: string, isOverdue?: boolean) => {
    const days = getDaysUntilDue(dueDate);
    if (isOverdue || days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-5 w-5" />
            Action Items
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onViewAll}>
            View All
          </Button>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3 w-3" />
              {overdueCount} overdue
            </span>
          )}
          {dueTodayCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <Clock className="h-3 w-3" />
              {dueTodayCount} due today
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {actionItems.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center">
            <CheckSquare className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>No open action items</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actionItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  item.isOverdue ? 'border-red-200 bg-red-50' : 'bg-white'
                }`}
              >
                <button
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 border-gray-300 transition-colors hover:border-green-500"
                  onClick={() => onComplete?.(item.id)}
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.title}</div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    <span>{item.assignee}</span>
                    <span>•</span>
                    <span className={item.isOverdue ? 'font-medium text-red-600' : ''}>
                      {formatDueDate(item.dueDate, item.isOverdue)}
                    </span>
                    <span>•</span>
                    <span>{sourceLabels[item.source]}</span>
                  </div>
                </div>

                <Badge className={priorityStyles[item.priority]} variant="outline">
                  {item.priority}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-8" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Reassign</DropdownMenuItem>
                    <DropdownMenuItem>Change Due Date</DropdownMenuItem>
                    {item.sourceRef && (
                      <DropdownMenuItem>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Source
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {actionItems.length > 5 && (
          <Button className="mt-2 w-full" variant="link" onClick={onViewAll}>
            View {actionItems.length - 5} more items
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
