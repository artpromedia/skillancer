'use client';

import { cn } from '@skillancer/ui';
import {
  Bell,
  Calendar,
  Clock,
  Plus,
  Check,
  Trash2,
  User,
  MessageSquare,
  Phone,
  Mail,
  Coffee,
  Repeat,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';

// Types
interface Reminder {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  type: 'follow_up' | 'check_in' | 'call' | 'email' | 'meeting' | 'custom';
  title: string;
  description?: string;
  dueDate: string;
  isRecurring: boolean;
  recurringInterval?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  status: 'pending' | 'completed' | 'snoozed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
}

interface FollowUpRemindersProps {
  clientId?: string; // Optional - filter by client
  reminders?: Reminder[];
  onAdd?: () => void;
  onComplete?: (id: string) => void;
  onSnooze?: (id: string, days: number) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

// Mock data
const mockReminders: Reminder[] = [
  {
    id: '1',
    clientId: 'c1',
    clientName: 'Acme Corp',
    type: 'follow_up',
    title: 'Follow up on proposal',
    description: 'Check if they reviewed the Q1 proposal',
    dueDate: '2024-12-26T10:00:00Z',
    isRecurring: false,
    status: 'overdue',
    priority: 'high',
  },
  {
    id: '2',
    clientId: 'c2',
    clientName: 'TechStart Inc',
    type: 'check_in',
    title: 'Monthly check-in',
    description: 'Regular monthly relationship call',
    dueDate: '2024-12-27T14:00:00Z',
    isRecurring: true,
    recurringInterval: 'monthly',
    status: 'pending',
    priority: 'medium',
  },
  {
    id: '3',
    clientId: 'c3',
    clientName: 'Design Studio',
    type: 'email',
    title: 'Send project update',
    dueDate: '2024-12-28T09:00:00Z',
    isRecurring: false,
    status: 'pending',
    priority: 'low',
  },
  {
    id: '4',
    clientId: 'c4',
    clientName: 'Global Enterprises',
    type: 'meeting',
    title: 'Quarterly review meeting',
    description: 'Q4 project review and Q1 planning',
    dueDate: '2024-12-30T11:00:00Z',
    isRecurring: true,
    recurringInterval: 'quarterly',
    status: 'pending',
    priority: 'high',
  },
];

const typeConfig = {
  follow_up: { icon: MessageSquare, label: 'Follow Up', color: 'text-blue-600 bg-blue-50' },
  check_in: { icon: Coffee, label: 'Check In', color: 'text-purple-600 bg-purple-50' },
  call: { icon: Phone, label: 'Call', color: 'text-green-600 bg-green-50' },
  email: { icon: Mail, label: 'Email', color: 'text-amber-600 bg-amber-50' },
  meeting: { icon: Calendar, label: 'Meeting', color: 'text-red-600 bg-red-50' },
  custom: { icon: Bell, label: 'Reminder', color: 'text-gray-600 bg-gray-50' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-gray-500 bg-gray-100' },
  medium: { label: 'Medium', color: 'text-amber-600 bg-amber-100' },
  high: { label: 'High', color: 'text-red-600 bg-red-100' },
};

export function FollowUpReminders({
  clientId,
  reminders = mockReminders,
  onAdd,
  onComplete,
  onSnooze,
  onDelete,
  className,
}: Readonly<FollowUpRemindersProps>) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);

  // Filter reminders
  const filteredReminders = reminders.filter((r) => {
    if (clientId && r.clientId !== clientId) return false;
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'overdue') return r.status === 'overdue';
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  // Group by date
  const today = new Date().toDateString();
  const todayReminders = filteredReminders.filter(
    (r) => new Date(r.dueDate).toDateString() === today
  );
  const upcomingReminders = filteredReminders.filter(
    (r) => new Date(r.dueDate).toDateString() !== today && r.status !== 'completed'
  );
  const completedReminders = filteredReminders.filter((r) => r.status === 'completed');

  // Stats
  const overdueCount = reminders.filter((r) => r.status === 'overdue').length;
  const _pendingCount = reminders.filter((r) => r.status === 'pending').length;

  const handleComplete = (id: string) => {
    onComplete?.(id);
  };

  const handleSnooze = (id: string, days: number) => {
    onSnooze?.(id, days);
    setShowSnoozeMenu(null);
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const type = typeConfig[reminder.type];
    const priority = priorityConfig[reminder.priority];
    const TypeIcon = type.icon;
    const isOverdue = reminder.status === 'overdue';
    const isCompleted = reminder.status === 'completed';

    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border p-3 transition-colors',
          isOverdue
            ? 'border-red-200 bg-red-50'
            : isCompleted
              ? 'border-gray-100 bg-gray-50 opacity-60'
              : 'border-gray-200 bg-white hover:border-gray-300'
        )}
      >
        {/* Type Icon */}
        <div className={cn('rounded-lg p-2', type.color)}>
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4
                className={cn(
                  'font-medium',
                  isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                )}
              >
                {reminder.title}
              </h4>
              {!clientId && (
                <div className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                  <User className="h-3 w-3" />
                  {reminder.clientName}
                </div>
              )}
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', priority.color)}>
              {priority.label}
            </span>
          </div>

          {reminder.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{reminder.description}</p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-red-600' : 'text-gray-500'
              )}
            >
              <Clock className="h-3 w-3" />
              {new Date(reminder.dueDate).toLocaleDateString()} at{' '}
              {new Date(reminder.dueDate).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {reminder.isRecurring && (
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <Repeat className="h-3 w-3" />
                {reminder.recurringInterval}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isCompleted && (
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
              title="Mark complete"
              onClick={() => handleComplete(reminder.id)}
            >
              <Check className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                title="Snooze"
                onClick={() =>
                  setShowSnoozeMenu(showSnoozeMenu === reminder.id ? null : reminder.id)
                }
              >
                <Clock className="h-4 w-4" />
              </button>
              {showSnoozeMenu === reminder.id && (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {[
                    { days: 1, label: '1 day' },
                    { days: 3, label: '3 days' },
                    { days: 7, label: '1 week' },
                  ].map((option) => (
                    <button
                      key={option.days}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => handleSnooze(reminder.id, option.days)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Delete"
              onClick={() => onDelete?.(reminder.id)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Follow-up Reminders</h3>
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              {overdueCount} overdue
            </span>
          )}
        </div>
        <button
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pending', 'overdue', 'completed'] as const).map((f) => (
          <button
            key={f}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'overdue' && overdueCount > 0 && (
              <span className="ml-1 text-red-200">({overdueCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Reminder Lists */}
      <div className="space-y-4">
        {/* Today */}
        {todayReminders.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-sm font-medium text-gray-500">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Today
            </h4>
            <div className="space-y-2">
              {todayReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcomingReminders.length > 0 && filter !== 'completed' && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-500">Upcoming</h4>
            <div className="space-y-2">
              {upcomingReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completedReminders.length > 0 && filter === 'completed' && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-500">Completed</h4>
            <div className="space-y-2">
              {completedReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredReminders.length === 0 && (
          <div className="py-8 text-center">
            <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="mb-1 font-medium text-gray-900">No reminders</p>
            <p className="text-sm text-gray-500">
              {filter === 'all' ? "You're all caught up!" : `No ${filter} reminders`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowUpReminders;
