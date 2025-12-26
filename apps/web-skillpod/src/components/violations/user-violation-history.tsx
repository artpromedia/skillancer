/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * User Violation History Component
 *
 * Shows user's violation history with pattern analysis,
 * risk score trends, and previous actions taken.
 *
 * @module components/violations/user-violation-history
 */

import {
  User,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Shield,
  Activity,
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  joinedAt: Date;
  trustScore: number;
  trustScoreTrend: 'up' | 'down' | 'stable';
  totalViolations: number;
  violationsByType: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  lastViolationAt?: Date;
  previousActions: PreviousAction[];
}

interface PreviousAction {
  id: string;
  violationId: string;
  action: string;
  date: Date;
  resolvedBy: string;
}

interface ViolationHistoryItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'resolved' | 'dismissed' | 'pending';
  timestamp: Date;
  podName: string;
  resolution?: {
    action: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
}

interface UserViolationHistoryProps {
  user: UserProfile;
  currentViolationId: string;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG = {
  critical: {
    color: 'red',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
  },
  high: {
    color: 'orange',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
  },
  medium: {
    color: 'yellow',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  low: {
    color: 'blue',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
};

const ACTION_LABELS: Record<string, string> = {
  dismissed: 'Dismissed',
  warned: 'Warning Issued',
  acknowledged: 'Acknowledged',
  suspended: 'Session Suspended',
  banned: 'User Banned',
  escalated: 'Escalated',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateFull(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getDaysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTimeAgo(date: Date): string {
  const days = getDaysSince(date);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function TrustScoreCard({ user }: { user: UserProfile }) {
  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTrustScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">Trust Score</span>
        <div className="flex items-center gap-1">
          {user.trustScoreTrend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {user.trustScoreTrend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
          {user.trustScoreTrend === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
          <span className="text-xs text-gray-500">
            {user.trustScoreTrend === 'up' && 'Improving'}
            {user.trustScoreTrend === 'down' && 'Declining'}
            {user.trustScoreTrend === 'stable' && 'Stable'}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-4xl font-bold ${getTrustScoreColor(user.trustScore)}`}>
          {user.trustScore}
        </span>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full ${getTrustScoreBg(user.trustScore)} rounded-full transition-all`}
              style={{ width: `${user.trustScore}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViolationTypesChart({ violationsByType }: { violationsByType: Record<string, number> }) {
  const sortedTypes = useMemo(() => {
    return Object.entries(violationsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [violationsByType]);

  const maxCount = Math.max(...sortedTypes.map(([, count]) => count));

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-500">Violation Types</span>
      </div>

      {sortedTypes.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No violations recorded</p>
      ) : (
        <div className="space-y-2">
          {sortedTypes.map(([type, count]) => (
            <div key={type}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate text-gray-700 dark:text-gray-300">
                  {type.replace(/_/g, ' ')}
                </span>
                <span className="text-gray-500">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityDistribution({
  violationsBySeverity,
}: {
  violationsBySeverity: Record<string, number>;
}) {
  const total = Object.values(violationsBySeverity).reduce((a, b) => a + b, 0);

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const sortedSeverities = severityOrder
    .filter((s) => violationsBySeverity[s])
    .map((s) => [s, violationsBySeverity[s]] as [string, number]);

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-500">Severity Distribution</span>
      </div>

      {total === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">No violations recorded</p>
      ) : (
        <>
          {/* Stacked Bar */}
          <div className="mb-3 flex h-4 overflow-hidden rounded-full">
            {sortedSeverities.map(([severity, count]) => {
              const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
              const percentage = (count / total) * 100;
              return (
                <div
                  key={severity}
                  className={`${config.bg} transition-all`}
                  style={{ width: `${percentage}%` }}
                  title={`${severity}: ${count} (${Math.round(percentage)}%)`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {sortedSeverities.map(([severity, count]) => {
              const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
              return (
                <div key={severity} className="flex items-center gap-1">
                  <div className={`h-3 w-3 rounded ${config.bg}`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {severity} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PreviousActionsTimeline({ actions }: { actions: PreviousAction[] }) {
  const [expanded, setExpanded] = useState(true);

  const sortedActions = [...actions].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900">
      <button
        className="flex w-full items-center justify-between p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-500">Previous Actions</span>
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700">
            {actions.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {sortedActions.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No previous actions taken</p>
          ) : (
            <div className="relative">
              <div className="absolute bottom-0 left-3 top-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

              <div className="space-y-3">
                {sortedActions.map((action) => (
                  <div key={action.id} className="relative pl-8">
                    <div className="absolute left-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-300 dark:border-gray-900 dark:bg-gray-600" />
                    <div className="text-sm">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {ACTION_LABELS[action.action] || action.action}
                        </span>
                        <span className="text-xs text-gray-500">{getTimeAgo(action.date)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Violation #{action.violationId.slice(-8)} · By {action.resolvedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViolationHistoryList({
  violations,
  currentViolationId,
  onViewViolation,
}: {
  violations: ViolationHistoryItem[];
  currentViolationId: string;
  onViewViolation: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const displayViolations = showAll ? violations : violations.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">Violation History</span>
        {violations.length > 5 && (
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All (${violations.length})`}
          </button>
        )}
      </div>

      {violations.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-8 text-center dark:bg-gray-900">
          <Shield className="mx-auto mb-2 h-12 w-12 text-gray-400" />
          <p className="text-sm text-gray-500">No previous violations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayViolations.map((violation) => {
            const isCurrent = violation.id === currentViolationId;
            const severityConfig = SEVERITY_CONFIG[violation.severity];

            return (
              <div
                key={violation.id}
                className={`rounded-lg border p-3 ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {violation.type.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${severityConfig.bg} ${severityConfig.text}`}
                      >
                        {violation.severity}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDateFull(violation.timestamp)} · {violation.podName}
                    </p>
                    {violation.resolution && (
                      <p className="mt-1 text-xs text-gray-500">
                        {ACTION_LABELS[violation.resolution.action] || violation.resolution.action}{' '}
                        by {violation.resolution.resolvedBy}
                      </p>
                    )}
                  </div>
                  {!isCurrent && (
                    <button
                      className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => onViewViolation(violation.id)}
                    >
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PatternAnalysis({
  violationsByType,
  totalViolations,
  lastViolationAt,
}: {
  violationsByType: Record<string, number>;
  totalViolations: number;
  lastViolationAt?: Date;
}) {
  const patterns = useMemo(() => {
    const items = [];

    // Most common violation type
    const types = Object.entries(violationsByType);
    if (types.length > 0) {
      const [mostCommon] = types.sort(([, a], [, b]) => b - a);
      const percentage = Math.round((mostCommon[1] / totalViolations) * 100);
      items.push({
        label: 'Most common violation',
        value: `${mostCommon[0].replace(/_/g, ' ')} (${percentage}%)`,
        type: 'info' as const,
      });
    }

    // Frequency pattern
    if (lastViolationAt) {
      const daysSinceFirst = getDaysSince(
        new Date(Date.now() - totalViolations * 30 * 24 * 60 * 60 * 1000)
      );
      const frequency =
        daysSinceFirst > 0 ? ((totalViolations / daysSinceFirst) * 30).toFixed(1) : 0;
      items.push({
        label: 'Average frequency',
        value: `${frequency} violations/month`,
        type: totalViolations > 3 ? ('warning' as const) : ('info' as const),
      });
    }

    // Recency
    if (lastViolationAt) {
      const daysSince = getDaysSince(lastViolationAt);
      items.push({
        label: 'Last violation',
        value: getTimeAgo(lastViolationAt),
        type: daysSince < 7 ? ('warning' as const) : ('info' as const),
      });
    }

    return items;
  }, [violationsByType, totalViolations, lastViolationAt]);

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-500">Pattern Analysis</span>
      </div>

      {patterns.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          Not enough data for pattern analysis
        </p>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{pattern.label}</span>
              <span
                className={`text-sm font-medium ${
                  pattern.type === 'warning'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {pattern.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UserViolationHistory({ user, currentViolationId }: UserViolationHistoryProps) {
  // Mock violation history
  const violations: ViolationHistoryItem[] = [
    {
      id: currentViolationId,
      type: 'screenshot_attempt',
      severity: 'high',
      status: 'pending',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      podName: 'Development Environment',
    },
    {
      id: 'viol-2',
      type: 'clipboard_violation',
      severity: 'medium',
      status: 'resolved',
      timestamp: new Date('2024-01-15'),
      podName: 'Design Workspace',
      resolution: {
        action: 'warned',
        resolvedBy: 'admin@company.com',
        resolvedAt: new Date('2024-01-15'),
      },
    },
    {
      id: 'viol-3',
      type: 'screenshot_attempt',
      severity: 'high',
      status: 'dismissed',
      timestamp: new Date('2023-11-20'),
      podName: 'Development Environment',
      resolution: {
        action: 'dismissed',
        resolvedBy: 'admin@company.com',
        resolvedAt: new Date('2023-11-21'),
      },
    },
  ];

  const handleViewViolation = (id: string) => {
    window.location.href = `/violations/${id}/investigate`;
  };

  return (
    <div className="space-y-6">
      {/* User Summary */}
      <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
        {user.avatar ? (
          <img alt={user.name} className="h-16 w-16 rounded-full" src={user.avatar} />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
            <User className="h-8 w-8 text-gray-500" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{user.name}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {user.role}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Joined {formatDate(user.joinedAt)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {user.totalViolations}
          </div>
          <div className="text-xs text-gray-500">Total Violations</div>
        </div>
      </div>

      {/* Trust Score */}
      <TrustScoreCard user={user} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ViolationTypesChart violationsByType={user.violationsByType} />
        <SeverityDistribution violationsBySeverity={user.violationsBySeverity} />
      </div>

      {/* Pattern Analysis */}
      <PatternAnalysis
        lastViolationAt={user.lastViolationAt}
        totalViolations={user.totalViolations}
        violationsByType={user.violationsByType}
      />

      {/* Previous Actions */}
      <PreviousActionsTimeline actions={user.previousActions} />

      {/* Violation History */}
      <ViolationHistoryList
        currentViolationId={currentViolationId}
        violations={violations}
        onViewViolation={handleViewViolation}
      />
    </div>
  );
}
