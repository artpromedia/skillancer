'use client';

import { formatDistanceToNow, format } from 'date-fns';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Filter,
  Search,
  Trash2,
  Settings,
  MessageSquare,
  FileText,
  DollarSign,
  Shield,
  Users,
  Star,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback, useMemo } from 'react';

import {
  useNotifications,
  type Notification,
  type NotificationType,
} from '@/components/notifications';
import { PushPermission } from '@/components/notifications';

import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

type FilterType = 'all' | 'unread' | NotificationType;

interface FilterOption {
  value: FilterType;
  label: string;
  icon?: React.ElementType;
}

// =============================================================================
// Constants
// =============================================================================

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'message', label: 'Messages', icon: MessageSquare },
  { value: 'proposal', label: 'Proposals', icon: FileText },
  { value: 'payment', label: 'Payments', icon: DollarSign },
  { value: 'contract', label: 'Contracts', icon: FileText },
  { value: 'milestone', label: 'Milestones', icon: Check },
  { value: 'review', label: 'Reviews', icon: Star },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'invite', label: 'Invites', icon: Users },
  { value: 'system', label: 'System', icon: AlertTriangle },
];

const ITEMS_PER_PAGE = 20;

// =============================================================================
// Component
// =============================================================================

export function NotificationsPageClient() {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    handleAction,
  } = useNotifications({
    pollInterval: 60000, // Poll every minute on this page
    fetchOnMount: true,
  });

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    // Apply type/status filter
    if (filter === 'unread') {
      result = result.filter((n) => !n.read);
    } else if (filter !== 'all') {
      result = result.filter((n) => n.type === filter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query)
      );
    }

    return result;
  }, [notifications, filter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNotifications.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNotifications, currentPage]);

  // Reset page when filter changes
  const handleFilterChange = useCallback((newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, []);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === paginatedNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedNotifications.map((n) => n.id)));
    }
  }, [paginatedNotifications, selectedIds.size]);

  // Bulk actions
  const handleBulkMarkRead = useCallback(() => {
    selectedIds.forEach((id) => markAsRead(id));
    setSelectedIds(new Set());
  }, [selectedIds, markAsRead]);

  const handleBulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteNotification(id));
    setSelectedIds(new Set());
  }, [selectedIds, deleteNotification]);

  const handleRefresh = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Push Permission Banner */}
        <PushPermission
          className="mb-6"
          dismissKey="notifications-page-push-dismissed"
          variant="card"
        />

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={cn(
                'rounded-lg border border-gray-200 p-2 dark:border-gray-700',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors'
              )}
              disabled={isLoading}
              title="Refresh"
              onClick={handleRefresh}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
            {unreadCount > 0 && (
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2',
                  'text-sm font-medium text-blue-600 dark:text-blue-400',
                  'hover:bg-blue-50 dark:hover:bg-blue-900/30',
                  'transition-colors'
                )}
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            )}
            <Link
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2',
                'text-sm font-medium text-gray-600 dark:text-gray-400',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors'
              )}
              href="/settings/notifications"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 p-4 dark:border-gray-700">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className={cn(
                  'w-full rounded-lg py-2 pl-10 pr-10',
                  'border border-gray-200 dark:border-gray-700',
                  'bg-gray-50 dark:bg-gray-800',
                  'text-gray-900 dark:text-gray-100',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'transition-colors'
                )}
                placeholder="Search notifications..."
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = filter === option.value;
                const count =
                  option.value === 'unread'
                    ? unreadCount
                    : option.value === 'all'
                      ? notifications.length
                      : notifications.filter((n) => n.type === option.value).length;

                return (
                  <button
                    key={option.value}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                      'transition-colors',
                      isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    )}
                    onClick={() => handleFilterChange(option.value)}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {option.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          'ml-1 rounded-full px-1.5 py-0.5 text-xs',
                          isActive ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-200 dark:bg-gray-700'
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="border-b border-gray-200 bg-blue-50 px-4 py-3 dark:border-gray-700 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium',
                      'text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/50',
                      'transition-colors'
                    )}
                    onClick={handleBulkMarkRead}
                  >
                    <Check className="h-3 w-3" />
                    Mark as read
                  </button>
                  <button
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium',
                      'text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50',
                      'transition-colors'
                    )}
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification List */}
          <div>
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <AlertTriangle className="mb-3 h-10 w-10 text-red-400" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <button
                  className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                  onClick={handleRefresh}
                >
                  Try again
                </button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                {filter === 'unread' ? (
                  <>
                    <CheckCheck className="mb-3 h-12 w-12 text-green-400" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      All caught up!
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      You&apos;ve read all your notifications
                    </p>
                  </>
                ) : searchQuery ? (
                  <>
                    <Search className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      No results found
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Try adjusting your search or filters
                    </p>
                  </>
                ) : (
                  <>
                    <Bell className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      No notifications
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      When you get notifications, they&apos;ll show up here
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Select All */}
                <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <input
                      checked={
                        selectedIds.size === paginatedNotifications.length &&
                        paginatedNotifications.length > 0
                      }
                      className="rounded border-gray-300 dark:border-gray-600"
                      type="checkbox"
                      onChange={selectAll}
                    />
                    Select all on this page
                  </label>
                </div>

                {/* List */}
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedNotifications.map((notification) => (
                    <NotificationListItem
                      key={notification.id}
                      isSelected={selectedIds.has(notification.id)}
                      notification={notification}
                      onAction={handleAction}
                      onDelete={deleteNotification}
                      onMarkRead={markAsRead}
                      onToggleSelect={toggleSelection}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredNotifications.length)} of{' '}
                {filteredNotifications.length} notifications
              </p>
              <div className="flex items-center gap-2">
                <button
                  className={cn(
                    'rounded-lg border border-gray-200 p-2 dark:border-gray-700',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'transition-colors'
                  )}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[80px] text-center text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className={cn(
                    'rounded-lg border border-gray-200 p-2 dark:border-gray-700',
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'transition-colors'
                  )}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Notification List Item
// =============================================================================

interface NotificationListItemProps {
  notification: Notification;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction: (notificationId: string, action: string) => void;
}

function NotificationListItem({
  notification,
  isSelected,
  onToggleSelect,
  onMarkRead,
  onDelete,
  onAction,
}: NotificationListItemProps) {
  const Icon = getNotificationIcon(notification.type);
  const iconColor = getNotificationIconColor(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
  const formattedDate = format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a');

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  };

  const content = (
    <li
      className={cn(
        'relative px-4 py-4',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        'transition-colors',
        !notification.read && 'bg-blue-50/50 dark:bg-blue-900/10'
      )}
    >
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-0.5">
          <input
            checked={isSelected}
            className="rounded border-gray-300 dark:border-gray-600"
            type="checkbox"
            onChange={() => onToggleSelect(notification.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Icon */}
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
            iconColor
          )}
        >
          {notification.imageUrl ? (
            <img
              alt=""
              className="h-10 w-10 rounded-full object-cover"
              src={notification.imageUrl}
            />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1" onClick={handleClick}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm text-gray-900 dark:text-gray-100',
                  !notification.read && 'font-semibold'
                )}
              >
                {notification.title}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{notification.body}</p>
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500" title={formattedDate}>
                {timeAgo}
              </p>

              {/* Action Buttons */}
              {notification.actionButtons && notification.actionButtons.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {notification.actionButtons.map((button) => (
                    <button
                      key={button.action}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium',
                        'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        'dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                        'transition-colors'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(notification.id, button.action);
                      }}
                    >
                      {button.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-shrink-0 items-center gap-1">
              {!notification.read && (
                <button
                  className={cn(
                    'rounded-lg p-2',
                    'text-gray-400 hover:bg-blue-50 hover:text-blue-600',
                    'dark:hover:bg-blue-900/30 dark:hover:text-blue-400',
                    'transition-colors'
                  )}
                  title="Mark as read"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification.id);
                  }}
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              <button
                className={cn(
                  'rounded-lg p-2',
                  'text-gray-400 hover:bg-red-50 hover:text-red-600',
                  'dark:hover:bg-red-900/30 dark:hover:text-red-400',
                  'transition-colors'
                )}
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    </li>
  );

  if (notification.link) {
    return (
      <Link className="block" href={notification.link}>
        {content}
      </Link>
    );
  }

  return content;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'message':
      return MessageSquare;
    case 'proposal':
      return FileText;
    case 'payment':
      return DollarSign;
    case 'contract':
      return FileText;
    case 'milestone':
      return Check;
    case 'review':
      return Star;
    case 'security':
      return Shield;
    case 'invite':
      return Users;
    case 'system':
    default:
      return AlertTriangle;
  }
}

function getNotificationIconColor(type: NotificationType): string {
  switch (type) {
    case 'message':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    case 'proposal':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
    case 'payment':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    case 'contract':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'milestone':
      return 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400';
    case 'review':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'security':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'invite':
      return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';
    case 'system':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
  }
}
