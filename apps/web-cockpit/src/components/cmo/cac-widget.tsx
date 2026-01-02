'use client';

import { TrendingUp, TrendingDown, DollarSign, Clock, Ratio } from 'lucide-react';
import React from 'react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface CACData {
  currentCAC: number;
  trend: number;
  paybackMonths: number;
  ltvCacRatio: number;
  byChannel: { channel: string; cac: number; trend: number }[];
  history: { month: string; cac: number }[];
}

interface CACWidgetProps {
  data?: CACData;
  isLoading?: boolean;
  error?: Error | null;
  compact?: boolean;
}

export function CACWidget({ data, isLoading, error, compact = false }: CACWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            Customer Acquisition Cost
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
            <DollarSign className="h-4 w-4" />
            Customer Acquisition Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Failed to load CAC data</p>
        </CardContent>
      </Card>
    );
  }

  const mockData: CACData = data || {
    currentCAC: 127,
    trend: -15,
    paybackMonths: 4.2,
    ltvCacRatio: 5.8,
    byChannel: [
      { channel: 'Organic', cac: 45, trend: -8 },
      { channel: 'Paid Search', cac: 98, trend: -12 },
      { channel: 'Social', cac: 156, trend: -22 },
      { channel: 'LinkedIn', cac: 234, trend: 5 },
      { channel: 'Referral', cac: 32, trend: -18 },
    ],
    history: [
      { month: 'Jul', cac: 165 },
      { month: 'Aug', cac: 152 },
      { month: 'Sep', cac: 148 },
      { month: 'Oct', cac: 139 },
      { month: 'Nov', cac: 131 },
      { month: 'Dec', cac: 127 },
    ],
  };

  // CAC going down is good (negative trend = positive outcome)
  const TrendIcon = mockData.trend <= 0 ? TrendingDown : TrendingUp;
  const trendColor = mockData.trend <= 0 ? 'text-green-600' : 'text-red-600';
  const isPositiveTrend = mockData.trend <= 0;

  if (compact) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium">CAC</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">${mockData.currentCAC}</p>
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
          <DollarSign className="h-4 w-4 text-blue-600" />
          Customer Acquisition Cost
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metric */}
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold">${mockData.currentCAC}</span>
          <Badge className="gap-1" variant={isPositiveTrend ? 'default' : 'destructive'}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(mockData.trend)}%
          </Badge>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground h-4 w-4" />
            <div>
              <p className="text-sm font-medium">{mockData.paybackMonths.toFixed(1)} months</p>
              <p className="text-muted-foreground text-xs">Payback Period</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Ratio className="text-muted-foreground h-4 w-4" />
            <div>
              <p className="text-sm font-medium">{mockData.ltvCacRatio.toFixed(1)}x</p>
              <p className="text-muted-foreground text-xs">LTV:CAC Ratio</p>
            </div>
          </div>
        </div>

        {/* CAC by Channel */}
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            CAC by Channel
          </p>
          <div className="space-y-2">
            {mockData.byChannel.slice(0, 5).map((channel) => {
              const channelTrendColor = channel.trend <= 0 ? 'text-green-600' : 'text-red-600';
              const ChannelTrendIcon = channel.trend <= 0 ? TrendingDown : TrendingUp;

              return (
                <div key={channel.channel} className="flex items-center justify-between">
                  <span className="text-sm">{channel.channel}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">${channel.cac}</span>
                    <span className={`flex items-center gap-0.5 text-xs ${channelTrendColor}`}>
                      <ChannelTrendIcon className="h-3 w-3" />
                      {Math.abs(channel.trend)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mini Sparkline */}
        <div className="border-t pt-2">
          <p className="text-muted-foreground mb-2 text-xs">6-Month Trend</p>
          <div className="flex h-12 items-end gap-1">
            {mockData.history.map((point, idx) => {
              const maxCAC = Math.max(...mockData.history.map((h) => h.cac));
              const height = (point.cac / maxCAC) * 100;
              const isLast = idx === mockData.history.length - 1;

              return (
                <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${isLast ? 'bg-blue-600' : 'bg-muted'}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-muted-foreground text-[10px]">{point.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CACWidget;
