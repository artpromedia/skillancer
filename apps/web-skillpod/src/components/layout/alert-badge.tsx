/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
/**
 * Alert Badge Component
 *
 * Navigation badge showing active security alerts count with
 * severity-based coloring and real-time updates.
 *
 * @module components/layout/alert-badge
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AlertBadgeProps {
  className?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

interface AlertCounts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// ============================================================================
// Icons
// ============================================================================

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function BellAlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AlertBadge({ className = '', showLabel = false, onClick }: AlertBadgeProps) {
  const [counts, setCounts] = useState<AlertCounts>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousTotal, setPreviousTotal] = useState(0);

  // Fetch alert counts
  const fetchAlertCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/alerts/counts');
      if (response.ok) {
        const data = await response.json();
        setCounts(data);

        // Trigger animation if count increased
        if (data.total > previousTotal && previousTotal > 0) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 1000);
        }
        setPreviousTotal(data.total);
      }
    } catch (error) {
      // Silently fail - alerts may not be available
    }
  }, [previousTotal]);

  // Initial fetch and polling
  useEffect(() => {
    fetchAlertCounts();
    const interval = setInterval(fetchAlertCounts, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchAlertCounts]);

  // Listen for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/alerts/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'alert_count_update') {
          setCounts(data.counts);
          if (data.counts.total > previousTotal) {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 1000);
          }
          setPreviousTotal(data.counts.total);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    return () => eventSource.close();
  }, [previousTotal]);

  // Determine badge color based on severity
  const getBadgeColor = () => {
    if (counts.critical > 0) return 'bg-red-500';
    if (counts.high > 0) return 'bg-orange-500';
    if (counts.medium > 0) return 'bg-yellow-500';
    if (counts.low > 0) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  // Determine icon color
  const getIconColor = () => {
    if (counts.critical > 0) return 'text-red-500';
    if (counts.high > 0) return 'text-orange-500';
    return 'text-gray-500';
  };

  const hasAlerts = counts.total > 0;
  const IconComponent = hasAlerts ? BellAlertIcon : BellIcon;

  return (
    <button
      className={`
        relative inline-flex items-center gap-2 rounded-lg p-2 
        transition-colors hover:bg-gray-100 focus:outline-none
        focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:hover:bg-gray-800
        ${isAnimating ? 'animate-pulse' : ''}
        ${className}
      `}
      title={`${counts.total} active alerts`}
      onClick={onClick}
    >
      <IconComponent className={`h-5 w-5 ${getIconColor()}`} />

      {showLabel && <span className="text-sm text-gray-600 dark:text-gray-300">Alerts</span>}

      {/* Badge */}
      {hasAlerts && (
        <span
          className={`
            absolute -right-1 -top-1 flex h-[18px] min-w-[18px]
            items-center justify-center rounded-full px-1 text-xs font-bold text-white
            ${getBadgeColor()}
            ${isAnimating ? 'scale-125' : 'scale-100'}
            transition-transform duration-200
          `}
        >
          {counts.total > 99 ? '99+' : counts.total}
        </span>
      )}

      {/* Pulse indicator for critical alerts */}
      {counts.critical > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Alert Badge with Dropdown
// ============================================================================

export function AlertBadgeDropdown({ className = '' }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState<
    {
      id: string;
      title: string;
      severity: string;
      timestamp: Date;
    }[]
  >([]);

  useEffect(() => {
    if (isOpen) {
      // Fetch recent alerts when dropdown opens
      fetch('/api/alerts?limit=5&status=active')
        .then((res) => res.json())
        .then((data) => setRecentAlerts(data.alerts || []))
        .catch(() => setRecentAlerts([]));
    }
  }, [isOpen]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <AlertBadge onClick={() => setIsOpen(!isOpen)} />

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Alerts</h3>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {recentAlerts.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No active alerts
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentAlerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="cursor-pointer p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${getSeverityColor(
                            alert.severity
                          )}`}
                        >
                          {alert.severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {alert.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-gray-200 p-2 dark:border-gray-700">
              <a
                className="block w-full rounded px-3 py-2 text-center text-sm text-blue-600 hover:bg-gray-50 hover:text-blue-800 dark:text-blue-400 dark:hover:bg-gray-700 dark:hover:text-blue-300"
                href="/alerts"
              >
                View all alerts →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AlertBadge;
