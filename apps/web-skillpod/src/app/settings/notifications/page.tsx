/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Notification Settings Page
 *
 * Configure user notification preferences for security alerts,
 * compliance updates, and system notifications.
 *
 * @module app/settings/notifications/page
 */

import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Monitor,
  ArrowLeft,
  Check,
  Clock,
  Moon,
  Sun,
  AlertTriangle,
  Shield,
  Activity,
  FileText,
  Users,
  Settings,
  Volume2,
  VolumeX,
  Save,
  RefreshCw,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface NotificationChannel {
  id: string;
  type: 'email' | 'push' | 'sms' | 'slack' | 'in_app';
  label: string;
  icon: typeof Mail;
  enabled: boolean;
  config?: Record<string, unknown>;
}

interface NotificationCategory {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  channels: {
    email: boolean;
    push: boolean;
    sms: boolean;
    slack: boolean;
    in_app: boolean;
  };
  frequency: 'instant' | 'digest' | 'daily' | 'weekly';
  priority: 'all' | 'high_only' | 'critical_only';
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  allowCritical: boolean;
  days: string[];
}

// ============================================================================
// Constants
// ============================================================================

const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  { id: 'email', type: 'email', label: 'Email', icon: Mail, enabled: true },
  { id: 'push', type: 'push', label: 'Push Notifications', icon: Smartphone, enabled: true },
  { id: 'sms', type: 'sms', label: 'SMS', icon: Smartphone, enabled: false },
  { id: 'slack', type: 'slack', label: 'Slack', icon: MessageSquare, enabled: true },
  { id: 'in_app', type: 'in_app', label: 'In-App', icon: Monitor, enabled: true },
];

const DEFAULT_CATEGORIES: NotificationCategory[] = [
  {
    id: 'security_alerts',
    label: 'Security Alerts',
    description: 'Critical security events and potential threats',
    icon: AlertTriangle,
    channels: { email: true, push: true, sms: true, slack: true, in_app: true },
    frequency: 'instant',
    priority: 'all',
  },
  {
    id: 'compliance',
    label: 'Compliance Updates',
    description: 'Compliance status changes and audit notifications',
    icon: Shield,
    channels: { email: true, push: false, sms: false, slack: true, in_app: true },
    frequency: 'daily',
    priority: 'high_only',
  },
  {
    id: 'session_activity',
    label: 'Session Activity',
    description: 'Pod session start, end, and status updates',
    icon: Activity,
    channels: { email: false, push: true, sms: false, slack: false, in_app: true },
    frequency: 'instant',
    priority: 'high_only',
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    description: 'Scheduled reports and analytics summaries',
    icon: FileText,
    channels: { email: true, push: false, sms: false, slack: false, in_app: true },
    frequency: 'weekly',
    priority: 'all',
  },
  {
    id: 'team_updates',
    label: 'Team Updates',
    description: 'Team member changes and assignments',
    icon: Users,
    channels: { email: true, push: true, sms: false, slack: true, in_app: true },
    frequency: 'digest',
    priority: 'all',
  },
  {
    id: 'system',
    label: 'System Notifications',
    description: 'Maintenance, updates, and system announcements',
    icon: Settings,
    channels: { email: true, push: false, sms: false, slack: false, in_app: true },
    frequency: 'instant',
    priority: 'critical_only',
  },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
];

// ============================================================================
// Sub-Components
// ============================================================================

function ChannelToggle({
  channel,
  enabled,
  onChange,
}: {
  channel: NotificationChannel;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const Icon = channel.icon;

  return (
    <button
      className={`flex items-center justify-center rounded-lg border-2 p-3 transition-all ${
        enabled
          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
          : 'border-gray-200 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800'
      }`}
      title={`${enabled ? 'Disable' : 'Enable'} ${channel.label}`}
      onClick={() => onChange(!enabled)}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function CategoryCard({
  category,
  onUpdate,
}: {
  category: NotificationCategory;
  onUpdate: (updates: Partial<NotificationCategory>) => void;
}) {
  const Icon = category.icon;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div
        className="flex cursor-pointer items-start gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">{category.label}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{category.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {NOTIFICATION_CHANNELS.slice(0, 3).map((channel) => {
            const isEnabled = category.channels[channel.type as keyof typeof category.channels];
            return (
              <div
                key={channel.id}
                className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                title={`${channel.label}: ${isEnabled ? 'On' : 'Off'}`}
              />
            );
          })}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-0 dark:border-gray-700">
          {/* Channels */}
          <div className="pt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notification Channels
            </label>
            <div className="flex items-center gap-2">
              {NOTIFICATION_CHANNELS.map((channel) => (
                <ChannelToggle
                  key={channel.id}
                  channel={channel}
                  enabled={category.channels[channel.type as keyof typeof category.channels]}
                  onChange={(enabled) =>
                    onUpdate({
                      channels: {
                        ...category.channels,
                        [channel.type]: enabled,
                      },
                    })
                  }
                />
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Delivery Frequency
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'instant', label: 'Instant' },
                { id: 'digest', label: 'Digest (4 hours)' },
                { id: 'daily', label: 'Daily Summary' },
                { id: 'weekly', label: 'Weekly Summary' },
              ].map((freq) => (
                <button
                  key={freq.id}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    category.frequency === freq.id
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                      : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                  }`}
                  onClick={() =>
                    onUpdate({ frequency: freq.id as NotificationCategory['frequency'] })
                  }
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Priority Filter
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Notifications' },
                { id: 'high_only', label: 'High & Critical Only' },
                { id: 'critical_only', label: 'Critical Only' },
              ].map((prio) => (
                <button
                  key={prio.id}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    category.priority === prio.id
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                      : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                  }`}
                  onClick={() =>
                    onUpdate({ priority: prio.id as NotificationCategory['priority'] })
                  }
                >
                  {prio.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuietHoursSection({
  quietHours,
  onUpdate,
}: {
  quietHours: QuietHours;
  onUpdate: (updates: Partial<QuietHours>) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
            <Moon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Quiet Hours</h3>
            <p className="text-sm text-gray-500">
              Pause non-critical notifications during specific times
            </p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            checked={quietHours.enabled}
            className="peer sr-only"
            type="checkbox"
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
          />
          <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800" />
        </label>
      </div>

      {quietHours.enabled && (
        <div className="space-y-4">
          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Time
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                type="time"
                value={quietHours.start}
                onChange={(e) => onUpdate({ start: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                End Time
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                type="time"
                value={quietHours.end}
                onChange={(e) => onUpdate({ end: e.target.value })}
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Timezone
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              value={quietHours.timezone}
              onChange={(e) => onUpdate({ timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Days */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Active Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    quietHours.days.includes(day)
                      ? 'border-purple-500 bg-purple-50 text-purple-600 dark:bg-purple-900/20'
                      : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                  }`}
                  onClick={() => {
                    const newDays = quietHours.days.includes(day)
                      ? quietHours.days.filter((d) => d !== day)
                      : [...quietHours.days, day];
                    onUpdate({ days: newDays });
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Allow Critical */}
          <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                Allow critical alerts during quiet hours
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                checked={quietHours.allowCritical}
                className="peer sr-only"
                type="checkbox"
                onChange={(e) => onUpdate({ allowCritical: e.target.checked })}
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-yellow-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function NotificationsSettingsPage() {
  const [categories, setCategories] = useState<NotificationCategory[]>(DEFAULT_CATEGORIES);
  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: true,
    start: '22:00',
    end: '07:00',
    timezone: 'America/New_York',
    allowCritical: true,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  });
  const [globalSound, setGlobalSound] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateCategory = (id: string, updates: Partial<NotificationCategory>) => {
    setCategories((prev) => prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)));
    setHasChanges(true);
  };

  const updateQuietHours = (updates: Partial<QuietHours>) => {
    setQuietHours((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                href="/settings"
              >
                <ArrowLeft className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
                  <Bell className="h-6 w-6 text-blue-600" />
                  Notification Settings
                </h1>
                <p className="text-sm text-gray-500">
                  Manage how and when you receive notifications
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && <span className="text-sm text-yellow-600">Unsaved changes</span>}
              <button
                className={`flex items-center gap-2 rounded-lg px-4 py-2 ${
                  hasChanges
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                }`}
                disabled={!hasChanges || isSaving}
                onClick={handleSave}
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Global Settings */}
        <section>
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            Global Settings
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {globalSound ? (
                  <Volume2 className="h-5 w-5 text-blue-600" />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-400" />
                )}
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    Notification Sounds
                  </span>
                  <p className="text-sm text-gray-500">Play sounds for in-app notifications</p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  checked={globalSound}
                  className="peer sr-only"
                  type="checkbox"
                  onChange={(e) => {
                    setGlobalSound(e.target.checked);
                    setHasChanges(true);
                  }}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-blue-800" />
              </label>
            </div>
          </div>
        </section>

        {/* Notification Categories */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Notification Categories
            </h2>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Info className="h-4 w-4" />
              Click to expand options
            </div>
          </div>
          <div className="space-y-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onUpdate={(updates) => updateCategory(category.id, updates)}
              />
            ))}
          </div>
        </section>

        {/* Quiet Hours */}
        <section>
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Quiet Hours</h2>
          <QuietHoursSection quietHours={quietHours} onUpdate={updateQuietHours} />
        </section>

        {/* Email Preferences */}
        <section>
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
            Email Preferences
          </h2>
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between p-4">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Primary Email</span>
                <p className="text-sm text-gray-500">user@company.com</p>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700">Change</button>
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Email Format</span>
                <p className="text-sm text-gray-500">HTML with rich formatting</p>
              </div>
              <select className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700">
                <option>HTML</option>
                <option>Plain Text</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  Unsubscribe from Marketing
                </span>
                <p className="text-sm text-gray-500">Only receive essential notifications</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input className="peer sr-only" type="checkbox" />
                <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-gray-700" />
              </label>
            </div>
          </div>
        </section>

        {/* Connected Apps */}
        <section>
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Connected Apps</h2>
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Slack</span>
                  <p className="text-sm text-gray-500">Connected to #security-alerts</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Connected
                </span>
                <button className="text-sm text-red-600 hover:text-red-700">Disconnect</button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Microsoft Teams</span>
                  <p className="text-sm text-gray-500">Not connected</p>
                </div>
              </div>
              <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                Connect
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
