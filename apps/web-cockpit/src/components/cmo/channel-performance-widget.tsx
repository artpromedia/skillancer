'use client';

import { TrendingUp, TrendingDown, BarChart3, ArrowUpDown } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';

interface ChannelData {
  channel: string;
  spend: number;
  leads: number;
  mqls: number;
  cac: number;
  efficiency: 'high' | 'medium' | 'low';
  trend: number;
}

interface ChannelPerformanceData {
  channels: ChannelData[];
  totals: {
    spend: number;
    leads: number;
    mqls: number;
    avgCAC: number;
  };
}

interface ChannelPerformanceWidgetProps {
  data?: ChannelPerformanceData;
  isLoading?: boolean;
  error?: Error | null;
}

type SortField = 'spend' | 'leads' | 'mqls' | 'cac';

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatNumber = (value: number): string => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

export function ChannelPerformanceWidget({
  data,
  isLoading,
  error,
}: ChannelPerformanceWidgetProps) {
  const [sortBy, setSortBy] = useState<SortField>('spend');

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            Channel Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted h-12 rounded" />
            ))}
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
            <BarChart3 className="h-4 w-4" />
            Channel Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Failed to load channel data</p>
        </CardContent>
      </Card>
    );
  }

  const mockData: ChannelPerformanceData = data || {
    channels: [
      {
        channel: 'Organic Search',
        spend: 0,
        leads: 1250,
        mqls: 312,
        cac: 45,
        efficiency: 'high',
        trend: 12,
      },
      {
        channel: 'Google Ads',
        spend: 45000,
        leads: 890,
        mqls: 198,
        cac: 98,
        efficiency: 'medium',
        trend: -5,
      },
      {
        channel: 'LinkedIn Ads',
        spend: 38000,
        leads: 420,
        mqls: 156,
        cac: 234,
        efficiency: 'low',
        trend: 8,
      },
      {
        channel: 'Meta Ads',
        spend: 28000,
        leads: 680,
        mqls: 145,
        cac: 156,
        efficiency: 'medium',
        trend: -12,
      },
      {
        channel: 'Email',
        spend: 5000,
        leads: 520,
        mqls: 98,
        cac: 52,
        efficiency: 'high',
        trend: 15,
      },
      {
        channel: 'Content/SEO',
        spend: 12000,
        leads: 340,
        mqls: 87,
        cac: 138,
        efficiency: 'medium',
        trend: 22,
      },
      {
        channel: 'Referral',
        spend: 2000,
        leads: 180,
        mqls: 83,
        cac: 32,
        efficiency: 'high',
        trend: 6,
      },
    ],
    totals: {
      spend: 130000,
      leads: 4280,
      mqls: 1079,
      avgCAC: 121,
    },
  };

  const sortedChannels = [...mockData.channels].sort((a, b) => {
    switch (sortBy) {
      case 'spend':
        return b.spend - a.spend;
      case 'leads':
        return b.leads - a.leads;
      case 'mqls':
        return b.mqls - a.mqls;
      case 'cac':
        return a.cac - b.cac; // Lower is better
      default:
        return 0;
    }
  });

  const efficiencyColors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    low: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };

  const maxSpend = Math.max(...mockData.channels.map((c) => c.spend));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            Channel Performance
          </CardTitle>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
            <SelectTrigger className="h-8 w-32">
              <ArrowUpDown className="mr-1 h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">Spend</SelectItem>
              <SelectItem value="leads">Leads</SelectItem>
              <SelectItem value="mqls">MQLs</SelectItem>
              <SelectItem value="cac">CAC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Row */}
        <div className="bg-muted/50 grid grid-cols-4 gap-4 rounded-lg p-3">
          <div className="text-center">
            <p className="text-lg font-semibold">{formatCurrency(mockData.totals.spend)}</p>
            <p className="text-muted-foreground text-xs">Total Spend</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{formatNumber(mockData.totals.leads)}</p>
            <p className="text-muted-foreground text-xs">Leads</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">{formatNumber(mockData.totals.mqls)}</p>
            <p className="text-muted-foreground text-xs">MQLs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold">${mockData.totals.avgCAC}</p>
            <p className="text-muted-foreground text-xs">Avg CAC</p>
          </div>
        </div>

        {/* Channel Table */}
        <div className="space-y-2">
          {/* Header */}
          <div className="text-muted-foreground grid grid-cols-12 gap-2 px-2 text-xs font-medium">
            <div className="col-span-3">Channel</div>
            <div className="col-span-2 text-right">Spend</div>
            <div className="col-span-2 text-right">Leads</div>
            <div className="col-span-2 text-right">MQLs</div>
            <div className="col-span-1 text-right">CAC</div>
            <div className="col-span-2 text-center">Efficiency</div>
          </div>

          {/* Rows */}
          {sortedChannels.map((channel) => {
            const TrendIcon = channel.trend >= 0 ? TrendingUp : TrendingDown;
            const trendColor = channel.trend >= 0 ? 'text-green-600' : 'text-red-600';
            const spendWidth = maxSpend > 0 ? (channel.spend / maxSpend) * 100 : 0;

            return (
              <div
                key={channel.channel}
                className="hover:bg-muted/50 grid grid-cols-12 items-center gap-2 rounded-lg px-2 py-2 transition-colors"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{channel.channel}</span>
                    <span className={`flex items-center gap-0.5 text-xs ${trendColor}`}>
                      <TrendIcon className="h-3 w-3" />
                      {Math.abs(channel.trend)}%
                    </span>
                  </div>
                  {/* Mini spend bar */}
                  {channel.spend > 0 && (
                    <div className="bg-muted mt-1 h-1 max-w-[80px] rounded-full">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${spendWidth}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-right text-sm">
                  {channel.spend > 0 ? formatCurrency(channel.spend) : '-'}
                </div>
                <div className="col-span-2 text-right text-sm font-medium">
                  {formatNumber(channel.leads)}
                </div>
                <div className="col-span-2 text-right text-sm font-medium">
                  {formatNumber(channel.mqls)}
                </div>
                <div className="col-span-1 text-right text-sm font-medium">${channel.cac}</div>
                <div className="col-span-2 flex justify-center">
                  <Badge className={`${efficiencyColors[channel.efficiency]} text-xs`}>
                    {channel.efficiency}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default ChannelPerformanceWidget;
