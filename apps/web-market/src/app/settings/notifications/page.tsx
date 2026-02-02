/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Email Notification Preferences Page
 *
 * Configure user notification preferences for various email types
 * including marketing, transactional, and update notifications.
 *
 * @module app/settings/notifications/page
 */

import {
  Bell,
  Mail,
  Smartphone,
  ArrowLeft,
  Check,
  Moon,
  AlertTriangle,
  Shield,
  MessageSquare,
  FileText,
  DollarSign,
  Briefcase,
  Settings,
  Save,
  RefreshCw,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface NotificationChannel {
  id: 'email' | 'push' | 'in_app';
  label: string;
  icon: typeof Mail;
  enabled: boolean;
  description: string;
}

interface EmailCategory {
  id: string;
  label: string;
  description: string;
  icon: typeof Bell;
  type: 'marketing' | 'transactional' | 'updates';
  channels: {
    email: boolean;
    push: boolean;
    in_app: boolean;
  };
  frequency: 'instant' | 'daily' | 'weekly' | 'never';
  canDisable: boolean; // Some categories like security can't be fully disabled
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  allowUrgent: boolean;
  days: string[];
}

interface NotificationPreferences {
  channels: NotificationChannel[];
  categories: EmailCategory[];
  quietHours: QuietHours;
  digestEnabled: boolean;
  digestTime: string;
  globalUnsubscribe: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    enabled: true,
    description: 'Receive notifications via email',
  },
  {
    id: 'push',
    label: 'Push Notifications',
    icon: Smartphone,
    enabled: true,
    description: 'Browser and mobile push notifications',
  },
  {
    id: 'in_app',
    label: 'In-App',
    icon: Bell,
    enabled: true,
    description: 'Notifications within the Skillancer platform',
  },
];

const DEFAULT_CATEGORIES: EmailCategory[] = [
  // Transactional - Always important
  {
    id: 'security',
    label: 'Security Alerts',
    description: 'Login attempts, password changes, and security notifications',
    icon: Shield,
    type: 'transactional',
    channels: { email: true, push: true, in_app: true },
    frequency: 'instant',
    canDisable: false,
  },
  {
    id: 'payments',
    label: 'Payment Notifications',
    description: 'Payment receipts, invoices, and billing updates',
    icon: DollarSign,
    type: 'transactional',
    channels: { email: true, push: true, in_app: true },
    frequency: 'instant',
    canDisable: false,
  },
  {
    id: 'contracts',
    label: 'Contract Updates',
    description: 'Contract status, milestones, and completion notifications',
    icon: FileText,
    type: 'transactional',
    channels: { email: true, push: true, in_app: true },
    frequency: 'instant',
    canDisable: true,
  },
  // Updates - Important but can be aggregated
  {
    id: 'proposals',
    label: 'Proposal Activity',
    description: 'New proposals, proposal updates, and acceptance notifications',
    icon: Briefcase,
    type: 'updates',
    channels: { email: true, push: true, in_app: true },
    frequency: 'instant',
    canDisable: true,
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'New messages and conversation updates',
    icon: MessageSquare,
    type: 'updates',
    channels: { email: true, push: true, in_app: true },
    frequency: 'instant',
    canDisable: true,
  },
  {
    id: 'jobs',
    label: 'Job Recommendations',
    description: 'New job matches based on your skills and preferences',
    icon: Briefcase,
    type: 'updates',
    channels: { email: true, push: false, in_app: true },
    frequency: 'daily',
    canDisable: true,
  },
  // Marketing - Optional
  {
    id: 'marketing',
    label: 'Marketing & Promotions',
    description: 'Special offers, tips, and platform updates',
    icon: AlertTriangle,
    type: 'marketing',
    channels: { email: true, push: false, in_app: true },
    frequency: 'weekly',
    canDisable: true,
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Weekly insights, industry news, and success stories',
    icon: Mail,
    type: 'marketing',
    channels: { email: true, push: false, in_app: false },
    frequency: 'weekly',
    canDisable: true,
  },
  // System
  {
    id: 'system',
    label: 'System Notifications',
    description: 'Platform updates, maintenance, and announcements',
    icon: Settings,
    type: 'transactional',
    channels: { email: true, push: false, in_app: true },
    frequency: 'instant',
    canDisable: true,
  },
];

const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: '22:00',
  end: '08:00',
  timezone: 'America/New_York',
  allowUrgent: true,
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

const FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant', description: 'Receive immediately' },
  { value: 'daily', label: 'Daily Digest', description: 'Once per day' },
  { value: 'weekly', label: 'Weekly Digest', description: 'Once per week' },
  { value: 'never', label: 'Never', description: 'Disabled' },
];

// ============================================================================
// Sub-Components
// ============================================================================

function ChannelToggle({
  channel,
  onChange,
  disabled = false,
}: Readonly<{
  channel: NotificationChannel;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}>) {
  const Icon = channel.icon;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
        channel.enabled
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      onClick={() => !disabled && onChange(!channel.enabled)}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && onChange(!channel.enabled)}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <Icon className={`h-5 w-5 ${channel.enabled ? 'text-emerald-600' : 'text-gray-400'}`} />
      <div className="flex-1">
        <p
          className={`font-medium ${channel.enabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}`}
        >
          {channel.label}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{channel.description}</p>
      </div>
      <div
        className={`h-6 w-11 rounded-full p-1 transition-colors ${
          channel.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <div
          className={`h-4 w-4 rounded-full bg-white transition-transform ${
            channel.enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  onUpdate,
  globalChannels,
}: Readonly<{
  category: EmailCategory;
  onUpdate: (updates: Partial<EmailCategory>) => void;
  globalChannels: NotificationChannel[];
}>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = category.icon;

  const allDisabled =
    !category.channels.email && !category.channels.push && !category.channels.in_app;
  const typeColor = {
    marketing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    transactional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    updates: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={`rounded-lg p-2 ${allDisabled ? 'bg-gray-100 dark:bg-gray-700' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}
        >
          <Icon
            className={`h-5 w-5 ${allDisabled ? 'text-gray-400' : 'text-emerald-600 dark:text-emerald-400'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{category.label}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[category.type]}`}
            >
              {category.type}
            </span>
            {!category.canDisable && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Required
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {FREQUENCY_OPTIONS.find((f) => f.value === category.frequency)?.label}
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          {/* Channel toggles */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Notification Channels
            </p>
            <div className="flex flex-wrap gap-2">
              {(['email', 'push', 'in_app'] as const).map((channelId) => {
                const globalChannel = globalChannels.find((c) => c.id === channelId);
                const isGlobalDisabled = !globalChannel?.enabled;
                const isEnabled = category.channels[channelId];
                const canToggle = category.canDisable || channelId !== 'email';

                return (
                  <button
                    key={channelId}
                    type="button"
                    disabled={isGlobalDisabled || !canToggle}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isEnabled && !isGlobalDisabled
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'border-gray-200 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    } ${isGlobalDisabled || !canToggle ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-emerald-400'}`}
                    onClick={() =>
                      canToggle &&
                      !isGlobalDisabled &&
                      onUpdate({
                        channels: { ...category.channels, [channelId]: !isEnabled },
                      })
                    }
                  >
                    {isEnabled && !isGlobalDisabled && <Check className="h-4 w-4" />}
                    {channelId === 'email' && 'Email'}
                    {channelId === 'push' && 'Push'}
                    {channelId === 'in_app' && 'In-App'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frequency selector */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Notification Frequency
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FREQUENCY_OPTIONS.map((freq) => {
                const isSelected = category.frequency === freq.value;
                const isDisabled = freq.value === 'never' && !category.canDisable;

                return (
                  <button
                    key={freq.value}
                    type="button"
                    disabled={isDisabled}
                    className={`rounded-lg border p-2 text-center transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
                    } ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-emerald-400'}`}
                    onClick={() =>
                      !isDisabled &&
                      onUpdate({ frequency: freq.value as EmailCategory['frequency'] })
                    }
                  >
                    <p
                      className={`text-sm font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {freq.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{freq.description}</p>
                  </button>
                );
              })}
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
}: Readonly<{
  quietHours: QuietHours;
  onUpdate: (updates: Partial<QuietHours>) => void;
}>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
            <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Quiet Hours</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pause non-urgent notifications during specific times
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`h-6 w-11 rounded-full p-1 transition-colors ${
            quietHours.enabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          onClick={() => onUpdate({ enabled: !quietHours.enabled })}
        >
          <div
            className={`h-4 w-4 rounded-full bg-white transition-transform ${
              quietHours.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {quietHours.enabled && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Time
              </label>
              <input
                type="time"
                value={quietHours.start}
                onChange={(e) => onUpdate({ start: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                End Time
              </label>
              <input
                type="time"
                value={quietHours.end}
                onChange={(e) => onUpdate({ end: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Timezone
            </label>
            <select
              value={quietHours.timezone}
              onChange={(e) => onUpdate({ timezone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Active Days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isActive = quietHours.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                        : 'border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                    onClick={() => {
                      const newDays = isActive
                        ? quietHours.days.filter((d) => d !== day)
                        : [...quietHours.days, day];
                      onUpdate({ days: newDays });
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allowUrgent"
              checked={quietHours.allowUrgent}
              onChange={(e) => onUpdate({ allowUrgent: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="allowUrgent" className="text-sm text-gray-700 dark:text-gray-300">
              Allow urgent notifications during quiet hours (security alerts, etc.)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function DigestSection({
  digestEnabled,
  digestTime,
  onUpdateEnabled,
  onUpdateTime,
}: Readonly<{
  digestEnabled: boolean;
  digestTime: string;
  onUpdateEnabled: (enabled: boolean) => void;
  onUpdateTime: (time: string) => void;
}>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Daily Digest</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Receive a summary of your notifications once per day
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`h-6 w-11 rounded-full p-1 transition-colors ${
            digestEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          onClick={() => onUpdateEnabled(!digestEnabled)}
        >
          <div
            className={`h-4 w-4 rounded-full bg-white transition-transform ${
              digestEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {digestEnabled && (
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Preferred Delivery Time
          </label>
          <input
            type="time"
            value={digestTime}
            onChange={(e) => onUpdateTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-amber-500 focus:ring-amber-500 sm:w-auto dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="mr-1 inline h-4 w-4" />
            Categories set to &quot;Daily Digest&quot; will be included in this email
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function NotificationPreferencesPage() {
  // State
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    channels: DEFAULT_CHANNELS,
    categories: DEFAULT_CATEGORIES,
    quietHours: DEFAULT_QUIET_HOURS,
    digestEnabled: true,
    digestTime: '09:00',
    globalUnsubscribe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/users/me/notification-preferences');
        if (response.ok) {
          const data = await response.json();
          setPreferences((prev) => ({
            ...prev,
            ...data,
          }));
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadPreferences();
  }, []);

  // Handlers
  const handleChannelUpdate = useCallback((channelId: string, enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      channels: prev.channels.map((c) => (c.id === channelId ? { ...c, enabled } : c)),
    }));
    setHasChanges(true);
  }, []);

  const handleCategoryUpdate = useCallback(
    (categoryId: string, updates: Partial<EmailCategory>) => {
      setPreferences((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === categoryId ? { ...c, ...updates } : c)),
      }));
      setHasChanges(true);
    },
    []
  );

  const handleQuietHoursUpdate = useCallback((updates: Partial<QuietHours>) => {
    setPreferences((prev) => ({
      ...prev,
      quietHours: { ...prev.quietHours, ...updates },
    }));
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch('/api/users/me/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        setSaveMessage({ type: 'success', text: 'Preferences saved successfully!' });
        setHasChanges(false);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save preferences. Please try again.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleReset = () => {
    setPreferences({
      channels: DEFAULT_CHANNELS,
      categories: DEFAULT_CATEGORIES,
      quietHours: DEFAULT_QUIET_HOURS,
      digestEnabled: true,
      digestTime: '09:00',
      globalUnsubscribe: false,
    });
    setHasChanges(true);
  };

  // Group categories by type
  const transactionalCategories = preferences.categories.filter((c) => c.type === 'transactional');
  const updateCategories = preferences.categories.filter((c) => c.type === 'updates');
  const marketingCategories = preferences.categories.filter((c) => c.type === 'marketing');

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Notification Preferences
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage how and when you receive notifications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
        {saveMessage && (
          <div
            className={`px-4 py-2 text-center text-sm ${
              saveMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            }`}
          >
            {saveMessage.type === 'success' && <Check className="mr-1 inline h-4 w-4" />}
            {saveMessage.text}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-8">
          {/* Global Channels */}
          <section>
            <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Notification Channels
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Choose how you want to receive notifications. Disabling a channel will turn off all
              notifications of that type.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {preferences.channels.map((channel) => (
                <ChannelToggle
                  key={channel.id}
                  channel={channel}
                  onChange={(enabled) => handleChannelUpdate(channel.id, enabled)}
                />
              ))}
            </div>
          </section>

          {/* Transactional Emails */}
          <section>
            <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
              Transactional Notifications
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Important notifications about your account, payments, and security. Some of these
              cannot be disabled.
            </p>
            <div className="space-y-3">
              {transactionalCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  globalChannels={preferences.channels}
                  onUpdate={(updates) => handleCategoryUpdate(category.id, updates)}
                />
              ))}
            </div>
          </section>

          {/* Update Notifications */}
          <section>
            <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
              Activity Updates
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Stay informed about proposals, messages, and job recommendations.
            </p>
            <div className="space-y-3">
              {updateCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  globalChannels={preferences.channels}
                  onUpdate={(updates) => handleCategoryUpdate(category.id, updates)}
                />
              ))}
            </div>
          </section>

          {/* Marketing Notifications */}
          <section>
            <h2 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
              Marketing & Promotions
            </h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Optional notifications about special offers, tips, and platform news.
            </p>
            <div className="space-y-3">
              {marketingCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  globalChannels={preferences.channels}
                  onUpdate={(updates) => handleCategoryUpdate(category.id, updates)}
                />
              ))}
            </div>
          </section>

          {/* Daily Digest */}
          <section>
            <DigestSection
              digestEnabled={preferences.digestEnabled}
              digestTime={preferences.digestTime}
              onUpdateEnabled={(enabled) => {
                setPreferences((prev) => ({ ...prev, digestEnabled: enabled }));
                setHasChanges(true);
              }}
              onUpdateTime={(time) => {
                setPreferences((prev) => ({ ...prev, digestTime: time }));
                setHasChanges(true);
              }}
            />
          </section>

          {/* Quiet Hours */}
          <section>
            <QuietHoursSection
              quietHours={preferences.quietHours}
              onUpdate={handleQuietHoursUpdate}
            />
          </section>

          {/* Global Unsubscribe */}
          <section className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/50">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  Unsubscribe from All Emails
                </h3>
                <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                  This will disable all optional email notifications. You will still receive
                  essential security and transactional emails as required by law.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPreferences((prev) => ({
                      ...prev,
                      globalUnsubscribe: !prev.globalUnsubscribe,
                      categories: prev.categories.map((c) =>
                        c.canDisable
                          ? {
                              ...c,
                              channels: { ...c.channels, email: prev.globalUnsubscribe },
                            }
                          : c
                      ),
                    }));
                    setHasChanges(true);
                  }}
                  className={`mt-4 rounded-lg border px-4 py-2 text-sm transition-colors ${
                    preferences.globalUnsubscribe
                      ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
                      : 'border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {preferences.globalUnsubscribe
                    ? 'Re-enable Email Notifications'
                    : 'Unsubscribe from All'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
