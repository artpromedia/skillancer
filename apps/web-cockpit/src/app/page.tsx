/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */
'use client';

/**
 * Cockpit Home Dashboard
 *
 * Main dashboard view with quick stats, active timer,
 * today's schedule, and recent activity feed.
 *
 * @module app/page
 */

import {
  Clock,
  DollarSign,
  Briefcase,
  FileText,
  Play,
  Receipt,
  FolderPlus,
  Timer,
  Pause,
  Square,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { TodaySchedule } from '@/components/dashboard/today-schedule';

// ============================================================================
// Types
// ============================================================================

interface DashboardStats {
  hoursThisWeek: number;
  hoursLastWeek: number;
  earningsThisMonth: number;
  earningsLastMonth: number;
  activeProjects: number;
  activeProjectsChange: number;
  pendingInvoices: number;
  pendingInvoicesAmount: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Clock;
  color: string;
  href?: string;
  onClick?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ============================================================================
// Quick Actions Component
// ============================================================================

function QuickActions({
  onStartTimer,
  onCreateInvoice,
  onLogExpense,
  onNewProject,
}: Readonly<{
  onStartTimer: () => void;
  onCreateInvoice: () => void;
  onLogExpense: () => void;
  onNewProject: () => void;
}>) {
  const actions: QuickAction[] = [
    {
      id: 'start-timer',
      label: 'Start Timer',
      icon: Play,
      color: 'bg-green-500 hover:bg-green-600',
      onClick: onStartTimer,
    },
    {
      id: 'create-invoice',
      label: 'Create Invoice',
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
      onClick: onCreateInvoice,
    },
    {
      id: 'log-expense',
      label: 'Log Expense',
      icon: Receipt,
      color: 'bg-purple-500 hover:bg-purple-600',
      onClick: onLogExpense,
    },
    {
      id: 'new-project',
      label: 'New Project',
      icon: FolderPlus,
      color: 'bg-orange-500 hover:bg-orange-600',
      onClick: onNewProject,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => (
        <button
          key={action.id}
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-white transition-colors ${action.color}`}
          onClick={action.onClick}
        >
          <action.icon className="h-5 w-5" />
          <span className="text-sm font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Active Timer Banner
// ============================================================================

function ActiveTimerBanner() {
  const [hasActiveTimer, setHasActiveTimer] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const checkActiveTimer = async () => {
      try {
        const response = await fetch('/api/timers/active');
        if (response.ok) {
          const data = (await response.json()) as {
            timer?: { projectName?: string; startTime: string };
          };
          if (data.timer) {
            setHasActiveTimer(true);
            setProjectName(data.timer.projectName || 'No project');
            const startTime = new Date(data.timer.startTime).getTime();
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
          }
        }
      } catch {
        // No active timer
      }
    };

    checkActiveTimer();
  }, []);

  useEffect(() => {
    if (!hasActiveTimer) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveTimer]);

  if (!hasActiveTimer) return null;

  const hours = Math.floor(elapsedTime / 3600);
  const minutes = Math.floor((elapsedTime % 3600) / 60);
  const seconds = elapsedTime % 60;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
            <Timer className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Timer Running</p>
            <p className="text-lg font-bold text-green-900 dark:text-green-100">{projectName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-bold text-green-900 dark:text-green-100">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:
            {seconds.toString().padStart(2, '0')}
          </p>
          <div className="mt-2 flex gap-2">
            <button className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700">
              <Pause className="h-4 w-4" />
              Pause
            </button>
            <button className="flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700">
              <Square className="h-4 w-4" />
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CockpitHome() {
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    hoursThisWeek: 0,
    hoursLastWeek: 0,
    earningsThisMonth: 0,
    earningsLastMonth: 0,
    activeProjects: 0,
    activeProjectsChange: 0,
    pendingInvoices: 0,
    pendingInvoicesAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = () => {
      try {
        setUserName('Alex');
        setStats({
          hoursThisWeek: 32.5,
          hoursLastWeek: 28.75,
          earningsThisMonth: 8450,
          earningsLastMonth: 7200,
          activeProjects: 5,
          activeProjectsChange: 2,
          pendingInvoices: 3,
          pendingInvoicesAmount: 4250,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleStartTimer = () => {
    globalThis.location.href = '/time?action=start';
  };

  const handleCreateInvoice = () => {
    globalThis.location.href = '/invoices/new';
  };

  const handleLogExpense = () => {
    globalThis.location.href = '/expenses/new';
  };

  const handleNewProject = () => {
    globalThis.location.href = '/projects/new';
  };

  const today = new Date();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? 'Welcome back!' : `Welcome back, ${userName}!`}
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">{formatDate(today)}</p>
        </div>

        {/* Active Timer Banner */}
        <div className="mb-6">
          <ActiveTimerBanner />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h2>
          <QuickActions
            onCreateInvoice={handleCreateInvoice}
            onLogExpense={handleLogExpense}
            onNewProject={handleNewProject}
            onStartTimer={handleStartTimer}
          />
        </div>

        {/* Stats Cards */}
        <div className="mb-8">
          <StatsCards
            stats={[
              {
                id: 'hours',
                title: 'Hours This Week',
                value: formatHours(stats.hoursThisWeek),
                previousValue: formatHours(stats.hoursLastWeek),
                change:
                  stats.hoursLastWeek > 0
                    ? ((stats.hoursThisWeek - stats.hoursLastWeek) / stats.hoursLastWeek) * 100
                    : 0,
                icon: Clock,
                color: 'blue',
                href: '/time',
              },
              {
                id: 'earnings',
                title: 'Earnings This Month',
                value: formatCurrency(stats.earningsThisMonth),
                previousValue: formatCurrency(stats.earningsLastMonth),
                change:
                  stats.earningsLastMonth > 0
                    ? ((stats.earningsThisMonth - stats.earningsLastMonth) /
                        stats.earningsLastMonth) *
                      100
                    : 0,
                icon: DollarSign,
                color: 'green',
                href: '/finances',
              },
              {
                id: 'projects',
                title: 'Active Projects',
                value: stats.activeProjects.toString(),
                change: stats.activeProjectsChange,
                changeLabel: 'new this month',
                icon: Briefcase,
                color: 'purple',
                href: '/projects',
              },
              {
                id: 'invoices',
                title: 'Pending Invoices',
                value: stats.pendingInvoices.toString(),
                subValue: formatCurrency(stats.pendingInvoicesAmount),
                icon: FileText,
                color: 'orange',
                href: '/invoices?status=pending',
              },
            ]}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Today's Schedule */}
          <div className="lg:col-span-2">
            <TodaySchedule />
          </div>

          {/* Activity Feed */}
          <div>
            <ActivityFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
