'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Checkbox } from '@skillancer/ui/checkbox';
import { Badge } from '@skillancer/ui/badge';
import { Target, Plus, GripVertical, ArrowRight } from 'lucide-react';

interface Priority {
  id: string;
  title: string;
  owner?: string;
  status: 'not-started' | 'in-progress' | 'done';
  linkedTo?: {
    type: 'okr' | 'project' | 'action-item';
    name: string;
  };
}

interface PrioritiesWidgetProps {
  engagementId: string;
  data?: {
    priorities: Priority[];
    weekOf: string;
  };
  isLoading?: boolean;
  onToggle?: (priorityId: string) => void;
  onAdd?: () => void;
}

const statusStyles: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};

export function PrioritiesWidget({
  engagementId,
  data,
  isLoading,
  onToggle,
  onAdd,
}: PrioritiesWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" />
            This Week's Priorities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-gray-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const priorities = data?.priorities || [];
  const weekOf = data?.weekOf || new Date().toISOString();
  const completedCount = priorities.filter((p) => p.status === 'done').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" />
            This Week's Priorities
          </CardTitle>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="text-muted-foreground text-xs">
          Week of {new Date(weekOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' • '}
          {completedCount}/{priorities.length} complete
        </div>
      </CardHeader>
      <CardContent>
        {priorities.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center">
            <Target className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>No priorities set</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={onAdd}>
              Add Priority
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {priorities.map((priority, index) => (
              <div
                key={priority.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  priority.status === 'done' ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <div className="text-muted-foreground flex cursor-move items-center gap-2">
                  <GripVertical className="h-4 w-4" />
                  <span className="w-4 text-sm font-medium">{index + 1}</span>
                </div>

                <Checkbox
                  checked={priority.status === 'done'}
                  onCheckedChange={() => onToggle?.(priority.id)}
                />

                <div className="min-w-0 flex-1">
                  <div
                    className={`font-medium ${
                      priority.status === 'done' ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {priority.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {priority.owner && (
                      <span className="text-muted-foreground text-xs">{priority.owner}</span>
                    )}
                    {priority.linkedTo && (
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <ArrowRight className="h-3 w-3" />
                        <span>{priority.linkedTo.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Badge variant="secondary" className={statusStyles[priority.status]}>
                  {priority.status.replace('-', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Progress Bar */}
        {priorities.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {Math.round((completedCount / priorities.length) * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${(completedCount / priorities.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
