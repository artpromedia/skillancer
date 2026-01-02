'use client';

/**
 * Research Insights Widget for CPO Dashboard
 * Displays insights from user research platforms
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import {
  Search,
  Lightbulb,
  Users,
  MessageCircle,
  Video,
  FileText,
  Tag,
  ChevronRight,
} from 'lucide-react';

interface ResearchInsight {
  id: string;
  title: string;
  source: 'dovetail' | 'usertesting' | 'hotjar' | 'fullstory' | 'other';
  type: 'insight' | 'interview' | 'survey' | 'session' | 'feedback';
  participants?: number;
  tags?: string[];
  createdAt: string;
  summary?: string;
}

interface ResearchInsightsWidgetProps {
  engagementId: string;
  data?: {
    insights: ResearchInsight[];
    summary: {
      totalInsights: number;
      totalParticipants: number;
      recentStudies: number;
    };
  };
  className?: string;
}

// Demo data
const demoData = {
  insights: [
    {
      id: '1',
      title: 'Users struggle with advanced filters',
      source: 'dovetail' as const,
      type: 'insight' as const,
      participants: 12,
      tags: ['Search', 'UX', 'Pain Point'],
      createdAt: '2025-01-06T14:30:00Z',
      summary:
        'Users find the advanced filter interface confusing and often resort to basic search.',
    },
    {
      id: '2',
      title: 'Mobile onboarding usability test',
      source: 'usertesting' as const,
      type: 'session' as const,
      participants: 8,
      tags: ['Mobile', 'Onboarding'],
      createdAt: '2025-01-05T10:00:00Z',
    },
    {
      id: '3',
      title: 'Q4 NPS Survey Results',
      source: 'dovetail' as const,
      type: 'survey' as const,
      participants: 1250,
      tags: ['NPS', 'Satisfaction'],
      createdAt: '2025-01-03T09:00:00Z',
    },
    {
      id: '4',
      title: 'Enterprise customer interviews',
      source: 'dovetail' as const,
      type: 'interview' as const,
      participants: 5,
      tags: ['Enterprise', 'Pricing'],
      createdAt: '2025-01-02T16:00:00Z',
    },
  ],
  summary: {
    totalInsights: 47,
    totalParticipants: 1892,
    recentStudies: 12,
  },
};

const sourceConfig = {
  dovetail: { color: 'bg-purple-500', label: 'Dovetail' },
  usertesting: { color: 'bg-green-500', label: 'UserTesting' },
  hotjar: { color: 'bg-red-500', label: 'Hotjar' },
  fullstory: { color: 'bg-blue-500', label: 'FullStory' },
  other: { color: 'bg-gray-500', label: 'Other' },
};

const typeIcons = {
  insight: Lightbulb,
  interview: MessageCircle,
  survey: FileText,
  session: Video,
  feedback: MessageCircle,
};

function InsightCard({ insight }: { insight: ResearchInsight }) {
  const sourceInfo = sourceConfig[insight.source];
  const TypeIcon = typeIcons[insight.type] || Lightbulb;
  const date = new Date(insight.createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="group rounded-lg border p-3 transition-colors hover:bg-gray-50">
      <div className="flex items-start gap-3">
        <div className={cn('rounded-full p-1.5', sourceInfo.color, 'bg-opacity-20')}>
          <TypeIcon className="h-4 w-4 text-gray-700" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-tight">{insight.title}</h4>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
          </div>
          {insight.summary && (
            <p className="line-clamp-2 text-xs text-gray-500">{insight.summary}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={cn('h-2 w-2 rounded-full', sourceInfo.color)} />
            <span>{sourceInfo.label}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {insight.participants}
            </span>
            <span>•</span>
            <span>{formattedDate}</span>
          </div>
          {insight.tags && insight.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {insight.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
              {insight.tags.length > 3 && (
                <span className="px-1 text-xs text-gray-400">+{insight.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResearchInsightsWidget({
  engagementId,
  data = demoData,
  className,
}: ResearchInsightsWidgetProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Search className="h-4 w-4" />
          Research Insights
        </CardTitle>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-bold">{data.summary.totalInsights}</div>
            <div className="text-muted-foreground text-xs">Insights</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{data.summary.recentStudies}</div>
            <div className="text-muted-foreground text-xs">Studies</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>

        <div className="mt-3 text-center">
          <button className="text-sm text-blue-600 hover:underline">View all insights →</button>
        </div>
      </CardContent>
    </Card>
  );
}
