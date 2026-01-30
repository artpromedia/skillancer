/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Project Detail Page
 *
 * Comprehensive project view with tabs for overview, tasks,
 * time tracking, budget, files, and activity.
 *
 * @module app/projects/[projectId]/page
 */

import {
  ArrowLeft,
  Building2,
  Clock,
  DollarSign,
  Edit,
  FolderKanban,
  Plus,
  Timer,
  CheckCircle2,
  Circle,
  PlayCircle,
  MessageSquare,
  Paperclip,
  Flag,
  LayoutList,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled';
type ProjectType = 'fixed' | 'hourly' | 'retainer' | 'milestone';
type TabType = 'overview' | 'tasks' | 'time' | 'budget' | 'files' | 'activity';
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  estimatedHours?: number;
  loggedHours: number;
  assignee?: string;
}

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  task?: string;
  billable: boolean;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  client: {
    id: string;
    name: string;
    avatar?: string;
  };
  status: ProjectStatus;
  type: ProjectType;
  platform: string;
  budget: number;
  spent: number;
  progress: number;
  startDate: string;
  endDate?: string;
  dueDate?: string;
  hoursLogged: number;
  hoursEstimated?: number;
  hourlyRate?: number;
  tasksTotal: number;
  tasksCompleted: number;
  tags?: string[];
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

// ============================================================================
// Mock Data
// TODO(Sprint-10): Replace with API call to GET /api/cockpit/projects/:id
// ============================================================================

const mockProject: Project = {
  id: '1',
  name: 'E-commerce Platform Redesign',
  description:
    'Complete redesign of the main shopping experience including checkout flow, product pages, and mobile optimization. Focus on improving conversion rates and user experience.',
  client: { id: '1', name: 'TechCorp Inc', avatar: undefined },
  status: 'active',
  type: 'fixed',
  platform: 'Skillancer',
  budget: 25000,
  spent: 15000,
  progress: 65,
  startDate: '2024-01-15',
  dueDate: '2024-04-15',
  hoursLogged: 180,
  hoursEstimated: 280,
  hourlyRate: 100,
  tasksTotal: 24,
  tasksCompleted: 16,
  tags: ['React', 'TypeScript', 'E-commerce', 'UI/UX'],
  priority: 'high',
  notes: 'Client prefers async communication via Slack. Weekly sync calls on Fridays.',
};

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Design system setup',
    status: 'done',
    priority: 'high',
    loggedHours: 8,
    estimatedHours: 8,
  },
  {
    id: '2',
    title: 'Product listing page',
    status: 'done',
    priority: 'high',
    loggedHours: 16,
    estimatedHours: 16,
  },
  {
    id: '3',
    title: 'Product detail page',
    status: 'done',
    priority: 'high',
    loggedHours: 12,
    estimatedHours: 12,
  },
  {
    id: '4',
    title: 'Shopping cart implementation',
    status: 'in_progress',
    priority: 'high',
    loggedHours: 10,
    estimatedHours: 16,
    dueDate: '2024-03-20',
  },
  {
    id: '5',
    title: 'Checkout flow - Step 1',
    status: 'in_progress',
    priority: 'high',
    loggedHours: 6,
    estimatedHours: 12,
    dueDate: '2024-03-22',
  },
  {
    id: '6',
    title: 'Checkout flow - Step 2',
    status: 'todo',
    priority: 'medium',
    loggedHours: 0,
    estimatedHours: 12,
    dueDate: '2024-03-25',
  },
  {
    id: '7',
    title: 'Payment integration',
    status: 'todo',
    priority: 'high',
    loggedHours: 0,
    estimatedHours: 20,
    dueDate: '2024-03-28',
  },
  {
    id: '8',
    title: 'Mobile optimization',
    status: 'todo',
    priority: 'medium',
    loggedHours: 0,
    estimatedHours: 16,
  },
];

const mockTimeEntries: TimeEntry[] = [
  {
    id: '1',
    date: '2024-03-15',
    hours: 4.5,
    description: 'Shopping cart UI implementation',
    task: 'Shopping cart',
    billable: true,
  },
  {
    id: '2',
    date: '2024-03-14',
    hours: 6,
    description: 'Product detail responsive design',
    task: 'Product detail',
    billable: true,
  },
  {
    id: '3',
    date: '2024-03-13',
    hours: 5.5,
    description: 'API integration for product listing',
    task: 'Product listing',
    billable: true,
  },
  {
    id: '4',
    date: '2024-03-12',
    hours: 3,
    description: 'Client meeting and feedback review',
    billable: false,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return colors[status];
}

function getTaskStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    todo: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return colors[status];
}

function getTaskPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    urgent: 'text-red-600 dark:text-red-400',
    high: 'text-orange-600 dark:text-orange-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-gray-400 dark:text-gray-500',
  };
  return colors[priority];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Overview Tab Component
// ============================================================================

function OverviewTab({ project }: Readonly<{ project: Project }>) {
  const budgetPercent = (project.spent / project.budget) * 100;
  const hoursPercent = project.hoursEstimated
    ? (project.hoursLogged / project.hoursEstimated) * 100
    : 0;
  const tasksPercent = (project.tasksCompleted / project.tasksTotal) * 100;

  const daysRemaining = project.dueDate
    ? Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* Progress Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Overall Progress</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.progress}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Budget Used</span>
            <span
              className={`text-2xl font-bold ${budgetPercent > 90 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
            >
              {Math.round(budgetPercent)}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full ${budgetPercent > 90 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Hours Logged</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.hoursLogged}h
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-purple-500"
              style={{ width: `${Math.min(hoursPercent, 100)}%` }}
            />
          </div>
          {project.hoursEstimated && (
            <p className="mt-1 text-xs text-gray-500">
              {project.hoursLogged}h / {project.hoursEstimated}h estimated
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Tasks Completed</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.tasksCompleted}/{project.tasksTotal}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${tasksPercent}%` }}
            />
          </div>
          {daysRemaining !== null && (
            <p className={`mt-1 text-xs ${daysRemaining < 7 ? 'text-red-500' : 'text-gray-500'}`}>
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Overdue'}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Project Details */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Description</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{project.description}</p>
          </div>

          {/* Recent Tasks */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Tasks</h3>
              <Link
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                href="#tasks"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {mockTasks
                .filter((t) => t.status === 'in_progress')
                .slice(0, 3)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700"
                  >
                    <Circle className={`h-4 w-4 ${getTaskPriorityColor(task.priority)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {task.loggedHours}h / {task.estimatedHours}h
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getTaskStatusColor(task.status)}`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Details</h3>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="mt-1 text-sm capitalize text-gray-900 dark:text-white">
                  {project.type} Price
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                  {formatDate(project.startDate)}
                </dd>
              </div>
              {project.dueDate && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Due Date</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(project.dueDate)}
                  </dd>
                </div>
              )}
              {project.hourlyRate && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Hourly Rate
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatCurrency(project.hourlyRate)}/hr
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notes */}
          {project.notes && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notes</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{project.notes}</p>
            </div>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Tags</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tasks Tab Component
// ============================================================================

function TasksTab({ tasks }: Readonly<{ tasks: Task[] }>) {
  const [view, setView] = useState<'list' | 'board'>('list');

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    review: tasks.filter((t) => t.status === 'review'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'list' ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            onClick={() => setView('list')}
          >
            <LayoutList className="mr-1 inline-block h-4 w-4" />
            List
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'board' ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            onClick={() => setView('board')}
          >
            <FolderKanban className="mr-1 inline-block h-4 w-4" />
            Board
          </button>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {view === 'list' ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-700"
            >
              <Flag className={`h-4 w-4 flex-shrink-0 ${getTaskPriorityColor(task.priority)}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
                {task.dueDate && (
                  <p className="text-xs text-gray-500">Due {formatDate(task.dueDate)}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getTaskStatusColor(task.status)}`}
              >
                {task.status.replace('_', ' ')}
              </span>
              <div className="w-20 text-right text-sm text-gray-500">
                {task.loggedHours}h / {task.estimatedHours}h
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {(Object.keys(tasksByStatus) as TaskStatus[]).map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium capitalize text-gray-700 dark:text-gray-300">
                  {status.replace('_', ' ')}
                </h4>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                  {tasksByStatus[status].length}
                </span>
              </div>
              <div className="space-y-2">
                {tasksByStatus[status].map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </p>
                      <Flag className={`h-3.5 w-3.5 ${getTaskPriorityColor(task.priority)}`} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        <Timer className="inline h-3 w-3" /> {task.loggedHours}h
                      </span>
                      {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Time Tab Component
// ============================================================================

function TimeTab({ entries, project }: Readonly<{ entries: TimeEntry[]; project: Project }>) {
  const totalBillable = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0);
  const totalNonBillable = entries.filter((e) => !e.billable).reduce((sum, e) => sum + e.hours, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
              <Timer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {project.hoursLogged}h
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/30">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Billable Hours</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalBillable}h</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-700">
              <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Non-Billable</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalNonBillable}h</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Time Entries</h3>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Log Time
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-700"
          >
            <div className="flex-shrink-0 text-sm text-gray-500">{formatDate(entry.date)}</div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{entry.description}</p>
              {entry.task && <p className="text-xs text-gray-500">{entry.task}</p>}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.billable ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
            >
              {entry.billable ? 'Billable' : 'Non-billable'}
            </span>
            <span className="w-16 text-right font-medium text-gray-900 dark:text-white">
              {entry.hours}h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProjectDetailPage({ params }: Readonly<{ params: { projectId: string } }>) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const project = mockProject;

  const tabs: { id: TabType; label: string; icon: typeof FolderKanban }[] = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
    { id: 'time', label: 'Time', icon: Timer },
    { id: 'budget', label: 'Budget', icon: DollarSign },
    { id: 'files', label: 'Files', icon: Paperclip },
    { id: 'activity', label: 'Activity', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-4">
          <Link
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            href="/projects"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(project.status)}`}
              >
                {project.status.replace('_', ' ')}
              </span>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                {project.platform}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {project.name}
            </h1>
            <Link
              className="mt-1 inline-flex items-center gap-2 text-gray-500 hover:text-blue-600 dark:text-gray-400"
              href={`/clients/${project.client.id}`}
            >
              <Building2 className="h-4 w-4" />
              {project.client.name}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <PlayCircle className="h-4 w-4" />
              Start Timer
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-t border-gray-200 pt-4 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab project={project} />}
        {activeTab === 'tasks' && <TasksTab tasks={mockTasks} />}
        {activeTab === 'time' && <TimeTab entries={mockTimeEntries} project={project} />}
        {activeTab === 'budget' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <DollarSign className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 font-medium text-gray-900 dark:text-white">Budget Tracker</h3>
            <p className="mt-1 text-sm text-gray-500">Detailed budget tracking view</p>
          </div>
        )}
        {activeTab === 'files' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <Paperclip className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 font-medium text-gray-900 dark:text-white">Project Files</h3>
            <p className="mt-1 text-sm text-gray-500">File attachments and deliverables</p>
          </div>
        )}
        {activeTab === 'activity' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="mt-4 font-medium text-gray-900 dark:text-white">Activity Feed</h3>
            <p className="mt-1 text-sm text-gray-500">Project activity and communications</p>
          </div>
        )}
      </div>
    </div>
  );
}
