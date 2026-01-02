'use client';

import { AlertOctagon, ExternalLink, MessageSquare, ArrowRight } from 'lucide-react';

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';

interface BlockedItem {
  id: string;
  title: string;
  source: 'asana' | 'monday' | 'linear' | 'jira' | 'internal';
  sourceUrl?: string;
  blockedSince: string;
  blockedReason?: string;
  project: string;
  owner: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  suggestedAction?: string;
}

interface BlockedItemsWidgetProps {
  engagementId: string;
  data?: {
    blockedItems: BlockedItem[];
    criticalCount: number;
    averageBlockedDays: number;
  };
  isLoading?: boolean;
  onResolve?: (itemId: string) => void;
  onViewAll?: () => void;
}

const impactStyles: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-gray-400 text-white',
};

const sourceIcons: Record<string, string> = {
  asana: '📋',
  monday: '📊',
  linear: '⚡',
  jira: '🎯',
  internal: '🏢',
};

export function BlockedItemsWidget({
  engagementId,
  data,
  isLoading,
  onResolve,
  onViewAll,
}: BlockedItemsWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="h-5 w-5 text-red-500" />
            Blocked Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded bg-gray-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const blockedItems = data?.blockedItems || [];
  const criticalCount = data?.criticalCount || 0;
  const averageBlockedDays = data?.averageBlockedDays || 0;

  const getDaysBlocked = (blockedSince: string) => {
    const now = new Date();
    const blocked = new Date(blockedSince);
    return Math.ceil((now.getTime() - blocked.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="h-5 w-5 text-red-500" />
            Blocked Items
          </CardTitle>
          {blockedItems.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onViewAll}>
              View All
            </Button>
          )}
        </div>
        {blockedItems.length > 0 && (
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            {criticalCount > 0 && (
              <span className="font-medium text-red-600">{criticalCount} critical</span>
            )}
            <span>Avg {averageBlockedDays} days blocked</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {blockedItems.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <AlertOctagon className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-medium text-green-600">No Blockers!</p>
            <p className="text-muted-foreground mt-1 text-xs">All items are flowing smoothly</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedItems.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-3">
                  <span className="text-lg">{sourceIcons[item.source]}</span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <Badge className={impactStyles[item.impact]}>{item.impact}</Badge>
                    </div>

                    <div className="text-muted-foreground mt-1 text-xs">
                      {item.project} • {item.owner} • {getDaysBlocked(item.blockedSince)} days
                      blocked
                    </div>

                    {item.blockedReason && (
                      <div className="mt-2 flex items-start gap-1 text-sm text-red-700">
                        <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0" />
                        <span>{item.blockedReason}</span>
                      </div>
                    )}

                    {item.suggestedAction && (
                      <div className="mt-2 flex items-center gap-2">
                        <ArrowRight className="h-3 w-3 text-blue-600" />
                        <span className="text-xs text-blue-600">{item.suggestedAction}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {item.sourceUrl && (
                      <Button
                        className="h-8 w-8"
                        size="icon"
                        variant="ghost"
                        onClick={() => window.open(item.sourceUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onResolve?.(item.id)}>
                      Resolve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {blockedItems.length > 4 && (
          <Button className="mt-2 w-full" variant="link" onClick={onViewAll}>
            View {blockedItems.length - 4} more blocked items
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
