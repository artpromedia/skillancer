/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/label-has-associated-control */
'use client';

/**
 * Time Settings Page
 *
 * Configure time tracking preferences, default rates,
 * timer behaviors, and notification settings.
 *
 * @module app/settings/time/page
 */

import {
  type Clock,
  DollarSign,
  Bell,
  Timer,
  Calendar,
  Settings,
  Save,
  RotateCcw,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TimeSettings {
  // General
  defaultHourlyRate: number;
  defaultBillable: boolean;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  weekStartsOn: 'sunday' | 'monday';

  // Timer
  timerRounding: 'none' | '1min' | '5min' | '15min' | '30min';
  autoStartOnResume: boolean;
  showTimerInTab: boolean;
  confirmBeforeStop: boolean;

  // Notifications
  idleReminderEnabled: boolean;
  idleReminderMinutes: number;
  longRunningEnabled: boolean;
  longRunningMinutes: number;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  soundEnabled: boolean;

  // Display
  timeFormat: '12h' | '24h';
  durationFormat: 'hm' | 'decimal';
  defaultView: 'timesheet' | 'calendar' | 'list';
  showEarnings: boolean;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: TimeSettings = {
  defaultHourlyRate: 150,
  defaultBillable: true,
  workHoursPerDay: 8,
  workDaysPerWeek: 5,
  weekStartsOn: 'monday',

  timerRounding: 'none',
  autoStartOnResume: false,
  showTimerInTab: true,
  confirmBeforeStop: false,

  idleReminderEnabled: true,
  idleReminderMinutes: 30,
  longRunningEnabled: true,
  longRunningMinutes: 480,
  dailySummaryEnabled: false,
  dailySummaryTime: '18:00',
  soundEnabled: false,

  timeFormat: '12h',
  durationFormat: 'hm',
  defaultView: 'timesheet',
  showEarnings: true,
};

// ============================================================================
// Toggle Switch Component
// ============================================================================

function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <button
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
        type="button"
        onClick={() => onChange(!enabled)}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

// ============================================================================
// Settings Section Component
// ============================================================================

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Clock;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TimeSettingsPage() {
  const [settings, setSettings] = useState<TimeSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateSetting = <K extends keyof TimeSettings>(key: K, value: TimeSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = () => {
    // In a real app, this would save to the backend
    localStorage.setItem('timeSettings', JSON.stringify(settings));
    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(true);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Time Tracking Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure your time tracking preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!hasChanges}
            onClick={handleSave}
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <SettingsSection
          description="Default settings for time entries"
          icon={Settings}
          title="General"
        >
          <div className="space-y-6">
            {/* Default Hourly Rate */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Default Hourly Rate
              </label>
              <div className="relative max-w-xs">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  min={0}
                  step={1}
                  type="number"
                  value={settings.defaultHourlyRate}
                  onChange={(e) =>
                    updateSetting('defaultHourlyRate', Number.parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            {/* Work Hours */}
            <div className="grid max-w-md grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hours per Day
                </label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  max={24}
                  min={1}
                  type="number"
                  value={settings.workHoursPerDay}
                  onChange={(e) =>
                    updateSetting('workHoursPerDay', Number.parseInt(e.target.value) || 8)
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Days per Week
                </label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  max={7}
                  min={1}
                  type="number"
                  value={settings.workDaysPerWeek}
                  onChange={(e) =>
                    updateSetting('workDaysPerWeek', Number.parseInt(e.target.value) || 5)
                  }
                />
              </div>
            </div>

            {/* Week Starts On */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Week Starts On
              </label>
              <select
                className="max-w-xs rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={settings.weekStartsOn}
                onChange={(e) =>
                  updateSetting('weekStartsOn', e.target.value as 'sunday' | 'monday')
                }
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
              </select>
            </div>

            <ToggleSwitch
              description="New time entries will be marked as billable by default"
              enabled={settings.defaultBillable}
              label="Default to Billable"
              onChange={(v) => updateSetting('defaultBillable', v)}
            />
          </div>
        </SettingsSection>

        {/* Timer Settings */}
        <SettingsSection description="Configure timer behavior" icon={Timer} title="Timer">
          <div className="space-y-6">
            {/* Rounding */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Rounding
              </label>
              <select
                className="max-w-xs rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={settings.timerRounding}
                onChange={(e) =>
                  updateSetting('timerRounding', e.target.value as TimeSettings['timerRounding'])
                }
              >
                <option value="none">No rounding</option>
                <option value="1min">Round to 1 minute</option>
                <option value="5min">Round to 5 minutes</option>
                <option value="15min">Round to 15 minutes</option>
                <option value="30min">Round to 30 minutes</option>
              </select>
            </div>

            <ToggleSwitch
              description="Display elapsed time in the browser tab"
              enabled={settings.showTimerInTab}
              label="Show Timer in Tab Title"
              onChange={(v) => updateSetting('showTimerInTab', v)}
            />

            <ToggleSwitch
              description="Show confirmation dialog before stopping a timer"
              enabled={settings.confirmBeforeStop}
              label="Confirm Before Stopping"
              onChange={(v) => updateSetting('confirmBeforeStop', v)}
            />

            <ToggleSwitch
              description="Automatically restart timer when resuming from pause"
              enabled={settings.autoStartOnResume}
              label="Auto-start on Resume"
              onChange={(v) => updateSetting('autoStartOnResume', v)}
            />
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection description="Reminders and alerts" icon={Bell} title="Notifications">
          <div className="space-y-6">
            <ToggleSwitch
              description="Get reminded if timer is running but you seem idle"
              enabled={settings.idleReminderEnabled}
              label="Idle Reminder"
              onChange={(v) => updateSetting('idleReminderEnabled', v)}
            />

            {settings.idleReminderEnabled && (
              <div className="ml-6">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Remind after (minutes)
                </label>
                <input
                  className="max-w-[120px] rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  max={120}
                  min={5}
                  type="number"
                  value={settings.idleReminderMinutes}
                  onChange={(e) =>
                    updateSetting('idleReminderMinutes', Number.parseInt(e.target.value) || 30)
                  }
                />
              </div>
            )}

            <ToggleSwitch
              description="Get warned when timer runs for too long"
              enabled={settings.longRunningEnabled}
              label="Long Running Timer Warning"
              onChange={(v) => updateSetting('longRunningEnabled', v)}
            />

            {settings.longRunningEnabled && (
              <div className="ml-6">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Warn after (minutes)
                </label>
                <input
                  className="max-w-[120px] rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  max={1440}
                  min={60}
                  type="number"
                  value={settings.longRunningMinutes}
                  onChange={(e) =>
                    updateSetting('longRunningMinutes', Number.parseInt(e.target.value) || 480)
                  }
                />
              </div>
            )}

            <ToggleSwitch
              description="Receive a daily summary of your tracked time"
              enabled={settings.dailySummaryEnabled}
              label="Daily Summary"
              onChange={(v) => updateSetting('dailySummaryEnabled', v)}
            />

            {settings.dailySummaryEnabled && (
              <div className="ml-6">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Send at
                </label>
                <input
                  className="max-w-[150px] rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  type="time"
                  value={settings.dailySummaryTime}
                  onChange={(e) => updateSetting('dailySummaryTime', e.target.value)}
                />
              </div>
            )}

            <ToggleSwitch
              description="Play a sound when notifications are shown"
              enabled={settings.soundEnabled}
              label="Sound Notifications"
              onChange={(v) => updateSetting('soundEnabled', v)}
            />
          </div>
        </SettingsSection>

        {/* Display Settings */}
        <SettingsSection
          description="Customize how time is displayed"
          icon={Calendar}
          title="Display"
        >
          <div className="space-y-6">
            {/* Time Format */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Format
              </label>
              <select
                className="max-w-xs rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={settings.timeFormat}
                onChange={(e) => updateSetting('timeFormat', e.target.value as '12h' | '24h')}
              >
                <option value="12h">12-hour (3:00 PM)</option>
                <option value="24h">24-hour (15:00)</option>
              </select>
            </div>

            {/* Duration Format */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Duration Format
              </label>
              <select
                className="max-w-xs rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={settings.durationFormat}
                onChange={(e) =>
                  updateSetting('durationFormat', e.target.value as 'hm' | 'decimal')
                }
              >
                <option value="hm">Hours:Minutes (2h 30m)</option>
                <option value="decimal">Decimal (2.5h)</option>
              </select>
            </div>

            {/* Default View */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Default View
              </label>
              <select
                className="max-w-xs rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={settings.defaultView}
                onChange={(e) =>
                  updateSetting('defaultView', e.target.value as 'timesheet' | 'calendar' | 'list')
                }
              >
                <option value="timesheet">Timesheet</option>
                <option value="calendar">Calendar</option>
                <option value="list">List</option>
              </select>
            </div>

            <ToggleSwitch
              description="Display estimated earnings in time tracking views"
              enabled={settings.showEarnings}
              label="Show Earnings"
              onChange={(v) => updateSetting('showEarnings', v)}
            />
          </div>
        </SettingsSection>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="border-b border-red-200 px-6 py-4 dark:border-red-900/50">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">Danger Zone</h3>
                <p className="text-sm text-red-700 dark:text-red-300">Irreversible actions</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-200">
                  Clear All Time Entries
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Permanently delete all your time tracking data
                </p>
              </div>
              <button
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/30"
                onClick={() => {
                  if (
                    confirm(
                      'Are you sure? This will permanently delete all time entries. This cannot be undone.'
                    )
                  ) {
                    // Clear all entries
                    localStorage.removeItem('timeEntries');
                    alert('All time entries have been deleted.');
                  }
                }}
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
