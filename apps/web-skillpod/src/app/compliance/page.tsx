/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Compliance Dashboard Page
 *
 * Comprehensive compliance overview with framework status,
 * audit readiness, upcoming deadlines, and quick actions.
 *
 * @module app/compliance/page
 */

import {
  Shield,
  FileCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Download,
  Plus,
  ChevronRight,
  BarChart2,
  Activity,
  FileText,
  ArrowRight,
  ExternalLink,
  Bell,
  Settings,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ComplianceFramework {
  id: string;
  name: string;
  shortName: string;
  status: 'compliant' | 'at_risk' | 'non_compliant' | 'pending_audit';
  score: number;
  lastAudit?: Date;
  nextAudit?: Date;
  requirements: {
    total: number;
    met: number;
    partial: number;
    unmet: number;
  };
  recentChanges: number;
  trend: 'up' | 'down' | 'stable';
}

interface ComplianceTask {
  id: string;
  title: string;
  framework: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assignee?: string;
}

interface AuditEvent {
  id: string;
  type: 'policy_change' | 'violation' | 'access_request' | 'data_export' | 'user_action';
  description: string;
  timestamp: Date;
  severity: 'high' | 'medium' | 'low' | 'info';
  user?: string;
}

interface ComplianceStats {
  overallScore: number;
  frameworksCompliant: number;
  frameworksTotal: number;
  openTasks: number;
  overdueItems: number;
  upcomingAudits: number;
  violationsThisMonth: number;
  violationsLastMonth: number;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG = {
  compliant: {
    label: 'Compliant',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: CheckCircle,
  },
  at_risk: {
    label: 'At Risk',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: AlertTriangle,
  },
  non_compliant: {
    label: 'Non-Compliant',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    icon: XCircle,
  },
  pending_audit: {
    label: 'Pending Audit',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    icon: Clock,
  },
};

const PRIORITY_CONFIG = {
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  low: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
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

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getDaysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatsOverview({ stats }: Readonly<{ stats: ComplianceStats }>) {
  const violationTrend = stats.violationsThisMonth - stats.violationsLastMonth;
  const violationTrendPercent =
    stats.violationsLastMonth > 0
      ? Math.round((Math.abs(violationTrend) / stats.violationsLastMonth) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Overall Score */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Compliance Score</span>
          <Shield className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex items-end gap-2">
          <span
            className={`text-3xl font-bold ${
              stats.overallScore >= 90
                ? 'text-green-600'
                : stats.overallScore >= 70
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {stats.overallScore}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${
              stats.overallScore >= 90
                ? 'bg-green-500'
                : stats.overallScore >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${stats.overallScore}%` }}
          />
        </div>
      </div>

      {/* Frameworks */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Frameworks</span>
          <FileCheck className="h-5 w-5 text-green-500" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.frameworksCompliant}
          </span>
          <span className="text-lg text-gray-500">/ {stats.frameworksTotal}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">compliant frameworks</p>
      </div>

      {/* Open Tasks */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Open Tasks</span>
          <Activity className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.openTasks}
          </span>
          {stats.overdueItems > 0 && (
            <span className="text-sm text-red-600">({stats.overdueItems} overdue)</span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">compliance tasks pending</p>
      </div>

      {/* Violations */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Violations</span>
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.violationsThisMonth}
          </span>
          {violationTrend !== 0 && (
            <span
              className={`flex items-center text-sm ${
                violationTrend < 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {violationTrend < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              {violationTrendPercent}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">this month</p>
      </div>
    </div>
  );
}

function FrameworkCard({ framework }: Readonly<{ framework: ComplianceFramework }>) {
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[framework.status];
  const StatusIcon = statusConfig.icon;
  const daysUntilAudit = framework.nextAudit ? getDaysUntil(framework.nextAudit) : null;

  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-700"
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/compliance/frameworks/${framework.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(`/compliance/frameworks/${framework.id}`);
        }
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">{framework.name}</h3>
          <span className="text-sm text-gray-500">{framework.shortName}</span>
        </div>
        <span
          className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
        >
          <StatusIcon className="h-3 w-3" />
          {statusConfig.label}
        </span>
      </div>

      {/* Score */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-gray-500">Compliance Score</span>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-900 dark:text-white">{framework.score}%</span>
            {framework.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {framework.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full ${
              framework.score >= 90
                ? 'bg-green-500'
                : framework.score >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${framework.score}%` }}
          />
        </div>
      </div>

      {/* Requirements */}
      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {framework.requirements.met} / {framework.requirements.total} requirements met
        </span>
        {framework.requirements.unmet > 0 && (
          <span className="text-red-600">{framework.requirements.unmet} unmet</span>
        )}
      </div>

      {/* Next Audit */}
      {daysUntilAudit !== null && (
        <div
          className={`flex items-center gap-2 text-sm ${
            daysUntilAudit <= 7
              ? 'text-red-600'
              : daysUntilAudit <= 30
                ? 'text-yellow-600'
                : 'text-gray-500'
          }`}
        >
          <Calendar className="h-4 w-4" />
          {daysUntilAudit <= 0 ? 'Audit due' : `Audit in ${daysUntilAudit} days`}
        </div>
      )}
    </div>
  );
}

function UpcomingTasksList({ tasks }: Readonly<{ tasks: ComplianceTask[] }>) {
  const router = useRouter();
  const sortedTasks = useMemo(() => {
    return [...tasks]
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);
  }, [tasks]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h2 className="font-medium text-gray-900 dark:text-white">Upcoming Tasks</h2>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => router.push('/compliance/tasks')}
        >
          View All
        </button>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedTasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
            <p>All tasks completed!</p>
          </div>
        ) : (
          sortedTasks.map((task) => {
            const daysUntil = getDaysUntil(task.dueDate);
            const isOverdue = daysUntil < 0;
            const priorityConfig = PRIORITY_CONFIG[task.priority];

            return (
              <div
                key={task.id}
                className="cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/compliance/tasks/${task.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/compliance/tasks/${task.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="mb-1 text-sm font-medium text-gray-900 dark:text-white">
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`rounded px-1.5 py-0.5 ${priorityConfig.bg} ${priorityConfig.text}`}
                      >
                        {task.priority}
                      </span>
                      <span>{task.framework}</span>
                    </div>
                  </div>
                  <div
                    className={`text-sm ${
                      isOverdue
                        ? 'text-red-600'
                        : daysUntil <= 3
                          ? 'text-orange-600'
                          : 'text-gray-500'
                    }`}
                  >
                    {isOverdue
                      ? `${Math.abs(daysUntil)} days overdue`
                      : daysUntil === 0
                        ? 'Due today'
                        : `${daysUntil} days`}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function RecentAuditLog({ events }: Readonly<{ events: AuditEvent[] }>) {
  const router = useRouter();
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h2 className="font-medium text-gray-900 dark:text-white">Recent Audit Events</h2>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => router.push('/compliance/audit-log')}
        >
          View All
        </button>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {events.slice(0, 5).map((event) => (
          <div key={event.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className={`mt-1.5 h-2 w-2 rounded-full ${getSeverityColor(event.severity)}`} />
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">{event.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatDateShort(event.timestamp)}</span>
                  <span>{formatTime(event.timestamp)}</span>
                  {event.user && (
                    <>
                      <span>·</span>
                      <span>{event.user}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      label: 'Generate Report',
      icon: FileText,
      onClick: () => router.push('/compliance/reports/new'),
      color: 'text-blue-600',
    },
    {
      label: 'Schedule Audit',
      icon: Calendar,
      onClick: () => router.push('/compliance/audits/schedule'),
      color: 'text-green-600',
    },
    {
      label: 'Export Audit Log',
      icon: Download,
      onClick: () => {
        /* Feature: Export audit log - not yet implemented */
      },
      color: 'text-purple-600',
    },
    {
      label: 'Configure Alerts',
      icon: Bell,
      onClick: () => router.push('/alerts'),
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 font-medium text-gray-900 dark:text-white">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
            onClick={action.onClick}
          >
            <action.icon className={`h-5 w-5 ${action.color}`} />
            <span className="text-sm text-gray-700 dark:text-gray-300">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ComplianceDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Mock stats
        setStats({
          overallScore: 87,
          frameworksCompliant: 3,
          frameworksTotal: 4,
          openTasks: 12,
          overdueItems: 2,
          upcomingAudits: 1,
          violationsThisMonth: 8,
          violationsLastMonth: 12,
        });

        // Mock frameworks
        setFrameworks([
          {
            id: 'soc2',
            name: 'SOC 2 Type II',
            shortName: 'SOC2',
            status: 'compliant',
            score: 94,
            lastAudit: new Date('2024-01-15'),
            nextAudit: new Date('2025-01-15'),
            requirements: { total: 64, met: 60, partial: 3, unmet: 1 },
            recentChanges: 2,
            trend: 'up',
          },
          {
            id: 'hipaa',
            name: 'HIPAA',
            shortName: 'HIPAA',
            status: 'compliant',
            score: 91,
            lastAudit: new Date('2023-11-20'),
            nextAudit: new Date('2024-11-20'),
            requirements: { total: 45, met: 41, partial: 3, unmet: 1 },
            recentChanges: 1,
            trend: 'stable',
          },
          {
            id: 'gdpr',
            name: 'GDPR',
            shortName: 'GDPR',
            status: 'at_risk',
            score: 78,
            lastAudit: new Date('2023-09-10'),
            nextAudit: new Date('2024-03-10'),
            requirements: { total: 38, met: 29, partial: 5, unmet: 4 },
            recentChanges: 4,
            trend: 'down',
          },
          {
            id: 'pci',
            name: 'PCI DSS',
            shortName: 'PCI-DSS',
            status: 'compliant',
            score: 96,
            lastAudit: new Date('2024-02-01'),
            requirements: { total: 52, met: 50, partial: 2, unmet: 0 },
            recentChanges: 0,
            trend: 'stable',
          },
        ]);

        // Mock tasks
        setTasks([
          {
            id: 'task-1',
            title: 'Update data retention policy documentation',
            framework: 'GDPR',
            dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            priority: 'high',
            status: 'overdue',
            assignee: 'compliance@company.com',
          },
          {
            id: 'task-2',
            title: 'Complete annual access review',
            framework: 'SOC2',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            priority: 'high',
            status: 'in_progress',
          },
          {
            id: 'task-3',
            title: 'Update encryption key rotation schedule',
            framework: 'PCI-DSS',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            priority: 'medium',
            status: 'pending',
          },
          {
            id: 'task-4',
            title: 'Review and update BAA templates',
            framework: 'HIPAA',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            priority: 'low',
            status: 'pending',
          },
        ]);

        // Mock audit events
        setAuditEvents([
          {
            id: 'ae-1',
            type: 'policy_change',
            description: 'Data retention policy updated for GDPR compliance',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            severity: 'medium',
            user: 'admin@company.com',
          },
          {
            id: 'ae-2',
            type: 'violation',
            description: 'Screenshot attempt detected and blocked',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
            severity: 'high',
          },
          {
            id: 'ae-3',
            type: 'access_request',
            description: 'Bulk data export requested for audit',
            timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
            severity: 'info',
            user: 'auditor@external.com',
          },
          {
            id: 'ae-4',
            type: 'user_action',
            description: 'New user granted admin privileges',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            severity: 'medium',
            user: 'hr@company.com',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Compliance Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor and manage compliance across all frameworks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={() => router.push('/compliance/reports/new')}
              >
                <Plus className="h-4 w-4" />
                New Report
              </button>
              <button
                className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                onClick={() => router.push('/settings/compliance')}
              >
                <Settings className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        {stats && <StatsOverview stats={stats} />}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Frameworks Grid */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Compliance Frameworks
                </h2>
                <button
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  onClick={() => router.push('/compliance/frameworks')}
                >
                  Manage Frameworks
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {frameworks.map((framework) => (
                  <FrameworkCard key={framework.id} framework={framework} />
                ))}
              </div>
            </div>

            {/* Recent Audit Events */}
            <RecentAuditLog events={auditEvents} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <QuickActions />

            {/* Upcoming Tasks */}
            <UpcomingTasksList tasks={tasks} />
          </div>
        </div>
      </div>
    </div>
  );
}
