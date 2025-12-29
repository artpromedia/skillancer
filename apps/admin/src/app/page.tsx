/**
 * Admin Dashboard Home Page
 *
 * Shows key metrics, charts, recent activity, and alerts requiring attention.
 *
 * @module app/page
 */

import {
  Users,
  UserPlus,
  FileText,
  DollarSign,
  Scale,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface MetricCard {
  id: string;
  label: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: LucideIcon;
  iconColor: string;
  href: string;
}

interface ActivityItem {
  id: string;
  type: 'user' | 'dispute' | 'payment' | 'moderation' | 'verification';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
}

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action: {
    label: string;
    href: string;
  };
  timestamp: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const METRICS: MetricCard[] = [
  {
    id: 'active-users',
    label: 'Active Users (24h)',
    value: '12,847',
    change: 8.2,
    changeLabel: 'vs yesterday',
    icon: Users,
    iconColor: 'bg-blue-500',
    href: '/users?filter=active',
  },
  {
    id: 'new-signups',
    label: 'New Signups (Today)',
    value: 342,
    change: -3.1,
    changeLabel: 'vs yesterday',
    icon: UserPlus,
    iconColor: 'bg-green-500',
    href: '/users?filter=new',
  },
  {
    id: 'active-contracts',
    label: 'Active Contracts',
    value: '5,621',
    change: 12.5,
    changeLabel: 'vs last week',
    icon: FileText,
    iconColor: 'bg-purple-500',
    href: '/contracts?status=active',
  },
  {
    id: 'gmv',
    label: 'GMV (This Month)',
    value: '$2.4M',
    change: 18.7,
    changeLabel: 'vs last month',
    icon: DollarSign,
    iconColor: 'bg-emerald-500',
    href: '/payments',
  },
  {
    id: 'open-disputes',
    label: 'Open Disputes',
    value: 47,
    change: -15.2,
    changeLabel: 'vs last week',
    icon: Scale,
    iconColor: 'bg-orange-500',
    href: '/disputes?status=open',
  },
  {
    id: 'pending-verifications',
    label: 'Pending Verifications',
    value: 128,
    change: 22.0,
    changeLabel: 'vs yesterday',
    icon: ShieldCheck,
    iconColor: 'bg-indigo-500',
    href: '/moderation?tab=verifications',
  },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: '1',
    type: 'user',
    title: 'New user suspended',
    description: 'John Doe was suspended for policy violation',
    timestamp: '5 minutes ago',
    user: { name: 'Admin Sarah' },
  },
  {
    id: '2',
    type: 'dispute',
    title: 'Dispute resolved',
    description: 'Contract #12345 dispute settled with partial refund',
    timestamp: '12 minutes ago',
    user: { name: 'Admin Mike' },
  },
  {
    id: '3',
    type: 'payment',
    title: 'Manual payout processed',
    description: '$5,000 payout to freelancer approved',
    timestamp: '25 minutes ago',
    user: { name: 'Finance Lisa' },
  },
  {
    id: '4',
    type: 'moderation',
    title: 'Job post rejected',
    description: 'Spam job posting removed from marketplace',
    timestamp: '32 minutes ago',
    user: { name: 'Mod Chris' },
  },
  {
    id: '5',
    type: 'verification',
    title: 'Identity verified',
    description: 'User verification completed for Jane Smith',
    timestamp: '45 minutes ago',
    user: { name: 'Admin Sarah' },
  },
];

const ALERTS: AlertItem[] = [
  {
    id: '1',
    severity: 'critical',
    title: 'High-value dispute requires attention',
    description: 'Dispute #789 involves $25,000 and is escalating',
    action: { label: 'View Dispute', href: '/disputes/789' },
    timestamp: '10 minutes ago',
  },
  {
    id: '2',
    severity: 'warning',
    title: 'Unusual signup pattern detected',
    description: '150+ signups from same IP range in last hour',
    action: { label: 'Investigate', href: '/users?filter=suspicious' },
    timestamp: '1 hour ago',
  },
  {
    id: '3',
    severity: 'warning',
    title: 'Payment processor delay',
    description: 'Stripe webhook delays affecting payout processing',
    action: { label: 'Check Status', href: '/settings/integrations' },
    timestamp: '2 hours ago',
  },
];

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCardComponent({ metric }: Readonly<{ metric: MetricCard }>) {
  const isPositive = metric.change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Link className="admin-card group transition-shadow hover:shadow-md" href={metric.href}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
          <div className="mt-2 flex items-center gap-1">
            <TrendIcon className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
            <span
              className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}
            >
              {isPositive ? '+' : ''}
              {metric.change}%
            </span>
            <span className="text-sm text-gray-500">{metric.changeLabel}</span>
          </div>
        </div>
        <div className={`rounded-lg p-3 ${metric.iconColor}`}>
          <metric.icon className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
        View details <ArrowRight className="ml-1 h-4 w-4" />
      </div>
    </Link>
  );
}

// ============================================================================
// Activity Feed Component
// ============================================================================

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'user':
      return Users;
    case 'dispute':
      return Scale;
    case 'payment':
      return DollarSign;
    case 'moderation':
      return Eye;
    case 'verification':
      return ShieldCheck;
    default:
      return MessageSquare;
  }
}

function ActivityFeed({ activities }: Readonly<{ activities: ActivityItem[] }>) {
  return (
    <div className="admin-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
        <Link
          className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          href="/audit-log"
        >
          View all
        </Link>
      </div>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="rounded-full bg-gray-100 p-2 dark:bg-gray-700">
                <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {activity.title}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {activity.timestamp}
                  {activity.user && (
                    <>
                      <span>•</span>
                      <span>{activity.user.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Alerts Panel Component
// ============================================================================

function getSeverityStyles(severity: AlertItem['severity']) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        icon: XCircle,
        iconColor: 'text-red-500',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        icon: AlertTriangle,
        iconColor: 'text-yellow-500',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        icon: CheckCircle,
        iconColor: 'text-blue-500',
      };
  }
}

function AlertsPanel({ alerts }: Readonly<{ alerts: AlertItem[] }>) {
  return (
    <div className="admin-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Alerts Requiring Attention
        </h2>
        <span className="admin-badge-danger">{alerts.length} active</span>
      </div>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const styles = getSeverityStyles(alert.severity);
          const Icon = styles.icon;
          return (
            <div key={alert.id} className={`rounded-lg border p-4 ${styles.bg} ${styles.border}`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 ${styles.iconColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{alert.title}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {alert.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{alert.timestamp}</span>
                    <Link
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      href={alert.action.href}
                    >
                      {alert.action.label} →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Actions Component
// ============================================================================

function QuickActions() {
  const actions = [
    { label: 'Lookup User', href: '/users?action=search', icon: Users },
    { label: 'Process Refund', href: '/payments?action=refund', icon: DollarSign },
    { label: 'Review Queue', href: '/moderation', icon: Eye },
    { label: 'View Reports', href: '/reports', icon: TrendingUp },
  ];

  return (
    <div className="admin-card">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm font-medium text-gray-700 transition-colors hover:border-indigo-500 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
            href={action.href}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Placeholder Charts Component
// ============================================================================

function ChartsSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="admin-card">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Signups Over Time
        </h3>
        <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Chart placeholder - Recharts integration</p>
        </div>
      </div>
      <div className="admin-card">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Revenue Trend</h3>
        <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <p className="text-sm text-gray-500">Chart placeholder - Recharts integration</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Platform overview and key metrics
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {METRICS.map((metric) => (
          <MetricCardComponent key={metric.id} metric={metric} />
        ))}
      </div>

      {/* Charts */}
      <ChartsSection />

      {/* Activity & Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed activities={RECENT_ACTIVITY} />
        </div>
        <div className="space-y-6">
          <AlertsPanel alerts={ALERTS} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

