/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Project Timeline Component
 *
 * Gantt-style timeline view for project tasks and milestones.
 *
 * @module components/projects/project-timeline
 */

import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Flag,
  Milestone,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TimelineTask {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
  color?: string;
  isMilestone?: boolean;
  dependencies?: string[];
}

export interface ProjectTimelineProps {
  tasks: TimelineTask[];
  projectStartDate: string;
  projectEndDate?: string;
  onTaskClick?: (task: TimelineTask) => void;
}

type ViewMode = 'days' | 'weeks' | 'months';

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function generateDates(start: string, end: string, mode: ViewMode): Date[] {
  const dates: Date[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  let current = new Date(startDate);

  if (mode === 'weeks') {
    current = getMonday(current);
  } else if (mode === 'months') {
    current.setDate(1);
  }

  while (current <= endDate) {
    dates.push(new Date(current));

    if (mode === 'days') {
      current.setDate(current.getDate() + 1);
    } else if (mode === 'weeks') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return dates;
}

function getViewModeDivisor(mode: ViewMode): number {
  if (mode === 'days') return 1;
  if (mode === 'weeks') return 7;
  return 30;
}

function getTaskPosition(
  task: TimelineTask,
  timelineStart: string,
  cellWidth: number,
  mode: ViewMode
): { left: number; width: number } {
  const startOffset = getDaysBetween(timelineStart, task.startDate);
  const duration = getDaysBetween(task.startDate, task.endDate);

  const divisor = getViewModeDivisor(mode);

  return {
    left: (startOffset / divisor) * cellWidth,
    width: Math.max((duration / divisor) * cellWidth, cellWidth),
  };
}

function getDefaultColor(index: number): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-rose-500',
  ];
  return colors[index % colors.length];
}

// ============================================================================
// Timeline Header Component
// ============================================================================

function TimelineHeader({
  dates,
  mode,
  cellWidth,
}: {
  dates: Date[];
  mode: ViewMode;
  cellWidth: number;
}) {
  const formatHeader = (date: Date): string => {
    if (mode === 'days') {
      return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    } else if (mode === 'weeks') {
      const endOfWeek = addDays(date, 6);
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.getDate()}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      <div className="w-48 flex-shrink-0 border-r border-gray-200 bg-gray-50 px-4 py-2 font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        Task
      </div>
      <div className="flex overflow-hidden">
        {dates.map((date, idx) => (
          <div
            key={idx}
            className={`flex-shrink-0 border-r border-gray-100 px-2 py-2 text-center text-xs dark:border-gray-700 ${
              mode === 'days' && isWeekend(date)
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'bg-gray-50 dark:bg-gray-800/50'
            }`}
            style={{ width: cellWidth }}
          >
            {formatHeader(date)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Task Row Component
// ============================================================================

function TaskRow({
  task,
  index,
  timelineStart,
  dates,
  cellWidth,
  mode,
  onClick,
}: {
  task: TimelineTask;
  index: number;
  timelineStart: string;
  dates: Date[];
  cellWidth: number;
  mode: ViewMode;
  onClick?: () => void;
}) {
  const position = getTaskPosition(task, timelineStart, cellWidth, mode);
  const color = task.color || getDefaultColor(index);

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="flex border-b border-gray-100 dark:border-gray-700">
      {/* Task name */}
      <div className="flex w-48 flex-shrink-0 items-center gap-2 border-r border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        {task.isMilestone ? (
          <Milestone className="h-4 w-4 text-purple-500" />
        ) : (
          <Flag className="h-4 w-4 text-gray-400" />
        )}
        <span
          className="cursor-pointer truncate text-sm text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        >
          {task.title}
        </span>
      </div>

      {/* Grid and bar */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Grid cells */}
        {dates.map((date, idx) => (
          <div
            key={idx}
            className={`flex-shrink-0 border-r border-gray-50 dark:border-gray-800 ${
              mode === 'days' && isWeekend(date)
                ? 'bg-gray-50 dark:bg-gray-800/30'
                : 'bg-white dark:bg-gray-900'
            }`}
            style={{ width: cellWidth, height: 48 }}
          />
        ))}

        {/* Task bar */}
        {task.isMilestone ? (
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: position.left + cellWidth / 2 - 8 }}
          >
            <div className="h-4 w-4 rotate-45 bg-purple-500" />
          </div>
        ) : (
          <div
            className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
            role="button"
            style={{ left: position.left, width: position.width }}
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
          >
            <div className={`relative h-6 overflow-hidden rounded ${color}`}>
              {/* Progress fill */}
              <div
                className="absolute inset-y-0 left-0 bg-black/20"
                style={{ width: `${task.progress}%` }}
              />
              {/* Label */}
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                {task.progress}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getViewModeCellWidth(viewMode: ViewMode): number {
  if (viewMode === 'days') return 40;
  if (viewMode === 'weeks') return 80;
  return 120;
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectTimeline({
  tasks,
  projectStartDate,
  projectEndDate,
  onTaskClick,
}: ProjectTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('weeks');
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate timeline bounds
  const { timelineStart, timelineEnd } = useMemo(() => {
    let minDate = projectStartDate;
    let maxDate = projectEndDate || projectStartDate;

    tasks.forEach((task) => {
      if (task.startDate < minDate) minDate = task.startDate;
      if (task.endDate > maxDate) maxDate = task.endDate;
    });

    // Add padding
    const start = new Date(minDate);
    const end = new Date(maxDate);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 14);

    return {
      timelineStart: start.toISOString().split('T')[0],
      timelineEnd: end.toISOString().split('T')[0],
    };
  }, [tasks, projectStartDate, projectEndDate]);

  const dates = useMemo(
    () => generateDates(timelineStart, timelineEnd, viewMode),
    [timelineStart, timelineEnd, viewMode]
  );

  const cellWidth = getViewModeCellWidth(viewMode);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setScrollOffset((prev) => Math.max(prev - 200, 0))}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setScrollOffset((prev) => prev + 200)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="mx-2 text-sm text-gray-500 dark:text-gray-400">
            {formatDate(timelineStart)} - {formatDate(timelineEnd)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              viewMode === 'days'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setViewMode('days')}
          >
            Days
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              viewMode === 'weeks'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setViewMode('weeks')}
          >
            Weeks
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              viewMode === 'months'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => setViewMode('months')}
          >
            Months
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto">
        <div style={{ transform: `translateX(-${scrollOffset}px)` }}>
          <TimelineHeader cellWidth={cellWidth} dates={dates} mode={viewMode} />
          {tasks.length > 0 ? (
            tasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                cellWidth={cellWidth}
                dates={dates}
                index={idx}
                mode={viewMode}
                task={task}
                timelineStart={timelineStart}
                onClick={() => onTaskClick?.(task)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  No tasks to display on timeline
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectTimeline;
