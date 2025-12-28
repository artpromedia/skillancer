/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Project Board Component
 *
 * Kanban-style board view for project tasks with drag-and-drop.
 *
 * @module components/projects/project-board
 */

import {
  Plus,
  MoreHorizontal,
  Flag,
  Timer,
  Calendar,
  MessageSquare,
  Paperclip,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  estimatedHours?: number;
  loggedHours: number;
  assignee?: {
    name: string;
    avatar?: string;
  };
  tags?: string[];
  commentsCount: number;
  attachmentsCount: number;
}

export interface Column {
  id: TaskStatus;
  label: string;
  color: string;
}

export interface ProjectBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  onMoveTask?: (taskId: string, newStatus: TaskStatus) => void;
}

// ============================================================================
// Constants
// ============================================================================

const COLUMNS: Column[] = [
  { id: 'backlog', label: 'Backlog', color: 'bg-gray-400' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-400' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-400' },
  { id: 'review', label: 'Review', color: 'bg-purple-400' },
  { id: 'done', label: 'Done', color: 'bg-green-400' },
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays} days`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPriorityColor(priority: TaskPriority): string {
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

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

// ============================================================================
// Task Card Component
// ============================================================================

function TaskCard({ task, onClick }: Readonly<{ task: Task; onClick?: () => void }>) {
  const overdue = task.dueDate && task.status !== 'done' && isOverdue(task.dueDate);

  return (
    <button
      className="group block w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      type="button"
      onClick={onClick}
    >
      {/* Header with priority and menu */}
      <div className="flex items-start justify-between">
        <Flag className={`h-4 w-4 ${getPriorityColor(task.priority)}`} />
        <button
          className="rounded p-0.5 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <h4 className="mt-2 font-medium text-gray-900 dark:text-white">{task.title}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${overdue ? 'text-red-500' : ''}`}>
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.estimatedHours && (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {task.loggedHours}/{task.estimatedHours}h
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.commentsCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <MessageSquare className="h-3 w-3" />
              {task.commentsCount}
            </span>
          )}
          {task.attachmentsCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Paperclip className="h-3 w-3" />
              {task.attachmentsCount}
            </span>
          )}
          {task.assignee &&
            (task.assignee.avatar ? (
              <img
                alt={task.assignee.name}
                className="h-5 w-5 rounded-full"
                src={task.assignee.avatar}
              />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] font-medium text-white">
                {getInitials(task.assignee.name)}
              </div>
            ))}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Column Component
// ============================================================================

function BoardColumn({
  column,
  tasks,
  onTaskClick,
  onAddTask,
}: Readonly<{
  column: Column;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: () => void;
}>) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-full min-w-[280px] max-w-[320px] flex-col">
      {/* Column Header */}
      <div className="flex items-center justify-between rounded-t-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${column.color}`} />
          <h3 className="font-medium text-gray-900 dark:text-white">{column.label}</h3>
          <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
            onClick={onAddTask}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Cards */}
      {!isCollapsed && (
        <div className="flex-1 space-y-2 overflow-y-auto rounded-b-lg bg-gray-50 p-2 dark:bg-gray-900/50">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick?.(task)} />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center dark:border-gray-700">
              <p className="text-sm text-gray-400">No tasks</p>
              <button
                className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                onClick={onAddTask}
              >
                Add task
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectBoard({
  tasks,
  onTaskClick,
  onAddTask,
  onMoveTask,
}: Readonly<ProjectBoardProps>) {
  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce(
    (acc, column) => {
      acc[column.id] = tasks.filter((task) => task.status === column.id);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((column) => (
        <BoardColumn
          key={column.id}
          column={column}
          tasks={tasksByStatus[column.id]}
          onAddTask={() => onAddTask?.(column.id)}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}

export default ProjectBoard;
