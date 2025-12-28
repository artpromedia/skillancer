/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Activity Feed Component
 *
 * Real-time activity feed showing recent events with WebSocket updates.
 *
 * @module components/dashboard/activity-feed
 */

import {
  Clock,
  FileText,
  DollarSign,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  UserPlus,
  Briefcase,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ActivityType =
  | 'time_entry'
  | 'invoice_created'
  | 'invoice_paid'
  | 'payment_received'
  | 'project_created'
  | 'project_completed'
  | 'client_added'
  | 'task_completed'
  | 'expense_logged'
  | 'comment_added';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  link?: string;
  metadata?: {
    amount?: number;
    projectName?: string;
    clientName?: string;
    duration?: string;
  };
}

export interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
  maxItems?: number;
  onRefresh?: () => void;
}

// ============================================================================
// Activity Icon Mapping
// ============================================================================

const activityIcons: Record<ActivityType, { icon: typeof Clock; color: string }> = {
  time_entry: { icon: Clock, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
  invoice_created: { icon: FileText, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' },
  invoice_paid: { icon: CheckCircle, color: 'text-green-500 bg-green-50 dark:bg-green-900/30' },
  payment_received: { icon: DollarSign, color: 'text-green-500 bg-green-50 dark:bg-green-900/30' },
  project_created: { icon: Briefcase, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' },
  project_completed: {
    icon: CheckCircle,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30',
  },
  client_added: { icon: UserPlus, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/30' },
  task_completed: { icon: CheckCircle, color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/30' },
  expense_logged: { icon: CreditCard, color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30' },
  comment_added: { icon: MessageSquare, color: 'text-gray-500 bg-gray-50 dark:bg-gray-700' },
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Activity Item Component
// ============================================================================

function ActivityItemRow({ activity }: Readonly<{ activity: ActivityItem }>) {
  const iconConfig = activityIcons[activity.type] || activityIcons.time_entry;
  const Icon = iconConfig.icon;

  const content = (
    <div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <div className={`rounded-lg p-2 ${iconConfig.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
        {activity.description && (
          <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
            {activity.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{formatRelativeTime(activity.timestamp)}</span>
          {activity.metadata?.projectName && (
            <>
              <span>•</span>
              <span>{activity.metadata.projectName}</span>
            </>
          )}
          {activity.metadata?.amount && (
            <>
              <span>•</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(activity.metadata.amount)}
              </span>
            </>
          )}
          {activity.metadata?.duration && (
            <>
              <span>•</span>
              <span>{activity.metadata.duration}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (activity.link) {
    return <Link href={activity.link}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-700">
        <Clock className="h-6 w-6 text-gray-400" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No recent activity</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your recent actions will appear here
      </p>
    </div>
  );
}

// ============================================================================
// Activity Feed Component
// ============================================================================

export function ActivityFeed({
  activities = [],
  isLoading = false,
  maxItems = 10,
  onRefresh,
}: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        {onRefresh && (
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Refresh"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {[1, 2, 3, 4, 5].map((i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        ) : displayedActivities.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayedActivities.map((activity) => (
              <ActivityItemRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {activities.length > maxItems && (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <Link
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            href="/activity"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default ActivityFeed;
