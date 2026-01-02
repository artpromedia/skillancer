'use client';

import { Target, TrendingUp, TrendingDown, Users, DollarSign } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface HeadcountPlanWidgetProps {
  data?: {
    year: number;
    plannedTotal: number;
    actualTotal: number;
    variance: number;
    byQuarter: {
      q1: { planned: number; actual: number };
      q2: { planned: number; actual: number };
      q3: { planned: number; actual: number };
      q4: { planned: number; actual: number };
    };
    openPositions: number;
    budgetImpact: number;
    currentQuarter: string;
  };
  isLoading?: boolean;
}

export function HeadcountPlanWidget({ data, isLoading }: HeadcountPlanWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Headcount Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-12 w-1/3 rounded" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
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
            Headcount Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No headcount plan set for this year. Create a plan to track hiring against goals.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isAheadOfPlan = data.variance >= 0;
  const TrendIcon = isAheadOfPlan ? TrendingUp : TrendingDown;
  const progressPercent = data.plannedTotal > 0 ? (data.actualTotal / data.plannedTotal) * 100 : 0;

  const quarters = ['q1', 'q2', 'q3', 'q4'] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Headcount Plan {data.year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{data.actualTotal}</span>
              <span className="text-muted-foreground">/ {data.plannedTotal} planned</span>
            </div>
            <Badge
              variant={isAheadOfPlan ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              <TrendIcon className="h-3 w-3" />
              {isAheadOfPlan ? '+' : ''}
              {data.variance}
            </Badge>
          </div>
          <Progress value={Math.min(progressPercent, 100)} className="h-3" />
          <p className="text-muted-foreground text-xs">
            {Math.round(progressPercent)}% of plan • {data.openPositions} positions open
          </p>
        </div>

        {/* Quarterly Breakdown */}
        <div className="grid grid-cols-4 gap-2">
          {quarters.map((q) => {
            const quarter = data.byQuarter[q];
            const isCurrentQuarter = data.currentQuarter === q.toUpperCase();
            const quarterProgress =
              quarter.planned > 0 ? (quarter.actual / quarter.planned) * 100 : 0;
            const quarterVariance = quarter.actual - quarter.planned;

            return (
              <div
                key={q}
                className={`rounded-lg border p-3 text-center ${
                  isCurrentQuarter ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <p className="text-muted-foreground text-xs font-medium">
                  {q.toUpperCase()}
                  {isCurrentQuarter && ' ←'}
                </p>
                <p className="mt-1 text-lg font-bold">{quarter.actual}</p>
                <p className="text-muted-foreground text-xs">/ {quarter.planned}</p>
                <Badge
                  variant={quarterVariance >= 0 ? 'secondary' : 'outline'}
                  className="mt-1 text-xs"
                >
                  {quarterVariance >= 0 ? '+' : ''}
                  {quarterVariance}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Budget Impact */}
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <DollarSign className="h-4 w-4" />
            Budget Impact
          </span>
          <span
            className={`font-medium ${data.budgetImpact >= 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {data.budgetImpact >= 0 ? '+' : ''}${Math.abs(data.budgetImpact).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
