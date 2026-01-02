'use client';

/**
 * User Feedback Widget for CPO Dashboard
 * Displays aggregated user feedback from various sources
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import { MessageSquare, ThumbsUp, ThumbsDown, Minus, TrendingUp, TrendingDown } from 'lucide-react';

interface FeedbackItem {
  id: string;
  source: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  count: number;
  trend?: number;
}

interface UserFeedbackWidgetProps {
  engagementId: string;
  data?: {
    items: FeedbackItem[];
    summary: {
      positive: number;
      negative: number;
      neutral: number;
      nps: number;
      npsTrend: number;
    };
  };
  className?: string;
}

// Demo data
const demoData = {
  items: [
    {
      id: '1',
      source: 'In-App Survey',
      summary: 'Love the new AI features',
      sentiment: 'positive' as const,
      count: 234,
      trend: 12,
    },
    {
      id: '2',
      source: 'Intercom',
      summary: 'Loading times are slow',
      sentiment: 'negative' as const,
      count: 89,
      trend: -5,
    },
    {
      id: '3',
      source: 'UserTesting',
      summary: 'Navigation could be clearer',
      sentiment: 'neutral' as const,
      count: 45,
      trend: 3,
    },
    {
      id: '4',
      source: 'App Store',
      summary: 'Great productivity app',
      sentiment: 'positive' as const,
      count: 156,
      trend: 8,
    },
  ],
  summary: {
    positive: 65,
    negative: 18,
    neutral: 17,
    nps: 42,
    npsTrend: 5,
  },
};

const sentimentConfig = {
  positive: {
    icon: ThumbsUp,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  negative: {
    icon: ThumbsDown,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  neutral: {
    icon: Minus,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
};

function SentimentBar({
  positive,
  negative,
  neutral,
}: {
  positive: number;
  negative: number;
  neutral: number;
}) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      <div
        className="bg-green-500"
        style={{ width: `${positive}%` }}
        title={`Positive: ${positive}%`}
      />
      <div
        className="bg-gray-400"
        style={{ width: `${neutral}%` }}
        title={`Neutral: ${neutral}%`}
      />
      <div
        className="bg-red-500"
        style={{ width: `${negative}%` }}
        title={`Negative: ${negative}%`}
      />
    </div>
  );
}

function NPSGauge({ score, trend }: { score: number; trend: number }) {
  const getColor = (nps: number) => {
    if (nps >= 50) return 'text-green-600';
    if (nps >= 0) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn('text-2xl font-bold', getColor(score))}>{score}</div>
      <div className="text-left">
        <div className="text-muted-foreground text-xs">NPS</div>
        <div
          className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend >= 0 ? '+' : ''}
          {trend}
        </div>
      </div>
    </div>
  );
}

export function UserFeedbackWidget({
  engagementId,
  data = demoData,
  className,
}: UserFeedbackWidgetProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <MessageSquare className="h-4 w-4" />
          User Feedback
        </CardTitle>
        <NPSGauge score={data.summary.nps} trend={data.summary.npsTrend} />
      </CardHeader>
      <CardContent>
        {/* Sentiment Overview */}
        <div className="mb-4 space-y-2">
          <SentimentBar
            negative={data.summary.negative}
            neutral={data.summary.neutral}
            positive={data.summary.positive}
          />
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <ThumbsUp className="h-3 w-3" />
              {data.summary.positive}%
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <Minus className="h-3 w-3" />
              {data.summary.neutral}%
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <ThumbsDown className="h-3 w-3" />
              {data.summary.negative}%
            </span>
          </div>
        </div>

        {/* Feedback Items */}
        <div className="space-y-2">
          {data.items.map((item) => {
            const config = sentimentConfig[item.sentiment];
            const SentimentIcon = config.icon;

            return (
              <div key={item.id} className={cn('rounded-lg border p-2', config.bg, config.border)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <SentimentIcon className={cn('mt-0.5 h-4 w-4 shrink-0', config.color)} />
                    <div>
                      <p className="text-sm">{item.summary}</p>
                      <p className="text-muted-foreground text-xs">{item.source}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{item.count}</div>
                    {item.trend !== undefined && (
                      <div
                        className={cn(
                          'flex items-center justify-end gap-0.5 text-xs',
                          item.trend >= 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {item.trend >= 0 ? (
                          <TrendingUp className="h-2.5 w-2.5" />
                        ) : (
                          <TrendingDown className="h-2.5 w-2.5" />
                        )}
                        {item.trend >= 0 ? '+' : ''}
                        {item.trend}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
