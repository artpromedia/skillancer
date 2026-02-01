/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Alert Rules Configuration Page
 *
 * Configure security alert rules, thresholds, escalation policies,
 * and integration with external monitoring systems.
 *
 * @module app/settings/alert-rules/page
 */

import {
  Bell,
  Plus,
  Settings,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Shield,
  Activity,
  Users,
  Mail,
  MessageSquare,
  Smartphone,
  Webhook,
  Play,
  Pause,
  Copy,
  Check,
  X,
  ArrowLeft,
  Zap,
  Lock,
  Monitor,
  Server,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  conditions: AlertCondition[];
  actions: AlertAction[];
  schedule?: {
    enabled: boolean;
    timezone: string;
    windows: { start: string; end: string; days: string[] }[];
  };
  cooldown: number; // minutes
  rateLimit?: {
    maxAlerts: number;
    windowMinutes: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastTriggered?: Date;
  triggerCount: number;
}

interface AlertCondition {
  id: string;
  type: string;
  operator: string;
  value: string | number | boolean;
  timeWindow?: number;
}

interface AlertAction {
  id: string;
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms' | 'auto_response';
  config: Record<string, unknown>;
  enabled: boolean;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms' | 'teams';
  config: Record<string, unknown>;
  enabled: boolean;
  lastTested?: Date;
}

// ============================================================================
// Constants
// ============================================================================

const RULE_CATEGORIES = [
  { id: 'authentication', label: 'Authentication', icon: Lock },
  { id: 'authorization', label: 'Authorization', icon: Shield },
  { id: 'session', label: 'Session Monitoring', icon: Monitor },
  { id: 'data_protection', label: 'Data Protection', icon: AlertTriangle },
  { id: 'behavior', label: 'Behavioral Analysis', icon: Activity },
  { id: 'system', label: 'System Health', icon: Server },
];

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  medium: { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  low: { label: 'Low', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  info: { label: 'Info', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const CONDITION_TYPES = [
  { id: 'failed_logins', label: 'Failed Login Attempts' },
  { id: 'unauthorized_access', label: 'Unauthorized Access Attempt' },
  { id: 'policy_violation', label: 'Policy Violation' },
  { id: 'session_anomaly', label: 'Session Anomaly' },
  { id: 'data_export', label: 'Data Export Size' },
  { id: 'geographic_anomaly', label: 'Geographic Anomaly' },
  { id: 'time_anomaly', label: 'Unusual Time Activity' },
  { id: 'rate_limit', label: 'Rate Limit Exceeded' },
];

const ACTION_TYPES = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'slack', label: 'Slack', icon: MessageSquare },
  { id: 'pagerduty', label: 'PagerDuty', icon: Smartphone },
  { id: 'webhook', label: 'Webhook', icon: Webhook },
  { id: 'sms', label: 'SMS', icon: Smartphone },
  { id: 'auto_response', label: 'Auto Response', icon: Zap },
];

// ============================================================================
// Mock Data
// ============================================================================

function generateMockRules(): AlertRule[] {
  return [
    {
      id: 'rule-1',
      name: 'Brute Force Detection',
      description: 'Alert when multiple failed login attempts are detected from the same IP',
      category: 'authentication',
      enabled: true,
      severity: 'high',
      conditions: [{ id: 'c1', type: 'failed_logins', operator: 'gte', value: 5, timeWindow: 5 }],
      actions: [
        {
          id: 'a1',
          type: 'email',
          config: { recipients: ['security@company.com'] },
          enabled: true,
        },
        { id: 'a2', type: 'slack', config: { channel: '#security-alerts' }, enabled: true },
      ],
      cooldown: 15,
      rateLimit: { maxAlerts: 10, windowMinutes: 60 },
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdBy: 'admin@company.com',
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
      triggerCount: 47,
    },
    {
      id: 'rule-2',
      name: 'Clipboard Policy Violation',
      description: 'Immediate alert when clipboard access is detected in restricted sessions',
      category: 'data_protection',
      enabled: true,
      severity: 'critical',
      conditions: [
        { id: 'c1', type: 'policy_violation', operator: 'eq', value: 'clipboard_access' },
      ],
      actions: [
        { id: 'a1', type: 'pagerduty', config: { service: 'security-oncall' }, enabled: true },
        { id: 'a2', type: 'auto_response', config: { action: 'terminate_session' }, enabled: true },
      ],
      cooldown: 0,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdBy: 'admin@company.com',
      lastTriggered: new Date(Date.now() - 6 * 60 * 60 * 1000),
      triggerCount: 12,
    },
    {
      id: 'rule-3',
      name: 'Geographic Anomaly',
      description: 'Alert when user accesses from an unusual geographic location',
      category: 'behavior',
      enabled: true,
      severity: 'medium',
      conditions: [{ id: 'c1', type: 'geographic_anomaly', operator: 'new_location', value: true }],
      actions: [
        {
          id: 'a1',
          type: 'email',
          config: { recipients: ['user', 'security@company.com'] },
          enabled: true,
        },
      ],
      cooldown: 60,
      schedule: {
        enabled: true,
        timezone: 'America/New_York',
        windows: [{ start: '00:00', end: '23:59', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }],
      },
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      createdBy: 'security@company.com',
      triggerCount: 156,
    },
    {
      id: 'rule-4',
      name: 'Large Data Export',
      description: 'Alert when data export exceeds threshold',
      category: 'data_protection',
      enabled: false,
      severity: 'high',
      conditions: [{ id: 'c1', type: 'data_export', operator: 'gte', value: 100, timeWindow: 60 }],
      actions: [
        { id: 'a1', type: 'email', config: { recipients: ['dlp@company.com'] }, enabled: true },
        {
          id: 'a2',
          type: 'webhook',
          config: { url: 'https://dlp.internal/webhook' },
          enabled: true,
        },
      ],
      cooldown: 30,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdBy: 'compliance@company.com',
      triggerCount: 8,
    },
  ];
}

function generateMockChannels(): NotificationChannel[] {
  return [
    {
      id: 'ch-1',
      name: 'Security Team Email',
      type: 'email',
      config: { recipients: ['security@company.com', 'soc@company.com'] },
      enabled: true,
      lastTested: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'ch-2',
      name: 'Security Alerts Slack',
      type: 'slack',
      config: { channel: '#security-alerts', workspace: 'company' },
      enabled: true,
      lastTested: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'ch-3',
      name: 'PagerDuty On-Call',
      type: 'pagerduty',
      config: { serviceKey: 'pd-***-***', escalationPolicy: 'security-oncall' },
      enabled: true,
    },
    {
      id: 'ch-4',
      name: 'SIEM Webhook',
      type: 'webhook',
      config: { url: 'https://siem.internal/api/events', headers: { 'X-API-Key': '***' } },
      enabled: true,
    },
  ];
}

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

// ============================================================================
// Sub-Components
// ============================================================================

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  readonly rule: AlertRule;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onDuplicate: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const severityConfig = SEVERITY_CONFIG[rule.severity];
  const category = RULE_CATEGORIES.find((c) => c.id === rule.category);
  const CategoryIcon = category?.icon || Shield;

  return (
    <div
      className={`rounded-lg border ${rule.enabled ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-300 opacity-60 dark:border-gray-600'} bg-white dark:bg-gray-800`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <div
              className={`rounded-lg p-2 ${rule.enabled ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              <CategoryIcon
                className={`h-5 w-5 ${rule.enabled ? 'text-blue-600' : 'text-gray-400'}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="truncate font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color}`}
                >
                  {severityConfig.label}
                </span>
              </div>
              <p className="line-clamp-1 text-sm text-gray-500">{rule.description}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                <span>Triggered {rule.triggerCount} times</span>
                {rule.lastTriggered && <span>Last: {formatDate(rule.lastTriggered)}</span>}
                <span>Cooldown: {rule.cooldown}m</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              className={`rounded-lg p-2 ${
                rule.enabled
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title={rule.enabled ? 'Disable rule' : 'Enable rule'}
              onClick={onToggle}
            >
              {rule.enabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-4 dark:border-gray-700">
          {/* Conditions */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Conditions
            </h4>
            <div className="space-y-2">
              {rule.conditions.map((condition) => {
                const condType = CONDITION_TYPES.find((c) => c.id === condition.type);
                return (
                  <div
                    key={condition.id}
                    className="flex items-center gap-2 rounded bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {condType?.label || condition.type}
                    </span>
                    <span className="text-gray-400">{condition.operator}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {String(condition.value)}
                    </span>
                    {Boolean(condition.timeWindow) && (
                      <span className="text-gray-400">within {condition.timeWindow} minutes</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </h4>
            <div className="flex flex-wrap gap-2">
              {rule.actions.map((action) => {
                const actionType = ACTION_TYPES.find((a) => a.id === action.type);
                const Icon = actionType?.icon || Bell;
                return (
                  <div
                    key={action.id}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                      action.enabled
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-400 line-through'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {actionType?.label || action.type}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schedule */}
          {rule.schedule?.enabled && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Schedule
              </h4>
              <div className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                Active:{' '}
                {rule.schedule.windows
                  .map((w) => `${w.days.join(', ')} ${w.start}-${w.end}`)
                  .join('; ')}
                <span className="ml-2 text-gray-400">({rule.schedule.timezone})</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4" />
              Edit Rule
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={onDuplicate}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            <button
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  onToggle,
  onTest,
  onEdit,
}: {
  readonly channel: NotificationChannel;
  readonly onToggle: () => void;
  readonly onTest: () => void;
  readonly onEdit: () => void;
}) {
  const iconMap: Record<string, typeof Mail> = {
    email: Mail,
    slack: MessageSquare,
    pagerduty: Smartphone,
    webhook: Webhook,
    sms: Smartphone,
    teams: MessageSquare,
  };
  const Icon = iconMap[channel.type] || Bell;

  return (
    <div
      className={`rounded-lg border p-4 ${
        channel.enabled
          ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
          : 'border-dashed border-gray-300 bg-gray-50 opacity-60 dark:border-gray-600 dark:bg-gray-900'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${channel.enabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Icon className={`h-5 w-5 ${channel.enabled ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{channel.name}</h4>
            <p className="text-sm capitalize text-gray-500">{channel.type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            onClick={onTest}
          >
            Test
          </button>
          <button
            className={`rounded-lg p-2 ${
              channel.enabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}
            onClick={onToggle}
          >
            {channel.enabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
          <button
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onEdit}
          >
            <Settings className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {channel.lastTested && (
        <p className="mt-2 text-xs text-gray-400">Last tested: {formatDate(channel.lastTested)}</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'channels' | 'escalation'>('rules');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setRules(generateMockRules());
      setChannels(generateMockChannels());
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredRules = rules.filter((rule) => {
    if (filterCategory !== 'all' && rule.category !== filterCategory) return false;
    if (searchQuery && !rule.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const toggleChannel = (id: string) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                href="/settings"
              >
                <ArrowLeft className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                  <Settings className="h-7 w-7 text-blue-600" />
                  Alert Configuration
                </h1>
                <p className="mt-1 text-gray-500">
                  Manage security alert rules and notification channels
                </p>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              <Plus className="h-5 w-5" />
              Create Rule
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="-mb-px flex items-center gap-6 border-b border-transparent">
            {[
              { id: 'rules', label: 'Alert Rules', count: rules.length },
              { id: 'channels', label: 'Notification Channels', count: channels.length },
              { id: 'escalation', label: 'Escalation Policies' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <>
            {/* Filters */}
            <div className="mb-6 flex items-center gap-4">
              <div className="relative flex-1">
                <input
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 dark:border-gray-600 dark:bg-gray-700"
                  placeholder="Search rules..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {RULE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rules Grid */}
            <div className="space-y-4">
              {isLoading && (
                <div className="py-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
              )}
              {!isLoading && filteredRules.length === 0 && (
                <div className="rounded-lg border border-gray-200 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
                  <Bell className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p className="text-gray-500">No rules found</p>
                </div>
              )}
              {!isLoading &&
                filteredRules.length > 0 &&
                filteredRules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onDelete={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                    onDuplicate={() => {
                      const newRule = {
                        ...rule,
                        id: `rule-${Date.now()}`,
                        name: `${rule.name} (Copy)`,
                      };
                      setRules((prev) => [...prev, newRule]);
                    }}
                    onEdit={() => {}}
                    onToggle={() => toggleRule(rule.id)}
                  />
                ))}
            </div>
          </>
        )}

        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Notification Channels
              </h2>
              <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
                <Plus className="h-4 w-4" />
                Add Channel
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onEdit={() => {}}
                  onTest={() => {}}
                  onToggle={() => toggleChannel(channel.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Escalation Tab */}
        {activeTab === 'escalation' && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <Users className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-xl font-medium text-gray-900 dark:text-white">
              Escalation Policies
            </h3>
            <p className="mx-auto mb-6 max-w-md text-gray-500">
              Configure escalation chains for critical alerts that need immediate attention
            </p>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Create Escalation Policy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
