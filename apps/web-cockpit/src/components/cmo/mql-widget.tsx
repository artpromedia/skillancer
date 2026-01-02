'use client';

import { TrendingUp, TrendingDown, Users, Target, Zap } from 'lucide-react';
import React from 'react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface MQLData {
  count: number;
  trend: number;
  rate: number;
  bySource: Record<string, number>;
  topSources: { source: string; count: number; percentage: number }[];
}

interface MQLWidgetProps {
  data?: MQLData;
  isLoading?: boolean;
  error?: Error | null;
  compact?: boolean;
}

export function MQLWidget({ data, isLoading, error, compact = false }: MQLWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4" />
            Marketing Qualified Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="bg-muted h-8 w-24 rounded" />
            <div className="bg-muted h-4 w-32 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4" />
            Marketing Qualified Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Failed to load MQL data</p>
        </CardContent>
      </Card>
    );
  }

  const mockData: MQLData = data || {
    count: 847,
    trend: 23,
    rate: 12.4,
    bySource: {
      'Organic Search': 312,
      'Paid Search': 198,
      'Social Media': 156,
      Email: 98,
      Referral: 83,
    },
    topSources: [
      { source: 'Organic Search', count: 312, percentage: 36.8 },
      { source: 'Paid Search', count: 198, percentage: 23.4 },
      { source: 'Social Media', count: 156, percentage: 18.4 },
    ],
  };

  const TrendIcon = mockData.trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = mockData.trend >= 0 ? 'text-green-600' : 'text-red-600';

  if (compact) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium">MQLs (MTD)</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{mockData.count.toLocaleString()}</p>
              <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                <span>{Math.abs(mockData.trend)}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-purple-600" />
          Marketing Qualified Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metric */}
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold">{mockData.count.toLocaleString()}</span>
          <Badge className="gap-1" variant={mockData.trend >= 0 ? 'default' : 'destructive'}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(mockData.trend)}%
          </Badge>
        </div>

        {/* MQL Rate */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4" />
          <span>MQL Rate: {mockData.rate.toFixed(1)}%</span>
        </div>

        {/* Top Sources */}
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Top Sources
          </p>
          <div className="space-y-2">
            {mockData.topSources.map((source) => (
              <div key={source.source} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{source.source}</span>
                    <span className="font-medium">{source.count}</span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 rounded-full">
                    <div
                      className="h-full rounded-full bg-purple-600"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 border-t pt-2">
          <div className="text-center">
            <Users className="text-muted-foreground mx-auto h-4 w-4" />
            <p className="mt-1 text-lg font-semibold">{Object.keys(mockData.bySource).length}</p>
            <p className="text-muted-foreground text-xs">Sources</p>
          </div>
          <div className="text-center">
            <Target className="text-muted-foreground mx-auto h-4 w-4" />
            <p className="mt-1 text-lg font-semibold">{Math.round(mockData.count / 30)}</p>
            <p className="text-muted-foreground text-xs">Avg/Day</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MQLWidget;
