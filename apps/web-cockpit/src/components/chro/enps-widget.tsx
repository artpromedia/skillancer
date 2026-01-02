'use client';

import { Smile, TrendingUp, TrendingDown, Users } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';

interface EnpsWidgetProps {
  data?: {
    score: number;
    previousScore: number;
    trend: number;
    promoters: number;
    passives: number;
    detractors: number;
    totalResponses: number;
    benchmarkScore?: number;
    historicalTrend: Array<{ period: string; score: number }>;
  };
  isLoading?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 50) return 'text-green-600';
  if (score >= 20) return 'text-blue-600';
  if (score >= 0) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreLabel(score: number): string {
  if (score >= 50) return 'Excellent';
  if (score >= 20) return 'Good';
  if (score >= 0) return 'Neutral';
  return 'Needs Attention';
}

export function EnpsWidget({ data, isLoading }: EnpsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Employee NPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-16 w-1/3 rounded" />
            <div className="bg-muted h-4 w-1/2 rounded" />
            <div className="bg-muted h-8 w-full rounded" />
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
            <Smile className="h-5 w-5" />
            Employee NPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No eNPS data available. Connect Culture Amp or Lattice to see engagement scores.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPositiveTrend = data.trend >= 0;
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;
  const totalPeople = data.promoters + data.passives + data.detractors;

  const promoterPercent = totalPeople > 0 ? (data.promoters / totalPeople) * 100 : 0;
  const passivePercent = totalPeople > 0 ? (data.passives / totalPeople) * 100 : 0;
  const detractorPercent = totalPeople > 0 ? (data.detractors / totalPeople) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smile className="h-5 w-5" />
          Employee NPS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score */}
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-bold ${getScoreColor(data.score)}`}>
            {data.score > 0 ? '+' : ''}
            {data.score}
          </span>
          <Badge
            variant={isPositiveTrend ? 'default' : 'destructive'}
            className="flex items-center gap-1"
          >
            <TrendIcon className="h-3 w-3" />
            {isPositiveTrend ? '↑' : '↓'} {Math.abs(data.trend)} pts
          </Badge>
        </div>

        <p className="text-muted-foreground text-sm">
          {getScoreLabel(data.score)}
          {data.benchmarkScore && ` • Industry benchmark: ${data.benchmarkScore}`}
        </p>

        {/* Distribution Bar */}
        <div className="space-y-2">
          <div className="flex h-4 overflow-hidden rounded-full">
            <div className="bg-green-500 transition-all" style={{ width: `${promoterPercent}%` }} />
            <div className="bg-yellow-400 transition-all" style={{ width: `${passivePercent}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${detractorPercent}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Promoters: {data.promoters}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span>Passives: {data.passives}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>Detractors: {data.detractors}</span>
            </div>
          </div>
        </div>

        {/* Response Rate */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" />
              Total Responses
            </span>
            <span className="font-medium">{data.totalResponses}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
