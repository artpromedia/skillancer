'use client';

import { TrendingUp, TrendingDown, PieChart, Gauge, ArrowRight } from 'lucide-react';
import React from 'react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface StageData {
  stage: string;
  amount: number;
  count: number;
  percentage: number;
}

interface PipelineData {
  totalPipeline: number;
  trend: number;
  velocity: number;
  byStage: StageData[];
  byCampaign: { campaign: string; amount: number }[];
  bySource: { source: string; amount: number }[];
}

interface PipelineWidgetProps {
  data?: PipelineData;
  isLoading?: boolean;
  error?: Error | null;
  compact?: boolean;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function PipelineWidget({ data, isLoading, error, compact = false }: PipelineWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <PieChart className="h-4 w-4" />
            Marketing Pipeline
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
            <PieChart className="h-4 w-4" />
            Marketing Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Failed to load pipeline data</p>
        </CardContent>
      </Card>
    );
  }

  const mockData: PipelineData = data || {
    totalPipeline: 1247000,
    trend: 18,
    velocity: 32,
    byStage: [
      { stage: 'Qualification', amount: 450000, count: 45, percentage: 36 },
      { stage: 'Discovery', amount: 320000, count: 28, percentage: 26 },
      { stage: 'Proposal', amount: 280000, count: 18, percentage: 22 },
      { stage: 'Negotiation', amount: 197000, count: 12, percentage: 16 },
    ],
    byCampaign: [
      { campaign: 'Q4 Product Launch', amount: 380000 },
      { campaign: 'Enterprise Webinar', amount: 245000 },
      { campaign: 'Content Syndication', amount: 198000 },
    ],
    bySource: [
      { source: 'Organic Search', amount: 420000 },
      { source: 'Paid Ads', amount: 380000 },
      { source: 'Events', amount: 247000 },
      { source: 'Referral', amount: 200000 },
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
              <PieChart className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium">Marketing Pipeline</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(mockData.totalPipeline)}</p>
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

  const stageColors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <PieChart className="h-4 w-4 text-emerald-600" />
          Marketing Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metric */}
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold">{formatCurrency(mockData.totalPipeline)}</span>
          <Badge className="gap-1" variant={mockData.trend >= 0 ? 'default' : 'destructive'}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(mockData.trend)}%
          </Badge>
        </div>

        {/* Velocity */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Gauge className="h-4 w-4" />
          <span>Pipeline Velocity: {mockData.velocity} days avg</span>
        </div>

        {/* Stage Funnel */}
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            By Stage
          </p>
          <div className="space-y-2">
            {mockData.byStage.map((stage, idx) => (
              <div key={stage.stage} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${stageColors[idx % stageColors.length]}`}
                    />
                    <span>{stage.stage}</span>
                    <span className="text-muted-foreground">({stage.count})</span>
                  </div>
                  <span className="font-medium">{formatCurrency(stage.amount)}</span>
                </div>
                <div className="bg-muted h-1.5 rounded-full">
                  <div
                    className={`h-full rounded-full ${stageColors[idx % stageColors.length]}`}
                    style={{ width: `${stage.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Sources */}
        <div className="space-y-2 border-t pt-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Top Sources
          </p>
          <div className="space-y-1">
            {mockData.bySource.slice(0, 3).map((source) => (
              <div key={source.source} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <ArrowRight className="text-muted-foreground h-3 w-3" />
                  <span>{source.source}</span>
                </div>
                <span className="font-medium">{formatCurrency(source.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PipelineWidget;
