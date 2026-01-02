'use client';

import { Briefcase, Clock, AlertCircle, Users, ChevronRight } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';

interface OpenRolesWidgetProps {
  data?: {
    totalOpen: number;
    urgentRoles: number;
    avgDaysOpen: number;
    roles: Array<{
      id: string;
      title: string;
      department: string;
      daysOpen: number;
      candidatesInPipeline: number;
      status: 'urgent' | 'active' | 'on_hold';
      location?: string;
    }>;
  };
  isLoading?: boolean;
  onViewAll?: () => void;
}

const statusConfig = {
  urgent: {
    label: 'Urgent',
    variant: 'destructive' as const,
    bgColor: 'bg-red-50',
  },
  active: {
    label: 'Active',
    variant: 'default' as const,
    bgColor: 'bg-green-50',
  },
  on_hold: {
    label: 'On Hold',
    variant: 'secondary' as const,
    bgColor: 'bg-gray-50',
  },
};

export function OpenRolesWidget({ data, isLoading, onViewAll }: OpenRolesWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Open Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-12 w-1/3 rounded" />
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
            <Briefcase className="h-5 w-5" />
            Open Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No open roles data. Connect Greenhouse or Lever to track recruiting.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Open Roles
        </CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{data.totalOpen}</p>
            <p className="text-muted-foreground text-xs">Open Positions</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-600">{data.urgentRoles}</p>
            <p className="text-muted-foreground text-xs">Urgent Roles</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{data.avgDaysOpen}</p>
            <p className="text-muted-foreground text-xs">Avg Days Open</p>
          </div>
        </div>

        {/* Role List */}
        <div className="space-y-3">
          {data.roles.slice(0, 5).map((role) => {
            const config = statusConfig[role.status];
            const isUrgent = role.status === 'urgent';

            return (
              <div
                key={role.id}
                className={`rounded-lg border p-3 ${isUrgent ? 'border-red-200 bg-red-50/50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{role.title}</p>
                      {isUrgent && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {role.department}
                      {role.location && ` • ${role.location}`}
                    </p>
                  </div>
                  <Badge variant={config.variant} className="shrink-0">
                    {config.label}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {role.daysOpen} days
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {role.candidatesInPipeline} candidates
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {data.roles.length > 5 && (
          <p className="text-muted-foreground text-center text-sm">
            +{data.roles.length - 5} more roles
          </p>
        )}
      </CardContent>
    </Card>
  );
}
