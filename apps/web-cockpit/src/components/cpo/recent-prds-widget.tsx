'use client';

/**
 * Recent PRDs Widget for CPO Dashboard
 * Displays recently created or updated PRDs
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit,
  Eye,
  Users,
  ChevronRight,
} from 'lucide-react';

interface PRDItem {
  id: string;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  version: string;
  author: string;
  updatedAt: string;
  commentCount?: number;
  reviewerCount?: number;
}

interface RecentPRDsWidgetProps {
  engagementId: string;
  data?: {
    prds: PRDItem[];
    summary: {
      total: number;
      drafts: number;
      inReview: number;
      approved: number;
    };
  };
  className?: string;
}

// Demo data
const demoData = {
  prds: [
    {
      id: '1',
      title: 'AI-Powered Recommendations',
      status: 'in_review' as const,
      version: 'v2.1',
      author: 'Sarah Chen',
      updatedAt: '2025-01-07T09:30:00Z',
      commentCount: 8,
      reviewerCount: 3,
    },
    {
      id: '2',
      title: 'Enterprise SSO Integration',
      status: 'approved' as const,
      version: 'v1.0',
      author: 'Mike Johnson',
      updatedAt: '2025-01-06T14:15:00Z',
      commentCount: 12,
      reviewerCount: 4,
    },
    {
      id: '3',
      title: 'Mobile App Redesign',
      status: 'draft' as const,
      version: 'v0.3',
      author: 'Emily Davis',
      updatedAt: '2025-01-05T16:45:00Z',
      commentCount: 3,
      reviewerCount: 0,
    },
    {
      id: '4',
      title: 'API Rate Limiting',
      status: 'draft' as const,
      version: 'v0.1',
      author: 'Alex Kumar',
      updatedAt: '2025-01-04T11:20:00Z',
      commentCount: 1,
      reviewerCount: 0,
    },
  ],
  summary: {
    total: 24,
    drafts: 8,
    inReview: 5,
    approved: 11,
  },
};

const statusConfig = {
  draft: {
    icon: Edit,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    label: 'Draft',
  },
  in_review: {
    icon: Eye,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    label: 'In Review',
  },
  approved: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Approved',
  },
  archived: {
    icon: AlertCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-50',
    label: 'Archived',
  },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentPRDsWidget({
  engagementId,
  data = demoData,
  className,
}: RecentPRDsWidgetProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <FileText className="h-4 w-4" />
          Recent PRDs
        </CardTitle>
        <button className="text-xs text-blue-600 hover:underline">+ New PRD</button>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{data.summary.drafts}</div>
            <div className="text-xs text-gray-500">Drafts</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-600">{data.summary.inReview}</div>
            <div className="text-xs text-gray-500">In Review</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{data.summary.approved}</div>
            <div className="text-xs text-gray-500">Approved</div>
          </div>
        </div>

        {/* PRD List */}
        <div className="space-y-2">
          {data.prds.map((prd) => {
            const status = statusConfig[prd.status];
            const StatusIcon = status.icon;

            return (
              <div
                key={prd.id}
                className="group flex items-center justify-between rounded-lg border p-2 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('rounded-full p-1.5', status.bg)}>
                    <StatusIcon className={cn('h-3.5 w-3.5', status.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{prd.title}</span>
                      <span className="text-muted-foreground text-xs">{prd.version}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{prd.author}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(prd.updatedAt)}
                      </span>
                      {prd.commentCount !== undefined && prd.commentCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{prd.commentCount} comments</span>
                        </>
                      )}
                      {prd.reviewerCount !== undefined && prd.reviewerCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {prd.reviewerCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
              </div>
            );
          })}
        </div>

        {/* View All Link */}
        <div className="mt-3 text-center">
          <button className="text-sm text-blue-600 hover:underline">
            View all {data.summary.total} PRDs →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
