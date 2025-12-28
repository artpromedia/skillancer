/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Kill Switch Panel Component
 *
 * Emergency kill switch controls for immediately terminating
 * all active sessions, disabling access, or triggering
 * incident response protocols.
 *
 * @module components/emergency/kill-switch-panel
 */

import {
  Power,
  AlertOctagon,
  Shield,
  Users,
  Monitor,
  Lock,
  Unlock,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  Phone,
  Mail,
  History,
  ArrowRight,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface KillSwitchConfig {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'organization' | 'team' | 'user';
  type: 'session' | 'access' | 'data' | 'network';
  status: 'active' | 'inactive' | 'triggered' | 'cooldown';
  triggeredAt?: Date;
  triggeredBy?: string;
  cooldownMinutes: number;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  approvers?: string[];
  autoRevert: boolean;
  autoRevertMinutes?: number;
  affectedCount?: number;
  lastTriggered?: Date;
}

interface KillSwitchHistory {
  id: string;
  switchId: string;
  switchName: string;
  action: 'triggered' | 'reverted' | 'approved' | 'rejected';
  timestamp: Date;
  user: string;
  reason?: string;
  affectedCount?: number;
  duration?: number;
}

interface KillSwitchPanelProps {
  organizationId?: string;
  onTrigger?: (switchId: string, reason: string) => Promise<void>;
  onRevert?: (switchId: string) => Promise<void>;
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SWITCH_TYPE_CONFIG = {
  session: {
    icon: Monitor,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Session',
  },
  access: {
    icon: Lock,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    label: 'Access',
  },
  data: {
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    label: 'Data',
  },
  network: {
    icon: Activity,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    label: 'Network',
  },
};

const STATUS_CONFIG = {
  active: { label: 'Ready', color: 'text-green-600', bgColor: 'bg-green-100' },
  inactive: { label: 'Disabled', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  triggered: { label: 'TRIGGERED', color: 'text-red-600', bgColor: 'bg-red-100' },
  cooldown: { label: 'Cooldown', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
};

// ============================================================================
// Mock Data
// ============================================================================

function generateMockSwitches(): KillSwitchConfig[] {
  return [
    {
      id: 'ks-1',
      name: 'Global Session Termination',
      description: 'Immediately terminate all active VDI sessions across the platform',
      scope: 'global',
      type: 'session',
      status: 'active',
      cooldownMinutes: 5,
      requiresConfirmation: true,
      requiresApproval: false,
      autoRevert: false,
      affectedCount: 147,
      lastTriggered: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'ks-2',
      name: 'Emergency Access Lockout',
      description: 'Revoke all user access tokens and force re-authentication',
      scope: 'global',
      type: 'access',
      status: 'active',
      cooldownMinutes: 15,
      requiresConfirmation: true,
      requiresApproval: true,
      approvers: ['security@company.com', 'cto@company.com'],
      autoRevert: true,
      autoRevertMinutes: 60,
      affectedCount: 1247,
    },
    {
      id: 'ks-3',
      name: 'Data Export Block',
      description: 'Block all data export and download operations',
      scope: 'global',
      type: 'data',
      status: 'triggered',
      triggeredAt: new Date(Date.now() - 30 * 60000),
      triggeredBy: 'security@company.com',
      cooldownMinutes: 0,
      requiresConfirmation: true,
      requiresApproval: false,
      autoRevert: true,
      autoRevertMinutes: 120,
    },
    {
      id: 'ks-4',
      name: 'Network Isolation',
      description: 'Isolate all pods from external network access',
      scope: 'organization',
      type: 'network',
      status: 'active',
      cooldownMinutes: 10,
      requiresConfirmation: true,
      requiresApproval: true,
      approvers: ['security@company.com'],
      autoRevert: false,
      affectedCount: 42,
    },
    {
      id: 'ks-5',
      name: 'Team Session Pause',
      description: 'Pause all sessions for a specific team',
      scope: 'team',
      type: 'session',
      status: 'cooldown',
      cooldownMinutes: 5,
      requiresConfirmation: false,
      requiresApproval: false,
      autoRevert: true,
      autoRevertMinutes: 30,
      lastTriggered: new Date(Date.now() - 3 * 60000),
    },
  ];
}

function generateMockHistory(): KillSwitchHistory[] {
  return [
    {
      id: 'h-1',
      switchId: 'ks-3',
      switchName: 'Data Export Block',
      action: 'triggered',
      timestamp: new Date(Date.now() - 30 * 60000),
      user: 'security@company.com',
      reason: 'Suspected data breach investigation',
      affectedCount: 1247,
    },
    {
      id: 'h-2',
      switchId: 'ks-5',
      switchName: 'Team Session Pause',
      action: 'triggered',
      timestamp: new Date(Date.now() - 3 * 60000),
      user: 'manager@company.com',
      reason: 'Compliance audit in progress',
      affectedCount: 12,
    },
    {
      id: 'h-3',
      switchId: 'ks-1',
      switchName: 'Global Session Termination',
      action: 'triggered',
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      user: 'admin@company.com',
      reason: 'Security incident response',
      affectedCount: 89,
      duration: 45,
    },
    {
      id: 'h-4',
      switchId: 'ks-1',
      switchName: 'Global Session Termination',
      action: 'reverted',
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 45 * 60000),
      user: 'admin@company.com',
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function KillSwitchCard({
  config,
  onTrigger,
  onRevert,
  isExpanded,
  onToggleExpand,
}: {
  config: KillSwitchConfig;
  onTrigger: () => void;
  onRevert: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const typeConfig = SWITCH_TYPE_CONFIG[config.type];
  const statusConfig = STATUS_CONFIG[config.status];
  const TypeIcon = typeConfig.icon;

  const isTriggered = config.status === 'triggered';
  const isCooldown = config.status === 'cooldown';
  const canTrigger = config.status === 'active';

  return (
    <div
      className={`overflow-hidden rounded-lg border-2 transition-all ${
        isTriggered
          ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
          : isCooldown
            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <button className="flex w-full items-start gap-4 p-4 text-left" onClick={onToggleExpand}>
        {/* Icon */}
        <div className={`rounded-lg p-3 ${typeConfig.bgColor}`}>
          <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{config.name}</h3>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {config.scope}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{config.description}</p>
          {isTriggered && config.triggeredAt && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
              <AlertOctagon className="h-4 w-4" />
              Triggered {formatTimeAgo(config.triggeredAt)} by {config.triggeredBy}
            </div>
          )}
          {config.affectedCount !== undefined && !isTriggered && (
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <Users className="h-3 w-3" />
              Would affect ~{config.affectedCount} active sessions
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-4 dark:border-gray-700">
          {/* Details Grid */}
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <span className="block text-xs text-gray-500">Type</span>
              <span className="text-sm capitalize text-gray-900 dark:text-white">
                {config.type}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Cooldown</span>
              <span className="text-sm text-gray-900 dark:text-white">
                {config.cooldownMinutes} minutes
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Requires Approval</span>
              <span className="text-sm text-gray-900 dark:text-white">
                {config.requiresApproval ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Auto Revert</span>
              <span className="text-sm text-gray-900 dark:text-white">
                {config.autoRevert ? `After ${config.autoRevertMinutes}m` : 'Manual'}
              </span>
            </div>
          </div>

          {/* Approval Chain */}
          {config.requiresApproval && config.approvers && (
            <div className="mb-4 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Requires approval from:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.approvers.map((approver) => (
                  <span
                    key={approver}
                    className="rounded border border-yellow-300 bg-white px-2 py-1 text-xs dark:border-yellow-600 dark:bg-gray-800"
                  >
                    {approver}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {isTriggered ? (
              <button
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onRevert();
                }}
              >
                <Unlock className="h-4 w-4" />
                Revert & Restore Access
              </button>
            ) : (
              <button
                className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
                  canTrigger
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                }`}
                disabled={!canTrigger}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrigger();
                }}
              >
                <Power className="h-4 w-4" />
                Trigger Kill Switch
              </button>
            )}
            {config.lastTriggered && !isTriggered && (
              <span className="text-xs text-gray-500">
                Last triggered: {formatTimeAgo(config.lastTriggered)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmationModal({
  config,
  onConfirm,
  onCancel,
}: {
  config: KillSwitchConfig;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!confirmed) return;
    if (countdown <= 0) return;

    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [confirmed, countdown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        {/* Header */}
        <div className="rounded-t-xl border-b border-gray-200 bg-red-50 p-6 dark:border-gray-700 dark:bg-red-900/20">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
              <AlertOctagon className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Confirm Kill Switch Activation
              </h2>
              <p className="font-medium text-red-600">{config.name}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This action will {config.description.toLowerCase()}.
                {config.affectedCount && (
                  <span className="mt-1 block">
                    Approximately <strong>{config.affectedCount}</strong> active sessions will be
                    affected.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="kill-switch-reason"
            >
              Reason for activation <span className="text-red-500">*</span>
            </label>
            <textarea
              className="h-24 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              id="kill-switch-reason"
              placeholder="Describe the security incident or reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              checked={confirmed}
              className="mt-0.5 h-5 w-5 rounded text-red-600"
              type="checkbox"
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I understand this is an emergency action and will be logged in the audit trail. I
              confirm this action is necessary and authorized.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 p-6 dark:border-gray-700">
          <button
            className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`flex items-center gap-2 rounded-lg px-6 py-2 ${
              confirmed && reason.trim() && countdown <= 0
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
            disabled={!confirmed || !reason.trim() || countdown > 0}
            onClick={() => onConfirm(reason)}
          >
            <Power className="h-4 w-4" />
            {countdown > 0 ? `Wait ${countdown}s...` : 'Activate Kill Switch'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ history }: Readonly<{ history: KillSwitchHistory[] }>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
          <History className="h-5 w-5 text-gray-500" />
          Recent Activity
        </h3>
      </div>
      <div className="max-h-80 divide-y divide-gray-100 overflow-auto dark:divide-gray-700">
        {history.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 p-4">
            <div
              className={`rounded p-1.5 ${
                entry.action === 'triggered'
                  ? 'bg-red-100'
                  : entry.action === 'reverted'
                    ? 'bg-green-100'
                    : entry.action === 'approved'
                      ? 'bg-blue-100'
                      : 'bg-gray-100'
              }`}
            >
              {entry.action === 'triggered' ? (
                <Power className="h-4 w-4 text-red-600" />
              ) : entry.action === 'reverted' ? (
                <Unlock className="h-4 w-4 text-green-600" />
              ) : entry.action === 'approved' ? (
                <CheckCircle className="h-4 w-4 text-blue-600" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {entry.switchName}
                </span>
                <span
                  className={`text-xs capitalize ${
                    entry.action === 'triggered'
                      ? 'text-red-600'
                      : entry.action === 'reverted'
                        ? 'text-green-600'
                        : 'text-gray-600'
                  }`}
                >
                  {entry.action}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {entry.user} • {formatTimeAgo(entry.timestamp)}
                {entry.affectedCount && ` • ${entry.affectedCount} affected`}
                {entry.duration && ` • Duration: ${entry.duration}m`}
              </p>
              {entry.reason && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  &ldquo;{entry.reason}&rdquo;
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function KillSwitchPanel({
  organizationId,
  onTrigger,
  onRevert,
  compact = false,
}: KillSwitchPanelProps) {
  const [switches, setSwitches] = useState<KillSwitchConfig[]>([]);
  const [history, setHistory] = useState<KillSwitchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSwitches, setExpandedSwitches] = useState<Set<string>>(new Set());
  const [confirmingSwitch, setConfirmingSwitch] = useState<KillSwitchConfig | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setSwitches(generateMockSwitches());
      setHistory(generateMockHistory());
      setIsLoading(false);
    }, 500);
  }, []);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSwitches);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSwitches(newExpanded);
  };

  const handleTrigger = (config: KillSwitchConfig) => {
    if (config.requiresConfirmation) {
      setConfirmingSwitch(config);
    } else {
      void confirmTrigger(config.id, 'Quick trigger');
    }
  };

  const confirmTrigger = async (switchId: string, reason: string) => {
    setConfirmingSwitch(null);

    setSwitches((prev) =>
      prev.map((s) =>
        s.id === switchId
          ? {
              ...s,
              status: 'triggered' as const,
              triggeredAt: new Date(),
              triggeredBy: 'current.user@company.com',
            }
          : s
      )
    );

    if (onTrigger) {
      await onTrigger(switchId, reason);
    }
  };

  const handleRevert = async (switchId: string) => {
    setSwitches((prev) =>
      prev.map((s) =>
        s.id === switchId
          ? { ...s, status: 'active' as const, triggeredAt: undefined, triggeredBy: undefined }
          : s
      )
    );

    if (onRevert) {
      await onRevert(switchId);
    }
  };

  const triggeredCount = switches.filter((s) => s.status === 'triggered').length;

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className="h-5 w-5 text-red-600" />
            <h3 className="font-medium text-gray-900 dark:text-white">Kill Switches</h3>
          </div>
          {triggeredCount > 0 && (
            <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
              {triggeredCount} Active
            </span>
          )}
        </div>
        <div className="space-y-2">
          {switches.slice(0, 3).map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between rounded p-2 ${
                s.status === 'triggered'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : 'bg-gray-50 dark:bg-gray-700'
              }`}
            >
              <span className="truncate text-sm text-gray-900 dark:text-white">{s.name}</span>
              <span className={`text-xs ${STATUS_CONFIG[s.status].color}`}>
                {STATUS_CONFIG[s.status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Switches</span>
            <Power className="h-5 w-5 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {switches.length}
          </span>
        </div>
        <div
          className={`rounded-lg border p-4 ${
            triggeredCount > 0
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Currently Triggered</span>
            <AlertOctagon
              className={`h-5 w-5 ${triggeredCount > 0 ? 'text-red-600' : 'text-gray-400'}`}
            />
          </div>
          <span
            className={`text-2xl font-bold ${triggeredCount > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
          >
            {triggeredCount}
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ready</span>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {switches.filter((s) => s.status === 'active').length}
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">In Cooldown</span>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {switches.filter((s) => s.status === 'cooldown').length}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kill Switches */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white">
            <Zap className="h-5 w-5 text-red-600" />
            Emergency Controls
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {switches.map((sw) => (
                <KillSwitchCard
                  key={sw.id}
                  config={sw}
                  isExpanded={expandedSwitches.has(sw.id)}
                  onRevert={() => handleRevert(sw.id)}
                  onToggleExpand={() => toggleExpand(sw.id)}
                  onTrigger={() => handleTrigger(sw)}
                />
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <HistoryPanel history={history} />
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmingSwitch && (
        <ConfirmationModal
          config={confirmingSwitch}
          onCancel={() => setConfirmingSwitch(null)}
          onConfirm={(reason) => confirmTrigger(confirmingSwitch.id, reason)}
        />
      )}
    </div>
  );
}
