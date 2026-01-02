'use client';

import { Users, UserCheck, UserMinus, AlertCircle } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface TeamCapacityWidgetProps {
  data?: {
    totalHeadcount: number;
    totalCapacity: number;
    totalAllocated: number;
    avgUtilization: number;
    byStatus: {
      overallocated: number;
      optimal: number;
      available: number;
      underutilized: number;
    };
    departments: Array<{
      name: string;
      headcount: number;
      totalCapacity: number;
      totalAllocated: number;
      avgUtilization: number;
    }>;
    topAllocated: Array<{
      id: string;
      name: string;
      role: string;
      utilization: number;
      status: string;
    }>;
  };
  isLoading?: boolean;
}

const statusConfig = {
  OVERALLOCATED: { label: 'Overallocated', color: 'bg-red-500', textColor: 'text-red-600' },
  OPTIMAL: { label: 'Optimal', color: 'bg-green-500', textColor: 'text-green-600' },
  AVAILABLE: { label: 'Available', color: 'bg-blue-500', textColor: 'text-blue-600' },
  UNDERUTILIZED: { label: 'Underutilized', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
};

export function TeamCapacityWidget({ data, isLoading }: TeamCapacityWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-muted h-16 rounded" />
              ))}
            </div>
            <div className="bg-muted h-4 rounded" />
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
            <Users className="h-5 w-5" />
            Team Capacity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No capacity data available. Add team members to track capacity.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 100) return 'text-red-600';
    if (utilization >= 80) return 'text-green-600';
    if (utilization >= 50) return 'text-blue-600';
    return 'text-yellow-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Capacity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold">{data.totalHeadcount}</p>
            <p className="text-muted-foreground text-sm">Team Members</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${getUtilizationColor(data.avgUtilization)}`}>
              {data.avgUtilization}%
            </p>
            <p className="text-muted-foreground text-sm">Avg Utilization</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.totalCapacity - data.totalAllocated}h</p>
            <p className="text-muted-foreground text-sm">Available</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Capacity Utilization</span>
            <span>
              {data.totalAllocated}h / {data.totalCapacity}h
            </span>
          </div>
          <Progress className="h-3" value={Math.min(100, data.avgUtilization)} />
        </div>

        {/* Status Breakdown */}
        <div className="flex flex-wrap gap-2">
          {data.byStatus.overallocated > 0 && (
            <Badge className="gap-1" variant="destructive">
              <AlertCircle className="h-3 w-3" />
              {data.byStatus.overallocated} Overallocated
            </Badge>
          )}
          {data.byStatus.optimal > 0 && (
            <Badge className="gap-1 bg-green-100 text-green-700" variant="secondary">
              <UserCheck className="h-3 w-3" />
              {data.byStatus.optimal} Optimal
            </Badge>
          )}
          {data.byStatus.available > 0 && (
            <Badge className="gap-1" variant="secondary">
              {data.byStatus.available} Available
            </Badge>
          )}
          {data.byStatus.underutilized > 0 && (
            <Badge className="gap-1" variant="outline">
              <UserMinus className="h-3 w-3" />
              {data.byStatus.underutilized} Underutilized
            </Badge>
          )}
        </div>

        {/* Department Summary */}
        {data.departments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">By Department</h4>
            {data.departments.slice(0, 4).map((dept) => (
              <div key={dept.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{dept.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{dept.headcount} people</span>
                  <span className={`font-medium ${getUtilizationColor(dept.avgUtilization)}`}>
                    {dept.avgUtilization}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top Allocated */}
        {data.topAllocated.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Highest Allocation</h4>
            {data.topAllocated.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="bg-muted/50 flex items-center justify-between rounded p-2"
              >
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-muted-foreground text-xs">{member.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Progress className="h-2 w-16" value={Math.min(100, member.utilization)} />
                  <span
                    className={`text-sm font-medium ${getUtilizationColor(member.utilization)}`}
                  >
                    {member.utilization}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
