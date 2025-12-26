/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Today's Schedule Component
 *
 * Timeline view showing time blocks, meetings, and scheduled tasks.
 *
 * @module components/dashboard/today-schedule
 */

import {
  Clock,
  Calendar,
  Video,
  Phone,
  MapPin,
  ExternalLink,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ScheduleItemType = 'time_block' | 'meeting' | 'task' | 'deadline' | 'reminder';

export interface ScheduleItem {
  id: string;
  type: ScheduleItemType;
  title: string;
  description?: string;
  startTime: string; // HH:mm format
  endTime?: string; // HH:mm format
  projectName?: string;
  projectColor?: string;
  isCompleted?: boolean;
  meetingUrl?: string;
  location?: string;
  attendees?: string[];
}

export interface TodayScheduleProps {
  items?: ScheduleItem[];
  isLoading?: boolean;
  onItemClick?: (item: ScheduleItem) => void;
  onAddClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 6; // 6 AM
const END_HOUR = 22; // 10 PM

// ============================================================================
// Utility Functions
// ============================================================================

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function formatTime(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getTimePosition(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return (hours - START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

function getDuration(startTime: string, endTime?: string): number {
  if (!endTime) return HOUR_HEIGHT; // Default 1 hour

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  return ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
}

// ============================================================================
// Schedule Item Component
// ============================================================================

function ScheduleItemBlock({ item, onClick }: { item: ScheduleItem; onClick?: () => void }) {
  const top = getTimePosition(item.startTime);
  const height = getDuration(item.startTime, item.endTime);

  const typeStyles: Record<ScheduleItemType, string> = {
    time_block: 'bg-blue-50 border-l-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    meeting:
      'bg-purple-50 border-l-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    task: 'bg-green-50 border-l-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    deadline: 'bg-red-50 border-l-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    reminder:
      'bg-yellow-50 border-l-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  };

  const IconMap: Record<ScheduleItemType, typeof Clock> = {
    time_block: Clock,
    meeting: Video,
    task: Calendar,
    deadline: Calendar,
    reminder: Clock,
  };

  const Icon = IconMap[item.type];

  return (
    <button
      className={`absolute left-16 right-2 overflow-hidden rounded-lg border-l-4 p-2 text-left transition-transform hover:scale-[1.02] ${
        typeStyles[item.type]
      } ${item.isCompleted ? 'line-through opacity-50' : ''}`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 40)}px`,
        backgroundColor: item.projectColor ? `${item.projectColor}20` : undefined,
        borderLeftColor: item.projectColor || undefined,
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.projectName && (
            <p className="mt-0.5 truncate text-xs opacity-75">{item.projectName}</p>
          )}
          <p className="mt-0.5 text-xs opacity-75">
            {formatTime(item.startTime)}
            {item.endTime && ` - ${formatTime(item.endTime)}`}
          </p>
        </div>
      </div>

      {/* Meeting actions */}
      {item.type === 'meeting' && item.meetingUrl && (
        <a
          className="absolute right-2 top-2 rounded p-1 hover:bg-white/50"
          href={item.meetingUrl}
          rel="noopener noreferrer"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </button>
  );
}

// ============================================================================
// Time Grid Component
// ============================================================================

function TimeGrid() {
  const hours = useMemo(() => {
    const result = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      result.push(h);
    }
    return result;
  }, []);

  return (
    <div className="relative">
      {hours.map((hour) => (
        <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
          <span className="absolute -top-2 left-0 w-12 text-right text-xs text-gray-400">
            {hour === 0
              ? '12 AM'
              : hour < 12
                ? `${hour} AM`
                : hour === 12
                  ? '12 PM'
                  : `${hour - 12} PM`}
          </span>
          <div className="absolute left-14 right-0 top-0 border-t border-gray-100 dark:border-gray-700" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Current Time Indicator
// ============================================================================

function CurrentTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();

  if (currentHour < START_HOUR || currentHour > END_HOUR) {
    return null;
  }

  const top = (currentHour - START_HOUR) * HOUR_HEIGHT + (currentMinutes / 60) * HOUR_HEIGHT;

  return (
    <div className="absolute left-14 right-0 z-10 flex items-center" style={{ top: `${top}px` }}>
      <div className="h-3 w-3 rounded-full bg-red-500" />
      <div className="flex-1 border-t-2 border-red-500" />
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ScheduleSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
      ))}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ onAddClick }: { onAddClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-700">
        <Calendar className="h-6 w-6 text-gray-400" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No events scheduled</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your schedule is clear for today
      </p>
      {onAddClick && (
        <button
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={onAddClick}
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Today's Schedule Component
// ============================================================================

export function TodaySchedule({
  items = [],
  isLoading = false,
  onItemClick,
  onAddClick,
}: TodayScheduleProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const formattedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  // Sort items by start time
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = parseTime(a.startTime);
      const bTime = parseTime(b.startTime);
      return aTime.hours * 60 + aTime.minutes - (bTime.hours * 60 + bTime.minutes);
    });
  }, [items]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => navigateDate('prev')}
          >
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {isToday ? "Today's Schedule" : formattedDate}
          </h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => navigateDate('next')}
          >
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        {onAddClick && (
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <ScheduleSkeleton />
      ) : sortedItems.length === 0 ? (
        <EmptyState onAddClick={onAddClick} />
      ) : (
        <div className="relative max-h-96 overflow-y-auto p-4">
          <div
            className="relative"
            style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}
          >
            <TimeGrid />
            {isToday && <CurrentTimeIndicator />}
            {sortedItems.map((item) => (
              <ScheduleItemBlock key={item.id} item={item} onClick={() => onItemClick?.(item)} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <Link
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          href="/calendar"
        >
          Open Calendar →
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default TodaySchedule;
