'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BellDot,
  Check,
  CheckCheck,
  MessageSquare,
  FileText,
  DollarSign,
  Shield,
  Users,
  Star,
  AlertTriangle,
  Settings,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';

import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export type NotificationType =
  | 'message'
  | 'proposal'
  | 'payment'
  | 'contract'
  | 'milestone'
  | 'review'
  | 'security'
  | 'invite'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  link?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  actionButtons?: Array<{ action: string; title: string }>;
}

export interface NotificationCenterProps {
  notifications?: Notification[];
  unreadCount?: number;
  isLoading?: boolean;
  onFetch?: () => void;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onDelete?: (id: string) => void;
  onAction?: (notificationId: string, action: string) => void;
  className?: string;
  maxDropdownItems?: number;
}

// =============================================================================
// Component
// =============================================================================

export function NotificationCenter({
  notifications = [],
  unreadCount = 0,
  isLoading = false,
  onFetch,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onAction,
  className,
  maxDropdownItems = 5,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && onFetch) onFetch();
  }, [isOpen, onFetch]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const displayNotifications = notifications.slice(0, maxDropdownItems);
  const hasMore = notifications.length > maxDropdownItems;

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className={cn(
          'relative rounded-lg p-2 transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          isOpen && 'bg-gray-100 dark:bg-gray-800'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {unreadCount > 0 ? (
          <BellDot className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        ) : (
          <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)]',
            'rounded-xl bg-white shadow-xl dark:bg-gray-900',
            'z-50 overflow-hidden border border-gray-200 dark:border-gray-700'
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && onMarkAllRead && (
                <button
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  onClick={onMarkAllRead}
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <Link
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                href="/settings/notifications"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : displayNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="mb-2 h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onAction={onAction}
                    onClose={() => setIsOpen(false)}
                    onDelete={onDelete}
                    onMarkRead={onMarkRead}
                  />
                ))}
              </ul>
            )}
          </div>

          {(hasMore || notifications.length > 0) && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <Link
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-800/50"
                href="/notifications"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAction?: (notificationId: string, action: string) => void;
  onClose: () => void;
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onAction,
  onClose,
}: NotificationItemProps) {
  const Icon = getNotificationIcon(notification.type);
  const iconColor = getNotificationIconColor(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  const handleClick = () => {
    if (!notification.read && onMarkRead) onMarkRead(notification.id);
    if (notification.link) onClose();
  };

  const content = (
    <li
      className={cn(
        'relative cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
        !notification.read && 'bg-blue-50/50 dark:bg-blue-900/10'
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
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
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm font-medium text-gray-900 dark:text-gray-100',
                !notification.read && 'font-semibold'
              )}
            >
              {notification.title}
            </p>
            <div className="flex flex-shrink-0 items-center gap-1">
              {!notification.read && onMarkRead && (
                <button
                  className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Mark as read"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification.id);
                  }}
                >
                  <Check className="h-3 w-3 text-gray-400" />
                </button>
              )}
              {onDelete && (
                <button
                  className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {notification.body}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{timeAgo}</p>
          {notification.actionButtons && notification.actionButtons.length > 0 && (
            <div className="mt-2 flex gap-2">
              {notification.actionButtons.map((button) => (
                <button
                  key={button.action}
                  className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.(notification.id, button.action);
                  }}
                >
                  {button.title}
                </button>
              ))}
            </div>
          )}
        </div>
        {!notification.read && (
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    </li>
  );

  return notification.link ? (
    <Link className="block" href={notification.link}>
      {content}
    </Link>
  ) : (
    content
  );
}

// =============================================================================
// Helpers
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
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface UseNotificationsOptions {
  apiUrl?: string;
  pollInterval?: number;
  fetchOnMount?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { apiUrl = '/api/notifications', pollInterval = 30000, fetchOnMount = true } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`${apiUrl}/${id}/read`, { method: 'POST' });
        if (response.ok) {
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    },
    [apiUrl]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/read-all`, { method: 'POST' });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [apiUrl]);

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`${apiUrl}/${id}`, { method: 'DELETE' });
        if (response.ok) {
          const notification = notifications.find((n) => n.id === id);
          setNotifications((prev) => prev.filter((n) => n.id !== id));
          if (notification && !notification.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      } catch (err) {
        console.error('Failed to delete notification:', err);
      }
    },
    [apiUrl, notifications]
  );

  const handleAction = useCallback(
    async (notificationId: string, action: string) => {
      try {
        await fetch(`${apiUrl}/${notificationId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        await fetchNotifications();
      } catch (err) {
        console.error('Failed to perform notification action:', err);
      }
    },
    [apiUrl, fetchNotifications]
  );

  useEffect(() => {
    if (fetchOnMount) fetchNotifications();
  }, [fetchOnMount, fetchNotifications]);

  useEffect(() => {
    if (pollInterval > 0) {
      const interval = setInterval(fetchNotifications, pollInterval);
      return () => clearInterval(interval);
    }
  }, [pollInterval, fetchNotifications]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
    if (!notification.read) setUnreadCount((prev) => prev + 1);
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    handleAction,
    addNotification,
  };
}

export default NotificationCenter;
