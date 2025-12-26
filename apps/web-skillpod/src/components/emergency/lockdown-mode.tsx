/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Lockdown Mode Component
 *
 * Enterprise-grade lockdown mode controls for activating
 * various security postures during incidents or threats.
 *
 * @module components/emergency/lockdown-mode
 */

import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Lock,
  Unlock,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Users,
  Monitor,
  Wifi,
  WifiOff,
  Download,
  Upload,
  Terminal,
  Eye,
  EyeOff,
  Settings,
  ChevronRight,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bell,
  MessageSquare,
  Phone,
  Mail,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type LockdownLevel = 'normal' | 'elevated' | 'high' | 'critical' | 'lockdown';

interface LockdownState {
  level: LockdownLevel;
  activatedAt?: Date;
  activatedBy?: string;
  reason?: string;
  autoEscalate: boolean;
  scheduledEnd?: Date;
  restrictions: LockdownRestriction[];
}

interface LockdownRestriction {
  id: string;
  name: string;
  description: string;
  icon: typeof Lock;
  enabledAtLevel: LockdownLevel;
  currentlyActive: boolean;
  canOverride: boolean;
}

interface IncidentContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  available: boolean;
  responseTime?: string;
}

interface LockdownModeProps {
  organizationId?: string;
  onLevelChange?: (level: LockdownLevel, reason: string) => Promise<void>;
  onNotify?: (contacts: string[], message: string) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const LOCKDOWN_LEVELS: {
  level: LockdownLevel;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Shield;
}[] = [
  {
    level: 'normal',
    label: 'Normal',
    description: 'Standard security posture, all features enabled',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-500',
    icon: ShieldCheck,
  },
  {
    level: 'elevated',
    label: 'Elevated',
    description: 'Enhanced monitoring, additional logging enabled',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-500',
    icon: Shield,
  },
  {
    level: 'high',
    label: 'High',
    description: 'Restricted operations, MFA required for all actions',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-500',
    icon: ShieldAlert,
  },
  {
    level: 'critical',
    label: 'Critical',
    description: 'Limited functionality, admin approval required',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-500',
    icon: AlertTriangle,
  },
  {
    level: 'lockdown',
    label: 'Full Lockdown',
    description: 'Emergency mode - all non-essential operations suspended',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-500',
    icon: AlertOctagon,
  },
];

const DEFAULT_RESTRICTIONS: LockdownRestriction[] = [
  {
    id: 'enhanced-logging',
    name: 'Enhanced Logging',
    description: 'All user actions logged with full detail',
    icon: Activity,
    enabledAtLevel: 'elevated',
    currentlyActive: false,
    canOverride: false,
  },
  {
    id: 'session-recording',
    name: 'Mandatory Session Recording',
    description: 'All sessions are recorded regardless of settings',
    icon: Monitor,
    enabledAtLevel: 'elevated',
    currentlyActive: false,
    canOverride: false,
  },
  {
    id: 'mfa-required',
    name: 'MFA Required for All Actions',
    description: 'Multi-factor authentication for every sensitive operation',
    icon: Lock,
    enabledAtLevel: 'high',
    currentlyActive: false,
    canOverride: false,
  },
  {
    id: 'export-disabled',
    name: 'Data Export Disabled',
    description: 'All data export functionality is blocked',
    icon: Download,
    enabledAtLevel: 'high',
    currentlyActive: false,
    canOverride: true,
  },
  {
    id: 'upload-disabled',
    name: 'File Upload Disabled',
    description: 'All file uploads are blocked',
    icon: Upload,
    enabledAtLevel: 'critical',
    currentlyActive: false,
    canOverride: true,
  },
  {
    id: 'network-restricted',
    name: 'Network Access Restricted',
    description: 'External network access limited to allowlist',
    icon: WifiOff,
    enabledAtLevel: 'critical',
    currentlyActive: false,
    canOverride: true,
  },
  {
    id: 'terminal-disabled',
    name: 'Terminal Access Disabled',
    description: 'Command line access is completely blocked',
    icon: Terminal,
    enabledAtLevel: 'lockdown',
    currentlyActive: false,
    canOverride: false,
  },
  {
    id: 'readonly-mode',
    name: 'Read-Only Mode',
    description: 'All write operations are suspended',
    icon: Eye,
    enabledAtLevel: 'lockdown',
    currentlyActive: false,
    canOverride: false,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getLevelIndex(level: LockdownLevel): number {
  return LOCKDOWN_LEVELS.findIndex((l) => l.level === level);
}

function isRestrictionActive(
  restriction: LockdownRestriction,
  currentLevel: LockdownLevel
): boolean {
  const restrictionLevelIndex = getLevelIndex(restriction.enabledAtLevel);
  const currentLevelIndex = getLevelIndex(currentLevel);
  return currentLevelIndex >= restrictionLevelIndex;
}

function formatTimeRemaining(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

// ============================================================================
// Mock Data
// ============================================================================

function generateMockContacts(): IncidentContact[] {
  return [
    {
      id: 'c-1',
      name: 'Sarah Chen',
      role: 'Security Lead',
      email: 'sarah.chen@company.com',
      phone: '+1-555-0101',
      available: true,
      responseTime: '< 5 min',
    },
    {
      id: 'c-2',
      name: 'Marcus Johnson',
      role: 'SOC Manager',
      email: 'marcus.j@company.com',
      phone: '+1-555-0102',
      available: true,
      responseTime: '< 10 min',
    },
    {
      id: 'c-3',
      name: 'Emily Roberts',
      role: 'CISO',
      email: 'emily.roberts@company.com',
      phone: '+1-555-0103',
      available: false,
      responseTime: '< 30 min',
    },
    {
      id: 'c-4',
      name: 'On-Call Team',
      role: 'Security On-Call',
      email: 'oncall@company.com',
      phone: '+1-555-0199',
      available: true,
      responseTime: '< 15 min',
    },
  ];
}

// ============================================================================
// Sub-Components
// ============================================================================

function LevelSelector({
  currentLevel,
  onSelect,
  disabled,
}: {
  currentLevel: LockdownLevel;
  onSelect: (level: LockdownLevel) => void;
  disabled?: boolean;
}) {
  const currentIndex = getLevelIndex(currentLevel);

  return (
    <div className="space-y-2">
      {LOCKDOWN_LEVELS.map((level, index) => {
        const Icon = level.icon;
        const isSelected = level.level === currentLevel;
        const isLower = index < currentIndex;

        return (
          <button
            key={level.level}
            className={`flex w-full items-center gap-4 rounded-lg border-2 p-4 transition-all ${
              isSelected
                ? `${level.borderColor} ${level.bgColor}`
                : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            disabled={disabled}
            onClick={() => onSelect(level.level)}
          >
            <div
              className={`rounded-lg p-2 ${isSelected ? level.bgColor : 'bg-gray-100 dark:bg-gray-700'}`}
            >
              <Icon className={`h-5 w-5 ${isSelected ? level.color : 'text-gray-500'}`} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium ${isSelected ? level.color : 'text-gray-900 dark:text-white'}`}
                >
                  {level.label}
                </span>
                {isSelected && (
                  <span className="rounded bg-white px-2 py-0.5 text-xs shadow-sm dark:bg-gray-800">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{level.description}</p>
            </div>
            {!isSelected && <ChevronRight className="h-5 w-5 text-gray-400" />}
          </button>
        );
      })}
    </div>
  );
}

function RestrictionsPanel({
  restrictions,
  currentLevel,
  onOverride,
}: {
  restrictions: LockdownRestriction[];
  currentLevel: LockdownLevel;
  onOverride: (id: string, enabled: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
          <Settings className="h-5 w-5 text-gray-500" />
          Active Restrictions
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {restrictions.map((restriction) => {
          const Icon = restriction.icon;
          const isActive = isRestrictionActive(restriction, currentLevel);
          const levelConfig = LOCKDOWN_LEVELS.find((l) => l.level === restriction.enabledAtLevel);

          return (
            <div
              key={restriction.id}
              className={`flex items-center gap-4 p-4 ${
                isActive ? 'bg-gray-50 dark:bg-gray-900/50' : ''
              }`}
            >
              <div
                className={`rounded-lg p-2 ${
                  isActive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                    }`}
                  >
                    {restriction.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${levelConfig?.bgColor} ${levelConfig?.color}`}
                  >
                    {levelConfig?.label}+
                  </span>
                </div>
                <p className="text-xs text-gray-500">{restriction.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {isActive ? (
                  restriction.canOverride ? (
                    <button
                      className="rounded px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      onClick={() => onOverride(restriction.id, false)}
                    >
                      Override
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  )
                ) : (
                  <span className="text-xs text-gray-400">Inactive</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncidentResponsePanel({
  contacts,
  onNotify,
}: {
  contacts: IncidentContact[];
  onNotify: (contactIds: string[]) => void;
}) {
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const toggleContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
          <Bell className="h-5 w-5 text-gray-500" />
          Incident Response Team
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {contacts.map((contact) => (
          <div key={contact.id} className="flex items-center gap-4 p-4">
            <input
              checked={selectedContacts.has(contact.id)}
              className="h-4 w-4 rounded text-blue-600"
              type="checkbox"
              onChange={() => toggleContact(contact.id)}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">{contact.name}</span>
                {contact.available ? (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500">
                {contact.role} • {contact.responseTime}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Mail className="h-4 w-4 text-gray-400" />
              </button>
              {contact.phone && (
                <button className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Phone className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <button
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 ${
            selectedContacts.size > 0
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'cursor-not-allowed bg-gray-100 text-gray-400'
          }`}
          disabled={selectedContacts.size === 0}
          onClick={() => onNotify(Array.from(selectedContacts))}
        >
          <Bell className="h-4 w-4" />
          Notify Selected ({selectedContacts.size})
        </button>
      </div>
    </div>
  );
}

function StatusBanner({ state }: { state: LockdownState }) {
  const levelConfig = LOCKDOWN_LEVELS.find((l) => l.level === state.level);
  if (!levelConfig || state.level === 'normal') return null;

  const Icon = levelConfig.icon;

  return (
    <div className={`rounded-lg border-2 p-4 ${levelConfig.borderColor} ${levelConfig.bgColor}`}>
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
          <Icon className={`h-6 w-6 ${levelConfig.color}`} />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className={`text-lg font-bold ${levelConfig.color}`}>
              {levelConfig.label} Security Level Active
            </h3>
          </div>
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            {state.reason || levelConfig.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {state.activatedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Activated: {new Date(state.activatedAt).toLocaleString()}
              </span>
            )}
            {state.activatedBy && <span>By: {state.activatedBy}</span>}
            {state.scheduledEnd && (
              <span className="flex items-center gap-1 text-yellow-600">
                <Clock className="h-3 w-3" />
                {formatTimeRemaining(state.scheduledEnd)}
              </span>
            )}
          </div>
        </div>
        <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700">
          View Details
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LockdownMode({ organizationId, onLevelChange, onNotify }: LockdownModeProps) {
  const [state, setState] = useState<LockdownState>({
    level: 'normal',
    autoEscalate: true,
    restrictions: DEFAULT_RESTRICTIONS,
  });
  const [contacts, setContacts] = useState<IncidentContact[]>([]);
  const [isChangingLevel, setIsChangingLevel] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<LockdownLevel | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState<number | null>(null);

  useEffect(() => {
    setContacts(generateMockContacts());
  }, []);

  const handleLevelChange = async (newLevel: LockdownLevel) => {
    if (newLevel === state.level) return;

    const newLevelIndex = getLevelIndex(newLevel);
    const currentLevelIndex = getLevelIndex(state.level);

    // Escalating requires confirmation
    if (newLevelIndex > currentLevelIndex) {
      setPendingLevel(newLevel);
      setIsChangingLevel(true);
      return;
    }

    // De-escalating can proceed
    await confirmLevelChange(newLevel, 'De-escalation');
  };

  const confirmLevelChange = async (level: LockdownLevel, reason: string) => {
    const scheduledEnd = scheduleDuration
      ? new Date(Date.now() + scheduleDuration * 60 * 60 * 1000)
      : undefined;

    setState((prev) => ({
      ...prev,
      level,
      activatedAt: new Date(),
      activatedBy: 'current.user@company.com',
      reason,
      scheduledEnd,
    }));

    setIsChangingLevel(false);
    setPendingLevel(null);
    setChangeReason('');
    setScheduleDuration(null);

    if (onLevelChange) {
      await onLevelChange(level, reason);
    }
  };

  const handleOverride = (restrictionId: string, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      restrictions: prev.restrictions.map((r) =>
        r.id === restrictionId ? { ...r, currentlyActive: enabled } : r
      ),
    }));
  };

  const handleNotifyContacts = (contactIds: string[]) => {
    if (onNotify) {
      onNotify(contactIds, `Security level changed to ${state.level}`);
    }
  };

  const pendingLevelConfig = pendingLevel
    ? LOCKDOWN_LEVELS.find((l) => l.level === pendingLevel)
    : null;

  return (
    <div className="space-y-6">
      {/* Current Status Banner */}
      <StatusBanner state={state} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Level Selector */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white">
              <Shield className="h-5 w-5 text-blue-600" />
              Security Level
            </h2>
            <LevelSelector currentLevel={state.level} onSelect={handleLevelChange} />
          </div>
        </div>

        {/* Incident Response */}
        <div>
          <IncidentResponsePanel contacts={contacts} onNotify={handleNotifyContacts} />
        </div>
      </div>

      {/* Restrictions */}
      <RestrictionsPanel
        currentLevel={state.level}
        restrictions={state.restrictions}
        onOverride={handleOverride}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Active Sessions</span>
            <Monitor className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">147</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Active Users</span>
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">89</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Pending Alerts</span>
            <Bell className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">12</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Active Restrictions</span>
            <Lock className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {state.restrictions.filter((r) => isRestrictionActive(r, state.level)).length}
          </span>
        </div>
      </div>

      {/* Level Change Modal */}
      {isChangingLevel && pendingLevel && pendingLevelConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-800">
            <div
              className={`border-b border-gray-200 p-6 dark:border-gray-700 ${pendingLevelConfig.bgColor} rounded-t-xl`}
            >
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-white p-3 shadow dark:bg-gray-800">
                  {(() => {
                    const Icon = pendingLevelConfig.icon;
                    return <Icon className={`h-8 w-8 ${pendingLevelConfig.color}`} />;
                  })()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Escalate to {pendingLevelConfig.label}
                  </h2>
                  <p className={pendingLevelConfig.color}>{pendingLevelConfig.description}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason for escalation <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  placeholder="Describe the security incident or threat..."
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Duration (optional)
                </label>
                <div className="flex gap-2">
                  {[1, 4, 8, 24].map((hours) => (
                    <button
                      key={hours}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        scheduleDuration === hours
                          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                          : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                      }`}
                      onClick={() => setScheduleDuration(hours)}
                    >
                      {hours}h
                    </button>
                  ))}
                  <button
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      scheduleDuration === null
                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                        : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                    }`}
                    onClick={() => setScheduleDuration(null)}
                  >
                    Manual
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    This action will be logged and may trigger automated incident response
                    procedures.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 p-6 dark:border-gray-700">
              <button
                className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => {
                  setIsChangingLevel(false);
                  setPendingLevel(null);
                  setChangeReason('');
                }}
              >
                Cancel
              </button>
              <button
                className={`flex items-center gap-2 rounded-lg px-6 py-2 ${
                  changeReason.trim()
                    ? `${pendingLevelConfig.bgColor} ${pendingLevelConfig.color} border-2 ${pendingLevelConfig.borderColor} hover:opacity-90`
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                }`}
                disabled={!changeReason.trim()}
                onClick={() => confirmLevelChange(pendingLevel, changeReason)}
              >
                <Lock className="h-4 w-4" />
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
