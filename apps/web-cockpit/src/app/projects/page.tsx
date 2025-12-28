'use client';

/**
 * Projects List Page
 *
 * Main projects management page with list, board, and timeline views.
 * Displays all projects across clients with filtering and sorting.
 *
 * @module app/projects/page
 */

import {
  FolderKanban,
  Search,
  Plus,
  List,
  Kanban,
  Calendar,
  MoreHorizontal,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Timer,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled';
type ProjectType = 'fixed' | 'hourly' | 'retainer' | 'milestone';
type ViewMode = 'list' | 'board' | 'timeline';

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
  tasksTotal: number;
  tasksCompleted: number;
  tags?: string[];
  priority: 'low' | 'medium' | 'high';
}

// ============================================================================
// Mock Data
// ============================================================================

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'E-commerce Platform Redesign',
    description: 'Complete redesign of the main shopping experience',
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
    tasksTotal: 24,
    tasksCompleted: 16,
    tags: ['React', 'TypeScript', 'E-commerce'],
    priority: 'high',
  },
  {
    id: '2',
    name: 'Mobile App Development',
    description: 'Cross-platform mobile app for order tracking',
    client: { id: '2', name: 'Acme Solutions', avatar: undefined },
    status: 'active',
    type: 'hourly',
    platform: 'Upwork',
    budget: 15000,
    spent: 8500,
    progress: 40,
    startDate: '2024-02-01',
    dueDate: '2024-05-30',
    hoursLogged: 85,
    hoursEstimated: 200,
    tasksTotal: 18,
    tasksCompleted: 7,
    tags: ['React Native', 'Mobile'],
    priority: 'high',
  },
  {
    id: '3',
    name: 'API Integration Project',
    description: 'Third-party API integrations for payment processing',
    client: { id: '3', name: 'GlobalTech', avatar: undefined },
    status: 'on_hold',
    type: 'fixed',
    platform: 'Direct',
    budget: 8000,
    spent: 3000,
    progress: 30,
    startDate: '2024-01-20',
    dueDate: '2024-03-20',
    hoursLogged: 40,
    hoursEstimated: 100,
    tasksTotal: 12,
    tasksCompleted: 4,
    tags: ['Node.js', 'API'],
    priority: 'medium',
  },
  {
    id: '4',
    name: 'Brand Identity Package',
    description: 'Logo, brand guidelines, and marketing materials',
    client: { id: '4', name: 'StartupXYZ', avatar: undefined },
    status: 'completed',
    type: 'fixed',
    platform: 'Fiverr',
    budget: 5000,
    spent: 4800,
    progress: 100,
    startDate: '2024-01-01',
    endDate: '2024-02-15',
    hoursLogged: 60,
    hoursEstimated: 60,
    tasksTotal: 8,
    tasksCompleted: 8,
    tags: ['Design', 'Branding'],
    priority: 'low',
  },
  {
    id: '5',
    name: 'Monthly Retainer - Maintenance',
    description: 'Ongoing website maintenance and support',
    client: { id: '1', name: 'TechCorp Inc', avatar: undefined },
    status: 'active',
    type: 'retainer',
    platform: 'Direct',
    budget: 2000,
    spent: 1500,
    progress: 75,
    startDate: '2024-01-01',
    hoursLogged: 15,
    hoursEstimated: 20,
    tasksTotal: 5,
    tasksCompleted: 4,
    tags: ['Maintenance', 'Support'],
    priority: 'medium',
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

function getPriorityColor(priority: Project['priority']): string {
  const colors: Record<Project['priority'], string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-gray-400 dark:text-gray-500',
  };
  return colors[priority];
}

function getTypeLabel(type: ProjectType): string {
  const labels: Record<ProjectType, string> = {
    fixed: 'Fixed Price',
    hourly: 'Hourly',
    retainer: 'Retainer',
    milestone: 'Milestone',
  };
  return labels[type];
}

function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    Skillancer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Upwork: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Fiverr: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Direct: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return colors[platform] || colors.Direct;
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
// Stats Component
// ============================================================================

function ProjectStats({ projects }: Readonly<{ projects: Project[] }>) {
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalValue = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalRevenue = projects.reduce((sum, p) => sum + p.spent, 0);
  const avgProgress =
    projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
      : 0;

  const stats = [
    { label: 'Active Projects', value: activeProjects, icon: FolderKanban, color: 'text-blue-600' },
    {
      label: 'Total Pipeline',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      label: 'Revenue Earned',
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      color: 'text-emerald-600',
    },
    {
      label: 'Avg Progress',
      value: `${avgProgress}%`,
      icon: CheckCircle2,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-lg bg-gray-50 p-2 dark:bg-gray-700 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Project Card Component
// ============================================================================

function ProjectCard({ project }: Readonly<{ project: Project }>) {
  const isOverBudget = project.spent > project.budget;
  const budgetPercent = Math.min((project.spent / project.budget) * 100, 100);

  return (
    <Link
      className="group block rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      href={`/projects/${project.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(project.status)}`}
            >
              {project.status.replace('_', ' ')}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(project.platform)}`}
            >
              {project.platform}
            </span>
          </div>
          <h3 className="mt-2 truncate font-medium text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {project.name}
          </h3>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
            {project.description}
          </p>
        </div>
        <div className={`flex-shrink-0 ${getPriorityColor(project.priority)}`}>
          <AlertCircle className="h-4 w-4" />
        </div>
      </div>

      {/* Client */}
      <div className="mt-3 flex items-center gap-2">
        {project.client.avatar ? (
          <img
            alt={project.client.name}
            className="h-6 w-6 rounded-full"
            src={project.client.avatar}
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-medium text-white">
            {getInitials(project.client.name)}
          </div>
        )}
        <span className="text-sm text-gray-600 dark:text-gray-400">{project.client.name}</span>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Progress</span>
          <span className="font-medium text-gray-900 dark:text-white">{project.progress}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Budget */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Budget</span>
          <span
            className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
          >
            {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm dark:border-gray-700">
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Timer className="h-4 w-4" />
          {project.hoursLogged}h{project.hoursEstimated && ` / ${project.hoursEstimated}h`}
        </div>
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <CheckCircle2 className="h-4 w-4" />
          {project.tasksCompleted}/{project.tasksTotal}
        </div>
        {project.dueDate && (
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            {formatDate(project.dueDate)}
          </div>
        )}
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ============================================================================
// Project List Row Component
// ============================================================================

function ProjectListRow({ project }: Readonly<{ project: Project }>) {
  return (
    <Link
      className="group flex items-center gap-4 border-b border-gray-100 px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
      href={`/projects/${project.id}`}
    >
      <div
        className={`h-2 w-2 flex-shrink-0 rounded-full ${getPriorityColor(project.priority).replace('text-', 'bg-')}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {project.name}
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{project.client.name}</span>
          <span>·</span>
          <span>{getTypeLabel(project.type)}</span>
        </div>
      </div>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(project.platform)}`}
      >
        {project.platform}
      </span>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(project.status)}`}
      >
        {project.status.replace('_', ' ')}
      </span>
      <div className="w-24 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{project.progress}%</span>
        </div>
      </div>
      <div className="w-24 flex-shrink-0 text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(project.budget)}
        </p>
      </div>
      <div className="w-24 flex-shrink-0 text-right text-sm text-gray-500">
        {project.dueDate ? formatDate(project.dueDate) : '—'}
      </div>
      <button
        className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-700"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </Link>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'budget' | 'progress'>('date');

  const filteredProjects = useMemo(() => {
    let result = [...mockProjects];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.client.name.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'budget':
          return b.budget - a.budget;
        case 'progress':
          return b.progress - a.progress;
        case 'date':
        default:
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      }
    });

    return result;
  }, [searchQuery, statusFilter, typeFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Track and manage your projects across all clients
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats */}
        <ProjectStats projects={mockProjects} />

        {/* Filters & Search */}
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Search projects..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ProjectType | 'all')}
            >
              <option value="all">All Types</option>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Hourly</option>
              <option value="retainer">Retainer</option>
              <option value="milestone">Milestone</option>
            </select>

            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="date">Sort: Recent</option>
              <option value="name">Sort: Name</option>
              <option value="budget">Sort: Budget</option>
              <option value="progress">Sort: Progress</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-600">
            <button
              className={`rounded-l-lg p-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-5 w-5" />
            </button>
            <button
              className={`p-2 ${viewMode === 'board' ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              onClick={() => setViewMode('board')}
            >
              <Kanban className="h-5 w-5" />
            </button>
            <button
              className={`rounded-r-lg p-2 ${viewMode === 'timeline' ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              onClick={() => setViewMode('timeline')}
            >
              <Calendar className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Project Display */}
        <div className="mt-6">
          {filteredProjects.length > 0 ? (
            viewMode === 'list' ? (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-500 dark:border-gray-700">
                  <div className="w-4" /> {/* Priority dot */}
                  <div className="flex-1">Project</div>
                  <div className="w-20">Platform</div>
                  <div className="w-20">Status</div>
                  <div className="w-24">Progress</div>
                  <div className="w-24 text-right">Budget</div>
                  <div className="w-24 text-right">Due Date</div>
                  <div className="w-8" /> {/* Actions */}
                </div>
                {filteredProjects.map((project) => (
                  <ProjectListRow key={project.id} project={project} />
                ))}
              </div>
            ) : viewMode === 'board' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {(['active', 'on_hold', 'completed', 'cancelled'] as ProjectStatus[]).map(
                  (status) => {
                    const statusProjects = filteredProjects.filter((p) => p.status === status);
                    return (
                      <div key={status} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium capitalize text-gray-900 dark:text-white">
                            {status.replace('_', ' ')}
                          </h3>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-gray-700">
                            {statusProjects.length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {statusProjects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                          ))}
                          {statusProjects.length === 0 && (
                            <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
                              <p className="text-sm text-gray-400">No projects</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              // Timeline view - placeholder
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                <Calendar className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-4 font-medium text-gray-900 dark:text-white">Timeline View</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Gantt-style timeline view coming soon
                </p>
              </div>
            )
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
              <FolderKanban className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                No projects found
              </h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first project to get started'}
              </p>
              <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
