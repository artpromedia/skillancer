/**
 * User Activity Log Component
 *
 * Timeline of all user actions including login, profile changes,
 * transactions, and interactions.
 *
 * @module components/users/user-activity-log
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LogIn,
  LogOut,
  Edit,
  FileText,
  DollarSign,
  MessageSquare,
  Briefcase,
  CheckCircle,
  XCircle,
  Shield,
  Download,
  Filter,
  Search,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Loader2,
  Key,
  Settings,
  Monitor,
  Lock,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import {
  auditApi,
  type ActivityItem,
  type ActivityType,
  type UserActivityFilters,
} from '../../lib/api/audit';

// ============================================================================
// Types
// ============================================================================

interface UserActivityLogProps {
  userId: string;
}

// ============================================================================
// Constants
// ============================================================================

const ACTIVITY_TYPES: { value: ActivityType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'profile_update', label: 'Profile Updates' },
  { value: 'bid_submitted', label: 'Bids/Proposals' },
  { value: 'contract_created', label: 'Contracts Created' },
  { value: 'contract_completed', label: 'Contracts Completed' },
  { value: 'payment_received', label: 'Payments Received' },
  { value: 'payment_sent', label: 'Payments Sent' },
  { value: 'message_sent', label: 'Messages' },
  { value: 'verification_submitted', label: 'Verifications Submitted' },
  { value: 'verification_approved', label: 'Verifications Approved' },
  { value: 'verification_rejected', label: 'Verifications Rejected' },
  { value: 'support_ticket', label: 'Support Tickets' },
  { value: 'password_change', label: 'Password Changes' },
  { value: 'settings_update', label: 'Settings Updates' },
  { value: 'api_key_created', label: 'API Key Created' },
  { value: 'api_key_revoked', label: 'API Key Revoked' },
  { value: 'session_terminated', label: 'Session Terminated' },
  { value: 'mfa_enabled', label: 'MFA Enabled' },
  { value: 'mfa_disabled', label: 'MFA Disabled' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ============================================================================
// Helper Functions
// ============================================================================

function getActivityIcon(type: ActivityType) {
  const icons: Record<ActivityType, typeof LogIn> = {
    login: LogIn,
    logout: LogOut,
    profile_update: Edit,
    bid_submitted: FileText,
    contract_created: Briefcase,
    contract_completed: CheckCircle,
    payment_received: DollarSign,
    payment_sent: DollarSign,
    message_sent: MessageSquare,
    verification_submitted: Shield,
    verification_approved: CheckCircle,
    verification_rejected: XCircle,
    support_ticket: MessageSquare,
    password_change: Key,
    settings_update: Settings,
    api_key_created: Key,
    api_key_revoked: XCircle,
    session_terminated: Monitor,
    mfa_enabled: Lock,
    mfa_disabled: XCircle,
  };

  return icons[type] || FileText;
}

function getActivityColor(type: ActivityType) {
  const colors: Record<ActivityType, string> = {
    login: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    logout: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    profile_update: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    bid_submitted: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    contract_created: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    contract_completed: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    payment_received:
      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    payment_sent: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    message_sent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    verification_submitted:
      'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    verification_approved: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    verification_rejected: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    support_ticket: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    password_change: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    settings_update: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    api_key_created: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    api_key_revoked: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    session_terminated: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    mfa_enabled: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    mfa_disabled: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return colors[type] || 'bg-gray-100 text-gray-600';
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    relative: getRelativeTime(date),
  };
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ActivitySkeleton() {
  return (
    <div className="animate-pulse border-b border-gray-200 p-4 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="mt-2 h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error Display
// ============================================================================

interface ErrorDisplayProps {
  readonly error: Error;
  readonly onRetry: () => void;
}

function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-900/30 dark:bg-red-900/10">
      <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
      <h3 className="mb-2 text-lg font-medium text-red-900 dark:text-red-200">
        Failed to load activity
      </h3>
      <p className="mb-4 text-center text-sm text-red-600 dark:text-red-300">{error.message}</p>
      <button
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ hasFilters }: Readonly<{ hasFilters: boolean }>) {
  return (
    <div className="py-12 text-center">
      <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
        {hasFilters ? 'No activity found' : 'No activity yet'}
      </h3>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        {hasFilters
          ? 'Try adjusting your search or filters'
          : "This user hasn't performed any tracked actions yet"}
      </p>
    </div>
  );
}

// ============================================================================
// Activity Item Component
// ============================================================================

function ActivityItemRow({
  activity,
  isExpanded,
  onToggle,
}: Readonly<{
  activity: ActivityItem;
  isExpanded: boolean;
  onToggle: () => void;
}>) {
  const Icon = getActivityIcon(activity.type);
  const colorClass = getActivityColor(activity.type);
  const { date, time, relative } = formatTimestamp(activity.timestamp);

  return (
    <div className="border-b border-gray-200 last:border-0 dark:border-gray-700">
      <button
        className="flex w-full items-start gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onToggle}
      >
        {/* Icon */}
        <div className={`rounded-full p-2 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
            <span className="text-sm text-gray-500" title={`${date} ${time}`}>
              {relative}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
        </div>

        {/* Expand Arrow */}
        {(activity.metadata || activity.ipAddress) && (
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Expanded Details */}
      {isExpanded && (activity.metadata || activity.ipAddress) && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {activity.ipAddress && (
              <div>
                <span className="text-gray-500">IP Address:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-white">
                  {activity.ipAddress}
                </span>
              </div>
            )}
            {activity.location && (
              <div>
                <span className="text-gray-500">Location:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{activity.location}</span>
              </div>
            )}
            {activity.userAgent && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Device:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{activity.userAgent}</span>
              </div>
            )}
            {activity.metadata &&
              Object.entries(activity.metadata).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-500">{key}:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Pagination
// ============================================================================

interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasMore: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (size: number) => void;
}

function Pagination({
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-200 px-4 py-3 sm:flex-row dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>
          Showing {start}-{end} of {total}
        </span>
        <span className="hidden sm:inline">•</span>
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">Rows per page:</span>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Page {page} of {totalPages || 1}
        </span>
        <button
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
          disabled={!hasMore && page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserActivityLog({ userId }: Readonly<UserActivityLogProps>) {
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ActivityType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Build filters for API
  const filters: UserActivityFilters = {
    page,
    pageSize,
    ...(filterType && { eventType: filterType }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  // Fetch activity data
  const {
    data: response,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['userActivity', userId, filters],
    queryFn: () => auditApi.getUserActivityLog(userId, filters),
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'json' | 'pdf') => {
      const result = await auditApi.exportActivityLog({
        filters: {
          ...filters,
          actorId: userId,
        },
        format,
      });
      return result;
    },
  });

  // Handle export
  const handleExport = useCallback(
    async (format: 'csv' | 'json' | 'pdf' = 'csv') => {
      const confirm = globalThis.confirm(
        `Export activity log as ${format.toUpperCase()}? This may take a moment for large datasets.`
      );
      if (!confirm) return;

      try {
        const result = await exportMutation.mutateAsync(format);
        if (result.success && result.data.id) {
          // Poll for export completion
          alert(`Export started. You will be notified when it's ready for download.`);
        } else {
          alert(`Export failed: ${result.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Export failed:', err);
        alert('Failed to start export. Please try again.');
      }
    },
    [exportMutation]
  );

  // Handle page size change
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['userActivity', userId] });
  }, [queryClient, userId]);

  // Filter activities client-side by search query
  const activities = response?.data?.activities || [];
  const filteredActivities = searchQuery
    ? activities.filter(
        (activity) =>
          activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activities;

  const total = response?.data?.total || 0;
  const hasMore = response?.data?.hasMore || false;
  const hasFilters = Boolean(searchQuery || filterType || startDate || endDate);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h3>
          {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-2">
          <button className="admin-btn-secondary" disabled={isLoading} onClick={handleRefresh}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            className="admin-btn-secondary"
            disabled={isLoading || exportMutation.isPending}
            onClick={() => void handleExport('csv')}
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="admin-input pl-10"
              placeholder="Search activity..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Toggle */}
          <button
            className={`admin-btn-secondary ${showFilters ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasFilters && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                {[filterType, startDate, endDate].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-800/50">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Activity Type
              </label>
              <select
                className="admin-input"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as ActivityType | '');
                  setPage(1);
                }}
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                From Date
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  className="admin-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                To Date
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  className="admin-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            {hasFilters && (
              <div className="flex items-end sm:col-span-3">
                <button
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  onClick={() => {
                    setFilterType('');
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {error ? (
          <ErrorDisplay error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <>
            {Array.from({ length: 5 }, (_, i) => (
              <ActivitySkeleton key={`skeleton-${i}`} />
            ))}
          </>
        ) : filteredActivities.length > 0 ? (
          <>
            {filteredActivities.map((activity) => (
              <ActivityItemRow
                key={activity.id}
                activity={activity}
                isExpanded={expandedId === activity.id}
                onToggle={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
              />
            ))}
            <Pagination
              hasMore={hasMore}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        ) : (
          <EmptyState hasFilters={hasFilters} />
        )}
      </div>
    </div>
  );
}

export default UserActivityLog;
