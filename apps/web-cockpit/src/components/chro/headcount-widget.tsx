'use client';

import { Users, TrendingUp, TrendingDown, Building2, MapPin } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface HeadcountWidgetProps {
  data?: {
    totalHeadcount: number;
    changeThisMonth: number;
    changeYTD: number;
    byDepartment: Array<{
      department: string;
      count: number;
      percentage: number;
    }>;
    newHires: number;
    terminations: number;
    trend: Array<{ month: string; count: number }>;
  };
  isLoading?: boolean;
}

export function HeadcountWidget({ data, isLoading }: HeadcountWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Headcount Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-12 w-1/3 rounded" />
            <div className="bg-muted h-4 w-1/2 rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-muted h-8 rounded" />
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
            Headcount Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No headcount data available. Connect your HRIS to see employee data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPositiveChange = data.changeThisMonth >= 0;
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Headcount Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Metric */}
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold">{data.totalHeadcount}</span>
          <Badge
            className="flex items-center gap-1"
            variant={isPositiveChange ? 'default' : 'destructive'}
          >
            <TrendIcon className="h-3 w-3" />
            {isPositiveChange ? '+' : ''}
            {data.changeThisMonth} MTD
          </Badge>
        </div>

        {/* YTD Change */}
        <div className="text-muted-foreground text-sm">
          {data.changeYTD >= 0 ? '+' : ''}
          {data.changeYTD} YTD • {data.newHires} hired, {data.terminations} departed
        </div>

        {/* Department Breakdown */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4" />
            By Department
          </h4>
          {data.byDepartment.slice(0, 5).map((dept) => (
            <div key={dept.department} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{dept.department}</span>
                <span className="font-medium">
                  {dept.count} ({dept.percentage}%)
                </span>
              </div>
              <Progress className="h-2" value={dept.percentage} />
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-green-600">+{data.newHires}</p>
              <p className="text-muted-foreground text-xs">New Hires MTD</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-red-600">-{data.terminations}</p>
              <p className="text-muted-foreground text-xs">Departures MTD</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
