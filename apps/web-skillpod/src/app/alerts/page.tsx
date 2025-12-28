/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Security Alerts Dashboard
 *
 * Real-time security alert monitoring with severity filtering,
 * acknowledgment workflows, and integration with SIEM systems.
 *
 * @module app/alerts/page
 */

import {
  Bell,
  AlertTriangle,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Settings,
  Download,
  ExternalLink,
  UserX,
  Lock,
  Unlock,
  Monitor,
  Zap,
  AlertOctagon,
  Info,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface SecurityAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  source: string;
  timestamp: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  affectedResource: {
    type: string;
    id: string;
    name: string;
  };
  relatedAlerts?: string[];
  metadata: Record<string, unknown>;
  actions?: {
    id: string;
    label: string;
    action: string;
  }[];
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: AlertOctagon,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-500',
    priority: 1,
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-500',
    priority: 2,
  },
  medium: {
    label: 'Medium',
    icon: Shield,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-500',
    priority: 3,
  },
  low: {
    label: 'Low',
    icon: Activity,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-500',
    priority: 4,
  },
  info: {
    label: 'Info',
    icon: Info,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    borderColor: 'border-gray-400',
    priority: 5,
  },
};

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-red-600', bgColor: 'bg-red-100' },
  acknowledged: { label: 'Acknowledged', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  investigating: { label: 'Investigating', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  resolved: { label: 'Resolved', color: 'text-green-600', bgColor: 'bg-green-100' },
  false_positive: { label: 'False Positive', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const ALERT_TYPES = [
  { id: 'unauthorized_access', label: 'Unauthorized Access', icon: UserX },
  { id: 'policy_violation', label: 'Policy Violation', icon: Shield },
  { id: 'suspicious_activity', label: 'Suspicious Activity', icon: Activity },
  { id: 'session_anomaly', label: 'Session Anomaly', icon: Monitor },
  { id: 'data_exfiltration', label: 'Data Exfiltration', icon: AlertTriangle },
  { id: 'privilege_escalation', label: 'Privilege Escalation', icon: Zap },
];

// ============================================================================
// Mock Data
// ============================================================================

function generateMockAlerts(): SecurityAlert[] {
  return [
    {
      id: 'alert-1',
      type: 'unauthorized_access',
      title: 'Multiple Failed Login Attempts',
      description:
        'User attempted to access protected resource without proper authorization. 5 failed attempts in 2 minutes from unusual location.',
      severity: 'high',
      status: 'active',
      source: 'auth-service',
      timestamp: new Date(Date.now() - 5 * 60000),
      affectedResource: { type: 'user', id: 'user-123', name: 'john.doe@company.com' },
      metadata: { attempts: 5, ip: '192.168.1.100', location: 'Unknown' },
      actions: [
        { id: 'lock', label: 'Lock Account', action: 'lock_account' },
        { id: 'investigate', label: 'Investigate', action: 'open_investigation' },
      ],
    },
    {
      id: 'alert-2',
      type: 'policy_violation',
      title: 'Clipboard Access Detected',
      description:
        'Pod worker accessed system clipboard during active session, violating data protection policy.',
      severity: 'critical',
      status: 'acknowledged',
      source: 'session-monitor',
      timestamp: new Date(Date.now() - 15 * 60000),
      acknowledgedAt: new Date(Date.now() - 10 * 60000),
      acknowledgedBy: 'admin@company.com',
      affectedResource: { type: 'session', id: 'session-456', name: 'VDI Session #456' },
      metadata: { policy: 'clipboard-restriction', action: 'paste' },
      actions: [
        { id: 'terminate', label: 'End Session', action: 'terminate_session' },
        { id: 'warn', label: 'Send Warning', action: 'send_warning' },
      ],
    },
    {
      id: 'alert-3',
      type: 'suspicious_activity',
      title: 'Unusual Working Hours Activity',
      description: 'User accessed system at 3:00 AM, outside their normal working hours pattern.',
      severity: 'medium',
      status: 'investigating',
      source: 'behavior-analytics',
      timestamp: new Date(Date.now() - 60 * 60000),
      affectedResource: { type: 'user', id: 'user-789', name: 'jane.smith@company.com' },
      metadata: { normalHours: '9AM-6PM', actualTime: '3:00 AM' },
    },
    {
      id: 'alert-4',
      type: 'data_exfiltration',
      title: 'Large File Download Detected',
      description:
        'User attempted to download unusually large file (2.3GB) from restricted workspace.',
      severity: 'critical',
      status: 'active',
      source: 'dlp-service',
      timestamp: new Date(Date.now() - 2 * 60000),
      affectedResource: { type: 'workspace', id: 'ws-101', name: 'Finance Project' },
      metadata: { fileSize: '2.3GB', filename: 'client_data.zip' },
      actions: [
        { id: 'block', label: 'Block Download', action: 'block_download' },
        { id: 'terminate', label: 'End Session', action: 'terminate_session' },
      ],
    },
    {
      id: 'alert-5',
      type: 'session_anomaly',
      title: 'Dual Session Detected',
      description:
        'User has active sessions from two different geographic locations simultaneously.',
      severity: 'high',
      status: 'active',
      source: 'session-manager',
      timestamp: new Date(Date.now() - 8 * 60000),
      affectedResource: { type: 'user', id: 'user-234', name: 'mike.johnson@company.com' },
      metadata: { locations: ['New York, US', 'London, UK'], timeDelta: '0 minutes' },
    },
    {
      id: 'alert-6',
      type: 'privilege_escalation',
      title: 'Admin Access Attempt',
      description: 'Standard user attempted to access administrative functions.',
      severity: 'low',
      status: 'resolved',
      source: 'rbac-service',
      timestamp: new Date(Date.now() - 120 * 60000),
      resolvedAt: new Date(Date.now() - 90 * 60000),
      resolvedBy: 'security@company.com',
      affectedResource: { type: 'user', id: 'user-567', name: 'sarah.wilson@company.com' },
      metadata: { attemptedRole: 'admin', currentRole: 'user' },
    },
  ];
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function AlertCard({
  alert,
  isExpanded,
  onToggle,
  onAcknowledge,
  onResolve,
}: {
  alert: SecurityAlert;
  isExpanded: boolean;
  onToggle: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const statusConfig = STATUS_CONFIG[alert.status];
  const SeverityIcon = severityConfig.icon;

  return (
    <div
      className={`border-l-4 ${severityConfig.borderColor} overflow-hidden rounded-r-lg bg-white shadow-sm dark:bg-gray-800`}
    >
      <button
        className="flex w-full items-start gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onToggle}
      >
        {/* Severity Icon */}
        <div className={`rounded-lg p-2 ${severityConfig.bgColor} shrink-0`}>
          <SeverityIcon className={`h-5 w-5 ${severityConfig.color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="truncate font-medium text-gray-900 dark:text-white">{alert.title}</h3>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
          <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
            {alert.description}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(alert.timestamp)}
            </span>
            <span>Source: {alert.source}</span>
            <span>Resource: {alert.affectedResource.name}</span>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 dark:border-gray-700">
          <div className="space-y-4 pt-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Object.entries(alert.metadata).map(([key, value]) => (
                <div key={key}>
                  <span className="block text-xs capitalize text-gray-500">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            {(alert.acknowledgedAt || alert.resolvedAt) && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                <h4 className="mb-2 text-xs font-medium text-gray-500">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-red-500" />
                    <span>Alert triggered</span>
                    <span className="text-gray-500">{formatTimeAgo(alert.timestamp)}</span>
                  </div>
                  {alert.acknowledgedAt && (
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-yellow-500" />
                      <span>Acknowledged by {alert.acknowledgedBy}</span>
                      <span className="text-gray-500">{formatTimeAgo(alert.acknowledgedAt)}</span>
                    </div>
                  )}
                  {alert.resolvedAt && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Resolved by {alert.resolvedBy}</span>
                      <span className="text-gray-500">{formatTimeAgo(alert.resolvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              {alert.status === 'active' && (
                <button
                  className="flex items-center gap-1 rounded-lg bg-yellow-100 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge();
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Acknowledge
                </button>
              )}
              {(alert.status === 'active' ||
                alert.status === 'acknowledged' ||
                alert.status === 'investigating') && (
                <button
                  className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-sm text-green-700 hover:bg-green-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve();
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolve
                </button>
              )}
              {alert.actions?.map((action) => (
                <button
                  key={action.id}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {action.label}
                </button>
              ))}
              <Link
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700"
                href={`/violations/${alert.id}/investigate`}
              >
                <ExternalLink className="h-4 w-4" />
                Full Investigation
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: number;
  icon: typeof Bell;
  color: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-gray-500">{title}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
        {trend && (
          <span className={`text-xs ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '↓' : '↑'} {trend.value}% vs last week
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    'active',
    'acknowledged',
    'investigating',
  ]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load alerts
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setAlerts(generateMockAlerts());
      setIsLoading(false);
    }, 500);
  }, []);

  // Auto-refresh simulation
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Simulate new alert occasionally
      if (Math.random() > 0.8) {
        const newAlert = generateMockAlerts()[0];
        newAlert.id = `alert-${Date.now()}`;
        newAlert.timestamp = new Date();
        setAlerts((prev) => [newAlert, ...prev]);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((alert) => {
        if (
          searchQuery &&
          !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !alert.description.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        if (selectedSeverities.length > 0 && !selectedSeverities.includes(alert.severity)) {
          return false;
        }
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(alert.status)) {
          return false;
        }
        if (selectedTypes.length > 0 && !selectedTypes.includes(alert.type)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by severity priority, then by timestamp
        const priorityDiff =
          SEVERITY_CONFIG[a.severity].priority - SEVERITY_CONFIG[b.severity].priority;
        if (priorityDiff !== 0) return priorityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }, [alerts, searchQuery, selectedSeverities, selectedStatuses, selectedTypes]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeAlerts = alerts.filter((a) => a.status === 'active').length;
    const criticalAlerts = alerts.filter(
      (a) => a.severity === 'critical' && a.status !== 'resolved'
    ).length;
    const resolvedToday = alerts.filter((a) => {
      if (!a.resolvedAt) return false;
      const today = new Date();
      return a.resolvedAt.toDateString() === today.toDateString();
    }).length;
    const avgResponseTime = 12; // Mock value

    return { activeAlerts, criticalAlerts, resolvedToday, avgResponseTime };
  }, [alerts]);

  const toggleAlertExpansion = (id: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAlerts(newExpanded);
  };

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'acknowledged' as const,
              acknowledgedAt: new Date(),
              acknowledgedBy: 'current.user@company.com',
            }
          : a
      )
    );
  };

  const handleResolve = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'resolved' as const,
              resolvedAt: new Date(),
              resolvedBy: 'current.user@company.com',
            }
          : a
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                <Bell className="h-7 w-7 text-red-600" />
                Security Alerts
                {stats.activeAlerts > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-sm text-red-700">
                    {stats.activeAlerts} Active
                  </span>
                )}
              </h1>
              <p className="mt-1 text-gray-500">
                Real-time security monitoring and incident response
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className={`rounded-lg p-2 ${
                  soundEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                }`}
                title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
              <button
                className={`flex items-center gap-1 rounded-lg px-3 py-2 ${
                  autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Live' : 'Paused'}
              </button>
              <Link
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                href="/settings/alert-rules"
              >
                <Settings className="h-4 w-4" />
                Configure
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatsCard
            color="text-red-600"
            icon={Bell}
            title="Active Alerts"
            trend={{ value: 15, positive: true }}
            value={stats.activeAlerts}
          />
          <StatsCard
            color="text-red-600"
            icon={AlertOctagon}
            title="Critical"
            value={stats.criticalAlerts}
          />
          <StatsCard
            color="text-green-600"
            icon={CheckCircle}
            title="Resolved Today"
            value={stats.resolvedToday}
          />
          <StatsCard
            color="text-blue-600"
            icon={Clock}
            title="Avg Response Time"
            value={stats.avgResponseTime}
          />
        </div>

        {/* Search & Filters */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Search alerts..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
                showFilters
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                  : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Severity Filter */}
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Severity
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          selectedSeverities.includes(key)
                            ? `${config.bgColor} ${config.borderColor} ${config.color}`
                            : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                        }`}
                        onClick={() => {
                          setSelectedSeverities((prev) =>
                            prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
                          );
                        }}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          selectedStatuses.includes(key)
                            ? `${config.bgColor} border-current ${config.color}`
                            : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                        }`}
                        onClick={() => {
                          setSelectedStatuses((prev) =>
                            prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
                          );
                        }}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Alert Type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ALERT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          selectedTypes.includes(type.id)
                            ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                            : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                        }`}
                        onClick={() => {
                          setSelectedTypes((prev) =>
                            prev.includes(type.id)
                              ? prev.filter((t) => t !== type.id)
                              : [...prev, type.id]
                          );
                        }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
              <h3 className="mb-2 text-xl font-medium text-gray-900 dark:text-white">All Clear!</h3>
              <p className="text-gray-500">No alerts match your current filters</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isExpanded={expandedAlerts.has(alert.id)}
                onAcknowledge={() => handleAcknowledge(alert.id)}
                onResolve={() => handleResolve(alert.id)}
                onToggle={() => toggleAlertExpansion(alert.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
