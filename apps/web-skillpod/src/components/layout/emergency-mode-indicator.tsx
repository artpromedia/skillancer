/**
 * Emergency Mode Indicator Component
 *
 * Global indicator showing current lockdown/emergency status with
 * quick access to emergency controls.
 *
 * @module components/layout/emergency-mode-indicator
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type LockdownLevel = 'normal' | 'elevated' | 'high' | 'critical' | 'lockdown';

interface EmergencyState {
  level: LockdownLevel;
  activeKillSwitches: number;
  openIncidents: number;
  activatedAt?: Date;
  reason?: string;
}

interface EmergencyIndicatorProps {
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}

// ============================================================================
// Icons
// ============================================================================

function ShieldCheckIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function ShieldExclamationIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function LockClosedIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

// ============================================================================
// Level Configuration
// ============================================================================

const LEVEL_CONFIG: Record<
  LockdownLevel,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    icon: typeof ShieldCheckIcon;
    description: string;
    pulse: boolean;
  }
> = {
  normal: {
    label: 'Normal',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-800 dark:text-green-200',
    icon: ShieldCheckIcon,
    description: 'All systems operating normally',
    pulse: false,
  },
  elevated: {
    label: 'Elevated',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-800 dark:text-blue-200',
    icon: ShieldCheckIcon,
    description: 'Heightened awareness - monitor activity',
    pulse: false,
  },
  high: {
    label: 'High Alert',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    icon: ShieldExclamationIcon,
    description: 'Active security concern - some restrictions apply',
    pulse: false,
  },
  critical: {
    label: 'Critical',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-800 dark:text-orange-200',
    icon: ShieldExclamationIcon,
    description: 'Critical security event - major restrictions active',
    pulse: true,
  },
  lockdown: {
    label: 'LOCKDOWN',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-500 dark:border-red-600',
    textColor: 'text-red-800 dark:text-red-200',
    icon: LockClosedIcon,
    description: 'Full lockdown - all sessions paused, access restricted',
    pulse: true,
  },
};

// ============================================================================
// Component
// ============================================================================

export function EmergencyModeIndicator({
  className = '',
  compact = false,
  onClick,
}: EmergencyIndicatorProps) {
  const [state, setState] = useState<EmergencyState>({
    level: 'normal',
    activeKillSwitches: 0,
    openIncidents: 0,
  });

  // Fetch emergency state
  const fetchState = useCallback(async () => {
    try {
      const response = await fetch('/api/emergency/stats');
      if (response.ok) {
        const data = (await response.json()) as {
          currentLevel?: LockdownLevel;
          activeKillSwitches?: number;
          openIncidents?: number;
          activatedAt?: string;
          reason?: string;
        };
        setState({
          level: data.currentLevel || 'normal',
          activeKillSwitches: data.activeKillSwitches || 0,
          openIncidents: data.openIncidents || 0,
          activatedAt: data.activatedAt ? new Date(data.activatedAt) : undefined,
          reason: data.reason,
        });
      }
    } catch (error) {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    void fetchState();
    const interval = setInterval(() => void fetchState(), 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [fetchState]);

  // Real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/emergency/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          state: EmergencyState;
        };
        if (data.type === 'state_update') {
          setState(data.state);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    return () => eventSource.close();
  }, []);

  const config = LEVEL_CONFIG[state.level];
  const Icon = config.icon;
  const showIndicator = state.level !== 'normal';

  // Don't show anything in normal mode unless there are active concerns
  if (!showIndicator && state.activeKillSwitches === 0 && state.openIncidents === 0) {
    return null;
  }

  if (compact) {
    return (
      <button
        className={`
          relative inline-flex items-center justify-center rounded-lg p-2
          ${config.bgColor} ${config.borderColor} border
          transition-opacity hover:opacity-80
          ${config.pulse ? 'animate-pulse' : ''}
          ${className}
        `}
        title={config.description}
        onClick={onClick}
      >
        <Icon className={`h-5 w-5 ${config.color}`} />
        {showIndicator && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${config.color.replace('text-', 'bg-')} animate-ping opacity-75`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${config.color.replace('text-', 'bg-')}`}
            />
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      className={`
        flex w-full items-center gap-3 rounded-lg p-3
        ${config.bgColor} ${config.borderColor} border
        transition-opacity hover:opacity-90
        ${config.pulse ? 'animate-pulse' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className={`rounded-lg p-2 ${config.color.replace('text-', 'bg-')}/10`}>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${config.textColor}`}>{config.label}</span>
          {state.openIncidents > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
              {state.openIncidents} incident{state.openIncidents > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-600 dark:text-gray-400">{config.description}</p>
      </div>

      {state.activeKillSwitches > 0 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {state.activeKillSwitches}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Global Banner Component
// ============================================================================

export function EmergencyBanner() {
  const [state, setState] = useState<EmergencyState>({
    level: 'normal',
    activeKillSwitches: 0,
    openIncidents: 0,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch('/api/emergency/stats');
        if (response.ok) {
          const data = (await response.json()) as {
            currentLevel?: string;
            activeKillSwitches?: number;
            openIncidents?: number;
            reason?: string;
          };
          setState({
            level: (data.currentLevel as LockdownLevel) || 'normal',
            activeKillSwitches: data.activeKillSwitches || 0,
            openIncidents: data.openIncidents || 0,
            reason: data.reason,
          });
        }
      } catch (error) {
        // Silently fail
      }
    };

    void fetchState();
    const interval = setInterval(() => void fetchState(), 15000);
    return () => clearInterval(interval);
  }, []);

  // Only show banner for elevated levels
  if (state.level === 'normal' || state.level === 'elevated' || dismissed) {
    return null;
  }

  const config = LEVEL_CONFIG[state.level];
  const Icon = config.icon;

  return (
    <div
      className={`
        fixed left-0 right-0 top-0 z-50 px-4 py-2
        ${config.bgColor} ${config.borderColor} border-b
        ${config.pulse ? 'animate-pulse' : ''}
      `}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.color}`} />
          <div>
            <span className={`font-semibold ${config.textColor}`}>
              Security Status: {config.label}
            </span>
            {state.reason && (
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                — {state.reason}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            className={`text-sm font-medium ${config.textColor} hover:underline`}
            href="/settings/security"
          >
            View Details
          </a>
          <button
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => setDismissed(true)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Kill Switch Quick Access
// ============================================================================

export function KillSwitchQuickAccess({ className = '' }: Readonly<{ className?: string }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Check if any kill switch is active
    fetch('/api/emergency/kill-switches')
      .then((res) => res.json())
      .then((data: { status: string }[]) => {
        const active = data.some((ks) => ks.status === 'triggered');
        setIsActive(active);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isConfirming && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isConfirming, countdown]);

  const handleClick = () => {
    if (!isConfirming) {
      setIsConfirming(true);
      setCountdown(3);
    }
  };

  const handleConfirm = async () => {
    if (countdown === 0) {
      try {
        await fetch('/api/emergency/kill-switches/all/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Quick access activation' }),
        });
        setIsActive(true);
        setIsConfirming(false);
      } catch (error) {
        // Handle error
      }
    }
  };

  const handleCancel = () => {
    setIsConfirming(false);
    setCountdown(3);
  };

  if (isActive) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 dark:bg-red-900/30 ${className}`}
      >
        <span className="flex h-2 w-2">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-sm font-medium text-red-800 dark:text-red-200">
          Kill Switch Active
        </span>
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          className={`
            rounded-lg px-3 py-2 text-sm font-medium
            ${
              countdown > 0
                ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                : 'bg-red-600 text-white hover:bg-red-700'
            }
          `}
          disabled={countdown > 0}
          onClick={() => void handleConfirm()}
        >
          {countdown > 0 ? `Confirm (${countdown}s)` : 'CONFIRM'}
        </button>
        <button
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      className={`
        flex items-center gap-2 rounded-lg border-2 
        border-red-300 px-3 py-2 transition-colors
        hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20
        ${className}
      `}
      title="Emergency Kill Switch"
      onClick={handleClick}
    >
      <LockClosedIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
      <span className="text-sm font-medium text-red-600 dark:text-red-400">Emergency</span>
    </button>
  );
}

export default EmergencyModeIndicator;
