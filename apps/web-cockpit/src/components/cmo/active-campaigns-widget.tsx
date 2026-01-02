'use client';

import { Megaphone, Play, Pause, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import React from 'react';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

type CampaignStatus = 'live' | 'draft' | 'paused' | 'ended' | 'scheduled';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: CampaignStatus;
  performance: 'exceeding' | 'on-track' | 'underperforming';
  spend: number;
  budget: number;
  budgetRemaining: number;
  impressions: number;
  clicks: number;
  conversions: number;
  endDate?: string;
}

interface ActiveCampaignsData {
  campaigns: Campaign[];
  summary: {
    live: number;
    paused: number;
    scheduled: number;
    totalSpend: number;
    totalBudget: number;
  };
}

interface ActiveCampaignsWidgetProps {
  data?: ActiveCampaignsData;
  isLoading?: boolean;
  error?: Error | null;
  onCampaignClick?: (campaignId: string) => void;
  onTogglePause?: (campaignId: string, pause: boolean) => void;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatNumber = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

export function ActiveCampaignsWidget({
  data,
  isLoading,
  error,
  onCampaignClick,
  onTogglePause,
}: ActiveCampaignsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Megaphone className="h-4 w-4" />
            Active Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted h-16 rounded" />
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
            <Megaphone className="h-4 w-4" />
            Active Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Failed to load campaigns</p>
        </CardContent>
      </Card>
    );
  }

  const mockData: ActiveCampaignsData = data || {
    campaigns: [
      {
        id: '1',
        name: 'Q4 Product Launch',
        platform: 'Google Ads',
        status: 'live',
        performance: 'exceeding',
        spend: 12500,
        budget: 25000,
        budgetRemaining: 12500,
        impressions: 245000,
        clicks: 8900,
        conversions: 156,
      },
      {
        id: '2',
        name: 'Enterprise Webinar Promo',
        platform: 'LinkedIn',
        status: 'live',
        performance: 'on-track',
        spend: 8200,
        budget: 15000,
        budgetRemaining: 6800,
        impressions: 89000,
        clicks: 2100,
        conversions: 45,
      },
      {
        id: '3',
        name: 'Holiday Retargeting',
        platform: 'Meta',
        status: 'live',
        performance: 'underperforming',
        spend: 5400,
        budget: 8000,
        budgetRemaining: 2600,
        impressions: 156000,
        clicks: 1200,
        conversions: 12,
      },
      {
        id: '4',
        name: 'New Year Countdown',
        platform: 'Multi-channel',
        status: 'scheduled',
        performance: 'on-track',
        spend: 0,
        budget: 20000,
        budgetRemaining: 20000,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        endDate: '2025-01-15',
      },
      {
        id: '5',
        name: 'Content Syndication',
        platform: 'Various',
        status: 'paused',
        performance: 'underperforming',
        spend: 4200,
        budget: 10000,
        budgetRemaining: 5800,
        impressions: 67000,
        clicks: 890,
        conversions: 8,
      },
    ],
    summary: {
      live: 3,
      paused: 1,
      scheduled: 1,
      totalSpend: 30300,
      totalBudget: 78000,
    },
  };

  const statusStyles: Record<CampaignStatus, string> = {
    live: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    ended: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  };

  const performanceIcons: Record<string, { icon: typeof TrendingUp; color: string }> = {
    exceeding: { icon: TrendingUp, color: 'text-green-600' },
    'on-track': { icon: TrendingUp, color: 'text-blue-600' },
    underperforming: { icon: TrendingDown, color: 'text-red-600' },
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Megaphone className="h-4 w-4 text-orange-600" />
            Active Campaigns
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Badge className="gap-1" variant="outline">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {mockData.summary.live} Live
            </Badge>
            <Badge className="gap-1" variant="outline">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {mockData.summary.paused} Paused
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Campaigns List */}
        {mockData.campaigns.map((campaign) => {
          const PerfIcon = performanceIcons[campaign.performance]?.icon || TrendingUp;
          const perfColor = performanceIcons[campaign.performance]?.color || 'text-gray-500';
          const budgetUsedPercent = (campaign.spend / campaign.budget) * 100;

          return (
            <div
              key={campaign.id}
              className="hover:bg-muted/50 cursor-pointer rounded-lg border p-3 transition-colors"
              onClick={() => onCampaignClick?.(campaign.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium">{campaign.name}</h4>
                    <Badge className={`${statusStyles[campaign.status]} text-xs`}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">{campaign.platform}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PerfIcon className={`h-4 w-4 ${perfColor}`} />
                  {campaign.status === 'live' && onTogglePause && (
                    <Button
                      className="h-6 w-6"
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePause(campaign.id, true);
                      }}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  )}
                  {campaign.status === 'paused' && onTogglePause && (
                    <Button
                      className="h-6 w-6"
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePause(campaign.id, false);
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Budget Bar */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {formatCurrency(campaign.spend)} / {formatCurrency(campaign.budget)}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(campaign.budgetRemaining)} remaining
                  </span>
                </div>
                <div className="bg-muted h-1.5 rounded-full">
                  <div
                    className={`h-full rounded-full ${
                      budgetUsedPercent > 90
                        ? 'bg-red-500'
                        : budgetUsedPercent > 70
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Quick Stats */}
              {campaign.status !== 'scheduled' && campaign.status !== 'draft' && (
                <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                  <span>{formatNumber(campaign.impressions)} impr</span>
                  <span>{formatNumber(campaign.clicks)} clicks</span>
                  <span className="text-foreground font-medium">{campaign.conversions} conv</span>
                </div>
              )}

              {campaign.endDate && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Ends: {new Date(campaign.endDate).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}

        {/* Summary Footer */}
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <div className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            <span>Total Spend</span>
          </div>
          <span className="font-medium">
            {formatCurrency(mockData.summary.totalSpend)} /{' '}
            {formatCurrency(mockData.summary.totalBudget)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActiveCampaignsWidget;
