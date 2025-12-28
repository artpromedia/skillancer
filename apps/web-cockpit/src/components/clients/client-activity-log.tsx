/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Client Activity Log Component
 *
 * Displays a timeline of client interactions and activities
 * with ability to add new log entries.
 *
 * @module components/clients/client-activity-log
 */

import {
  MessageSquare,
  Phone,
  Mail,
  Video,
  FileText,
  Calendar,
  DollarSign,
  Plus,
  Send,
  Paperclip,
  MoreHorizontal,
  User,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ActivityType =
  | 'email'
  | 'call'
  | 'meeting'
  | 'video_call'
  | 'note'
  | 'proposal'
  | 'invoice'
  | 'payment'
  | 'milestone'
  | 'other';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  date: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: {
    duration?: number; // minutes
    amount?: number;
    link?: string;
    attachments?: { name: string; url: string }[];
  };
}

export interface ClientActivityLogProps {
  clientId: string;
  activities: Activity[];
  onAddActivity?: (activity: Omit<Activity, 'id'>) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getActivityIcon(type: ActivityType) {
  const icons: Record<ActivityType, typeof MessageSquare> = {
    email: Mail,
    call: Phone,
    meeting: Calendar,
    video_call: Video,
    note: FileText,
    proposal: FileText,
    invoice: DollarSign,
    payment: DollarSign,
    milestone: Calendar,
    other: MessageSquare,
  };
  return icons[type] || MessageSquare;
}

function getActivityColor(type: ActivityType): string {
  const colors: Record<ActivityType, string> = {
    email: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    call: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    meeting: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    video_call: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    note: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    proposal: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    invoice: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    payment: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    milestone: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return colors[type] || colors.other;
}

// ============================================================================
// Activity Item Component
// ============================================================================

function ActivityItem({ activity }: Readonly<{ activity: Activity }>) {
  const Icon = getActivityIcon(activity.type);

  return (
    <div className="group relative flex gap-4">
      {/* Timeline line */}
      <div className="absolute left-5 top-10 h-full w-px bg-gray-200 dark:bg-gray-700" />

      {/* Icon */}
      <div
        className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${getActivityColor(activity.type)}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{activity.title}</h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>

            {/* Metadata */}
            {activity.metadata && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {activity.metadata.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {activity.metadata.duration} min
                  </span>
                )}
                {activity.metadata.amount && (
                  <span className="flex items-center gap-1 text-green-600">
                    <DollarSign className="h-3.5 w-3.5" />
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      activity.metadata.amount
                    )}
                  </span>
                )}
                {activity.metadata.attachments?.map((att) => (
                  <a
                    key={att.name}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                    href={att.url}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {att.name}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{formatDate(activity.date)}</span>
            <button className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-700">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* User */}
        {activity.user && (
          <div className="mt-2 flex items-center gap-2">
            {activity.user.avatar ? (
              <img
                alt={activity.user.name}
                className="h-5 w-5 rounded-full"
                src={activity.user.avatar}
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600">
                <User className="h-3 w-3 text-gray-500" />
              </div>
            )}
            <span className="text-xs text-gray-500">{activity.user.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Log Form
// ============================================================================

function QuickLogForm({
  onSubmit,
  onClose,
}: Readonly<{
  onSubmit: (activity: Omit<Activity, 'id'>) => void;
  onClose: () => void;
}>) {
  const [type, setType] = useState<ActivityType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const activityTypes: { value: ActivityType; label: string }[] = [
    { value: 'note', label: 'Note' },
    { value: 'email', label: 'Email' },
    { value: 'call', label: 'Call' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'video_call', label: 'Video Call' },
    { value: 'other', label: 'Other' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      date: new Date().toISOString(),
    });

    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <form
      className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      onSubmit={handleSubmit}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {activityTypes.map((t) => (
            <button
              key={t.value}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                type === t.value
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
              type="button"
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="What happened?"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Add details (optional)"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            type="button"
          >
            <Paperclip className="h-4 w-4" />
            Attach
          </button>
          <div className="flex gap-2">
            <button
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!title.trim()}
              type="submit"
            >
              <Send className="h-4 w-4" />
              Log Activity
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClientActivityLog({
  clientId,
  activities,
  onAddActivity,
}: Readonly<ClientActivityLogProps>) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');

  const filteredActivities =
    filter === 'all' ? activities : activities.filter((a) => a.type === filter);

  const filterOptions: { value: ActivityType | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'email', label: 'Emails' },
    { value: 'call', label: 'Calls' },
    { value: 'meeting', label: 'Meetings' },
    { value: 'note', label: 'Notes' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {filterOptions.map((f) => (
            <button
              key={f.value}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          Log Activity
        </button>
      </div>

      {/* Quick Log Form */}
      {showForm && (
        <div className="mb-6">
          <QuickLogForm
            onClose={() => setShowForm(false)}
            onSubmit={(activity) => onAddActivity?.(activity)}
          />
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {filteredActivities.length > 0 ? (
          filteredActivities.map((activity, idx) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))
        ) : (
          <div className="py-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">No activities logged yet</p>
            <button
              className="mt-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => setShowForm(true)}
            >
              Log your first activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientActivityLog;
