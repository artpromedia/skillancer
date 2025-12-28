/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Time Tracking Page
 *
 * Main time tracking page with timer, timesheet, and calendar views.
 * Core functionality for freelancers to track their billable hours.
 *
 * @module app/time/page
 */

import {
  Clock,
  Calendar,
  List,
  Grid3x3,
  Plus,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  Edit3,
  Trash2,
  Tag,
  Briefcase,
  MoreHorizontal,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'timesheet' | 'calendar' | 'list';

interface TimeEntry {
  id: string;
  description: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskId?: string;
  taskName?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  hourlyRate?: number;
  billable: boolean;
  tags: string[];
  notes?: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  clientName: string;
}

interface ActiveTimer {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  description: string;
  startTime: Date;
}

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_PROJECTS: Project[] = [
  { id: 'proj-1', name: 'Website Redesign', color: '#3B82F6', clientName: 'Acme Corp' },
  { id: 'proj-2', name: 'Mobile App', color: '#10B981', clientName: 'TechStart Inc' },
  { id: 'proj-3', name: 'Marketing Campaign', color: '#8B5CF6', clientName: 'GlobalBrand' },
  { id: 'proj-4', name: 'API Integration', color: '#F59E0B', clientName: 'DataSync Ltd' },
];

const SAMPLE_ENTRIES: TimeEntry[] = [
  {
    id: 'entry-1',
    description: 'Homepage design mockups',
    projectId: 'proj-1',
    projectName: 'Website Redesign',
    projectColor: '#3B82F6',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '11:30',
    duration: 150,
    hourlyRate: 150,
    billable: true,
    tags: ['design', 'mockup'],
  },
  {
    id: 'entry-2',
    description: 'Client feedback meeting',
    projectId: 'proj-1',
    projectName: 'Website Redesign',
    projectColor: '#3B82F6',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '15:00',
    duration: 60,
    hourlyRate: 150,
    billable: true,
    tags: ['meeting'],
  },
  {
    id: 'entry-3',
    description: 'Bug fixes and testing',
    projectId: 'proj-2',
    projectName: 'Mobile App',
    projectColor: '#10B981',
    date: new Date().toISOString().split('T')[0],
    startTime: '15:30',
    endTime: '17:00',
    duration: 90,
    hourlyRate: 175,
    billable: true,
    tags: ['development', 'testing'],
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getWeekDates(date: Date): Date[] {
  const week = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    week.push(day);
  }
  return week;
}

// ============================================================================
// Active Timer Banner Component
// ============================================================================

function ActiveTimerBanner({
  timer,
  onPause,
  onStop,
}: {
  timer: ActiveTimer | null;
  onPause: () => void;
  onStop: () => void;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!timer) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - timer.startTime.getTime()) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  if (!timer) return null;

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl bg-green-50 p-4 dark:bg-green-900/30">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div
            className="h-12 w-12 rounded-full"
            style={{ backgroundColor: `${timer.projectColor}20` }}
          />
          <div
            className="absolute inset-2 animate-pulse rounded-full"
            style={{ backgroundColor: timer.projectColor }}
          />
        </div>
        <div>
          <p className="font-mono text-2xl font-bold text-green-700 dark:text-green-300">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:
            {seconds.toString().padStart(2, '0')}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            {timer.projectName} • {timer.description || 'No description'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg bg-yellow-100 p-3 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
          onClick={onPause}
        >
          <Pause className="h-5 w-5" />
        </button>
        <button
          className="rounded-lg bg-red-100 p-3 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
          onClick={onStop}
        >
          <Square className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Timer Start Component
// ============================================================================

function QuickTimerStart({
  projects,
  onStart,
}: {
  projects: Project[];
  onStart: (projectId: string, description: string) => void;
}) {
  const [selectedProject, setSelectedProject] = useState('');
  const [description, setDescription] = useState('');

  const handleStart = () => {
    if (selectedProject) {
      onStart(selectedProject, description);
      setDescription('');
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="min-w-[200px] flex-1">
        <input
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="What are you working on?"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <select
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        value={selectedProject}
        onChange={(e) => setSelectedProject(e.target.value)}
      >
        <option value="">Select project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!selectedProject}
        onClick={handleStart}
      >
        <Play className="h-4 w-4" />
        Start Timer
      </button>
    </div>
  );
}

// ============================================================================
// View Toggle Component
// ============================================================================

function ViewToggle({
  view,
  onChange,
}: Readonly<{ view: ViewMode; onChange: (view: ViewMode) => void }>) {
  const views: { id: ViewMode; icon: typeof List; label: string }[] = [
    { id: 'timesheet', icon: Grid3x3, label: 'Timesheet' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'list', icon: List, label: 'List' },
  ];

  return (
    <div className="flex rounded-lg border border-gray-200 p-1 dark:border-gray-700">
      {views.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === id
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
          onClick={() => onChange(id)}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Week Navigation Component
// ============================================================================

function WeekNavigation({
  currentDate,
  onDateChange,
}: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}) {
  const weekDates = getWeekDates(currentDate);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  const formatRange = () => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const year = endDate.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, ${year}`;
    }
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${year}`;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="flex items-center gap-4">
      <button
        className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
        onClick={() => navigateWeek('prev')}
      >
        <ChevronLeft className="h-5 w-5 text-gray-500" />
      </button>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{formatRange()}</h2>
      <button
        className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
        onClick={() => navigateWeek('next')}
      >
        <ChevronRight className="h-5 w-5 text-gray-500" />
      </button>
      <button
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        onClick={goToToday}
      >
        Today
      </button>
    </div>
  );
}

// ============================================================================
// Timesheet View Component
// ============================================================================

function TimesheetView({
  entries,
  currentDate,
}: Readonly<{ entries: TimeEntry[]; currentDate: Date }>) {
  const weekDates = getWeekDates(currentDate);

  // Group entries by project
  const projectGroups = useMemo(() => {
    const groups: Record<string, { project: Project; entries: TimeEntry[] }> = {};

    entries.forEach((entry) => {
      if (!groups[entry.projectId]) {
        groups[entry.projectId] = {
          project: {
            id: entry.projectId,
            name: entry.projectName,
            color: entry.projectColor,
            clientName: '',
          },
          entries: [],
        };
      }
      groups[entry.projectId].entries.push(entry);
    });

    return Object.values(groups);
  }, [entries]);

  // Calculate daily totals
  const dailyTotals = useMemo(() => {
    return weekDates.map((date) => {
      const dateStr = date.toISOString().split('T')[0];
      const dayEntries = entries.filter((e) => e.date === dateStr);
      return dayEntries.reduce((sum, e) => sum + e.duration, 0);
    });
  }, [entries, weekDates]);

  const weekTotal = dailyTotals.reduce((sum, d) => sum + d, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="w-48 px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
              Project
            </th>
            {weekDates.map((date, index) => {
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <th
                  key={index}
                  className={`min-w-[80px] px-2 py-3 text-center text-sm font-medium ${
                    isToday
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className="text-xs">{date.getDate()}</div>
                </th>
              );
            })}
            <th className="min-w-[80px] px-2 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {projectGroups.map(({ project, entries: projectEntries }) => {
            const projectWeekly = weekDates.map((date) => {
              const dateStr = date.toISOString().split('T')[0];
              return projectEntries
                .filter((e) => e.date === dateStr)
                .reduce((sum, e) => sum + e.duration, 0);
            });
            const projectTotal = projectWeekly.reduce((sum, d) => sum + d, 0);

            return (
              <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {project.name}
                    </span>
                  </div>
                </td>
                {projectWeekly.map((duration, index) => {
                  const isToday = weekDates[index].toDateString() === new Date().toDateString();
                  return (
                    <td
                      key={index}
                      className={`px-2 py-3 text-center text-sm ${
                        isToday ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                    >
                      {duration > 0 ? (
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDuration(duration)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-3 text-center">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatDuration(projectTotal)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/50">
            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
              Daily Total
            </td>
            {dailyTotals.map((total, index) => {
              const isToday = weekDates[index].toDateString() === new Date().toDateString();
              return (
                <td
                  key={index}
                  className={`px-2 py-3 text-center text-sm font-semibold ${
                    isToday
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {formatDuration(total)}
                </td>
              );
            })}
            <td className="px-2 py-3 text-center">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatDuration(weekTotal)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================================
// List View Component
// ============================================================================

function ListView({ entries }: Readonly<{ entries: TimeEntry[] }>) {
  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, TimeEntry[]> = {};
    entries.forEach((entry) => {
      if (!groups[entry.date]) {
        groups[entry.date] = [];
      }
      groups[entry.date].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  return (
    <div className="space-y-6">
      {groupedEntries.map(([date, dayEntries]) => {
        const dayTotal = dayEntries.reduce((sum, e) => sum + e.duration, 0);
        const dayEarnings = dayEntries.reduce((sum, e) => {
          return sum + (e.billable && e.hourlyRate ? (e.duration / 60) * e.hourlyRate : 0);
        }, 0);

        return (
          <div
            key={date}
            className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{formatDuration(dayTotal)}</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(dayEarnings)}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {dayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div
                    className="h-10 w-1 rounded-full"
                    style={{ backgroundColor: entry.projectColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {entry.description || 'No description'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Briefcase className="h-3 w-3" />
                      <span>{entry.projectName}</span>
                      {entry.tags.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {entry.tags.slice(0, 2).join(', ')}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(entry.duration)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Time Tracking Page
// ============================================================================

export default function TimeTrackingPage() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('timesheet');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>(SAMPLE_ENTRIES);

  // Check for active timer on mount
  useEffect(() => {
    const stored = localStorage.getItem('activeTimer');
    if (stored) {
      const timer = JSON.parse(stored) as {
        startTime: string;
        id: string;
        projectId: string;
        projectName: string;
        projectColor: string;
        description: string;
        isPaused?: boolean;
        pausedDuration?: number;
        pausedAt?: number;
      };
      setActiveTimer({
        ...timer,
        startTime: new Date(timer.startTime),
      });
    }
  }, []);

  // Handle action from URL params
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'start') {
      // Could show start timer modal
    }
  }, [searchParams]);

  const handleStartTimer = (projectId: string, description: string) => {
    const project = SAMPLE_PROJECTS.find((p) => p.id === projectId);
    if (!project) return;

    const newTimer: ActiveTimer = {
      id: `timer-${Date.now()}`,
      projectId,
      projectName: project.name,
      projectColor: project.color,
      description,
      startTime: new Date(),
    };

    setActiveTimer(newTimer);
    localStorage.setItem('activeTimer', JSON.stringify(newTimer));
  };

  const handlePauseTimer = () => {
    // Feature: Create partial time entry on pause - not yet implemented
  };

  const handleStopTimer = () => {
    if (!activeTimer) return;

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 60000);

    const newEntry: TimeEntry = {
      id: `entry-${Date.now()}`,
      description: activeTimer.description,
      projectId: activeTimer.projectId,
      projectName: activeTimer.projectName,
      projectColor: activeTimer.projectColor,
      date: activeTimer.startTime.toISOString().split('T')[0],
      startTime: activeTimer.startTime.toTimeString().slice(0, 5),
      endTime: endTime.toTimeString().slice(0, 5),
      duration,
      hourlyRate: 150,
      billable: true,
      tags: [],
    };

    setEntries((prev) => [newEntry, ...prev]);
    setActiveTimer(null);
    localStorage.removeItem('activeTimer');
  };

  // Calculate week stats
  const weekStats = useMemo(() => {
    const weekDates = getWeekDates(currentDate);
    const weekStart = weekDates[0].toISOString().split('T')[0];
    const weekEnd = weekDates[6].toISOString().split('T')[0];

    const weekEntries = entries.filter((e) => e.date >= weekStart && e.date <= weekEnd);
    const totalMinutes = weekEntries.reduce((sum, e) => sum + e.duration, 0);
    const billableMinutes = weekEntries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + e.duration, 0);
    const earnings = weekEntries.reduce((sum, e) => {
      return sum + (e.billable && e.hourlyRate ? (e.duration / 60) * e.hourlyRate : 0);
    }, 0);

    return { totalMinutes, billableMinutes, earnings };
  }, [entries, currentDate]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Tracking</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track your work hours and manage timesheets
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Active Timer Banner */}
      <ActiveTimerBanner timer={activeTimer} onPause={handlePauseTimer} onStop={handleStopTimer} />

      {/* Quick Timer Start */}
      {!activeTimer && <QuickTimerStart projects={SAMPLE_PROJECTS} onStart={handleStartTimer} />}

      {/* Week Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Hours</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(weekStats.totalMinutes)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Billable Hours</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatDuration(weekStats.billableMinutes)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Earnings</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(weekStats.earnings)}
          </p>
        </div>
      </div>

      {/* View Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <WeekNavigation currentDate={currentDate} onDateChange={setCurrentDate} />
        <ViewToggle view={viewMode} onChange={setViewMode} />
      </div>

      {/* View Content */}
      {viewMode === 'timesheet' && <TimesheetView currentDate={currentDate} entries={entries} />}
      {viewMode === 'list' && <ListView entries={entries} />}
      {viewMode === 'calendar' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Calendar view coming soon</p>
        </div>
      )}
    </div>
  );
}
