'use client';

/**
 * Projects List Page
 *
 * Main projects management page with list, board, and timeline views.
 * Displays all projects across clients with filtering and sorting.
 *
 * @module app/projects/page
 */

/* eslint-disable @next/next/no-img-element */

import { useQuery } from '@tanstack/react-query';
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
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

import { projectsApi, type Project, type ProjectListParams } from '@/lib/api/projects';

// ============================================================================
// Types
// ============================================================================

type ProjectStatus = 'active' | 'completed' | 'paused' | 'cancelled' | 'draft';
type ViewMode = 'list' | 'board' | 'timeline';

// Map API status to display status
const STATUS_MAP: Record<string, ProjectStatus> = {
  draft: 'draft',
  active: 'active',
  paused: 'paused',
  completed: 'completed',
  cancelled: 'cancelled',
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
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
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    draft: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return colors[status] || colors.draft;
}

function getPriorityColor(priority: Project['priority']): string {
  const colors: Record<Project['priority'], string> = {
    urgent: 'text-red-600 dark:text-red-400',
    high: 'text-orange-600 dark:text-orange-400',
    medium: 'text-amber-600 dark:text-amber-400',
    low: 'text-gray-400 dark:text-gray-500',
  };
  return colors[priority] || colors.medium;
}

function getTypeLabel(type: Project['type']): string {
  const labels: Record<Project['type'], string> = {
    fixed: 'Fixed Price',
    hourly: 'Hourly',
    retainer: 'Retainer',
  };
  return labels[type] || type;
}

function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    skillancer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    upwork: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    fiverr: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    toptal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    freelancer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    direct: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return colors[source.toLowerCase()] || colors.direct;
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
// Loading Skeleton Components
// ============================================================================

function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="mt-4 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="mt-4 flex justify-between">
        <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

function ProjectListRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
      <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1">
        <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-1 h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ============================================================================
// Error Component
// ============================================================================

function ErrorDisplay({ error, onRetry }: Readonly<{ error: Error; onRetry: () => void }>) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
      <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
      <h3 className="mt-4 text-lg font-medium text-red-900 dark:text-red-100">
        Failed to load projects
      </h3>
      <p className="mt-1 text-red-700 dark:text-red-300">{error.message}</p>
      <button
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Stats Component
// ============================================================================

function ProjectStats({
  projects,
  isLoading,
}: Readonly<{ projects: Project[]; isLoading: boolean }>) {
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalValue = projects.reduce((sum, p) => sum + (p.budget?.amount || 0), 0);
  const totalRevenue = projects.reduce((sum, p) => {
    const spent = p.budget?.amount ? (p.budget.amount * p.progress) / 100 : 0;
    return sum + spent;
  }, 0);
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
              {isLoading ? (
                <div className="mt-1 h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : (
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
              )}
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
  const budgetAmount = project.budget?.amount || 0;
  const spent = budgetAmount * (project.progress / 100);
  const isOverBudget = spent > budgetAmount;
  const budgetPercent = Math.min((spent / budgetAmount) * 100, 100);
  const status = STATUS_MAP[project.status] || 'draft';

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
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(status)}`}
            >
              {status.replace('_', ' ')}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getSourceColor(project.source)}`}
            >
              {project.source}
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
      {project.clientName && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-medium text-white">
            {getInitials(project.clientName)}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">{project.clientName}</span>
        </div>
      )}

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
      {budgetAmount > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Budget</span>
            <span
              className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}
            >
              {formatCurrency(spent, project.budget?.currency)} /{' '}
              {formatCurrency(budgetAmount, project.budget?.currency)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm dark:border-gray-700">
        {project.budget?.hourlyRate && (
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Timer className="h-4 w-4" />
            {formatCurrency(project.budget.hourlyRate, project.budget.currency)}/h
          </div>
        )}
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
  const budgetAmount = project.budget?.amount || 0;
  const status = STATUS_MAP[project.status] || 'draft';

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
          <span>{project.clientName || 'No client'}</span>
          <span>·</span>
          <span>{getTypeLabel(project.type)}</span>
        </div>
      </div>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getSourceColor(project.source)}`}
      >
        {project.source}
      </span>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(status)}`}
      >
        {status.replace('_', ' ')}
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
          {formatCurrency(budgetAmount, project.budget?.currency)}
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
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<Project['type'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'dueDate' | 'progress'>('createdAt');

  // Build query params
  const queryParams: ProjectListParams = {
    search: searchQuery || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    sortBy: sortBy,
    sortOrder: 'desc',
    limit: 100,
  };

  // Fetch projects with TanStack Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', queryParams],
    queryFn: () => projectsApi.list(queryParams),
  });

  const projects = useMemo(() => data?.projects || [], [data?.projects]);

  // Client-side filtering for type (not supported by API params directly)
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Type filter (client-side)
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        case 'progress':
          return b.progress - a.progress;
        case 'createdAt':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [projects, typeFilter, sortBy]);

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
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            href="/projects/new"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Stats */}
        <ProjectStats isLoading={isLoading} projects={projects} />

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
              onChange={(e) => setStatusFilter(e.target.value as Project['status'] | 'all')}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">On Hold</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>

            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as Project['type'] | 'all')}
            >
              <option value="all">All Types</option>
              <option value="fixed">Fixed Price</option>
              <option value="hourly">Hourly</option>
              <option value="retainer">Retainer</option>
            </select>

            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="createdAt">Sort: Recent</option>
              <option value="name">Sort: Name</option>
              <option value="dueDate">Sort: Due Date</option>
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
          {error ? (
            <ErrorDisplay error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            viewMode === 'list' ? (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-500 dark:border-gray-700">
                  <div className="w-4" />
                  <div className="flex-1">Project</div>
                  <div className="w-20">Platform</div>
                  <div className="w-20">Status</div>
                  <div className="w-24">Progress</div>
                  <div className="w-24 text-right">Budget</div>
                  <div className="w-24 text-right">Due Date</div>
                  <div className="w-8" />
                </div>
                {Array.from({ length: 5 }, (_, i) => (
                  <ProjectListRowSkeleton key={`skeleton-row-${i}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <ProjectCardSkeleton key={`skeleton-card-${i}`} />
                ))}
              </div>
            )
          ) : filteredProjects.length > 0 ? (
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
                {(['active', 'paused', 'completed', 'cancelled'] as const).map((status) => {
                  const statusProjects = filteredProjects.filter((p) => p.status === status);
                  return (
                    <div key={status} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium capitalize text-gray-900 dark:text-white">
                          {status === 'paused' ? 'On Hold' : status}
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
                })}
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
              <Link
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                href="/projects/new"
              >
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
