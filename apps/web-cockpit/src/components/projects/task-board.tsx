/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Task Board Component
 *
 * Compact task list with quick actions for project task management.
 *
 * @module components/projects/task-board
 */

import {
  Plus,
  MoreHorizontal,
  Flag,
  Timer,
  Calendar,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Copy,
  PlayCircle,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
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
  subtasks?: { id: string; title: string; completed: boolean }[];
}

export interface TaskBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onStartTimer?: (task: Task) => void;
}

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
  if (diffDays < 7) return `${diffDays}d`;
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

function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    todo: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return colors[status];
}

function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  };
  return labels[status];
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
// Task Menu Component
// ============================================================================

function TaskMenu({
  task,
  onStatusChange,
  onClose,
}: Readonly<{
  task: Task;
  onStatusChange?: (status: TaskStatus) => void;
  onClose: () => void;
}>) {
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

  return (
    <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 pb-1 dark:border-gray-700">
        {statuses.map((status) => (
          <button
            key={status}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
              task.status === status ? 'bg-gray-50 dark:bg-gray-700' : ''
            }`}
            onClick={() => {
              onStatusChange?.(status);
              onClose();
            }}
          >
            <span
              className={`h-2 w-2 rounded-full ${getStatusColor(status).replace('text-', 'bg-').split(' ')[0]}`}
            />
            {getStatusLabel(status)}
          </button>
        ))}
      </div>
      <button className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
        <Edit className="h-4 w-4" />
        Edit
      </button>
      <button className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
        <Copy className="h-4 w-4" />
        Duplicate
      </button>
      <button className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700">
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}

// ============================================================================
// Task Row Component
// ============================================================================

function TaskRow({
  task,
  onClick,
  onStatusChange,
  onStartTimer,
}: Readonly<{
  task: Task;
  onClick?: () => void;
  onStatusChange?: (status: TaskStatus) => void;
  onStartTimer?: () => void;
}>) {
  const [showMenu, setShowMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const overdue = task.dueDate && task.status !== 'done' && isOverdue(task.dueDate);
  const subtasksCompleted = task.subtasks?.filter((s) => s.completed).length || 0;
  const subtasksTotal = task.subtasks?.length || 0;

  return (
    <div className="group border-b border-gray-100 last:border-0 dark:border-gray-700">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        {/* Status checkbox */}
        <button
          className="flex-shrink-0"
          onClick={() => onStatusChange?.(task.status === 'done' ? 'todo' : 'done')}
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className={`h-5 w-5 ${getPriorityColor(task.priority)}`} />
          )}
        </button>

        {/* Priority flag */}
        <Flag className={`h-4 w-4 flex-shrink-0 ${getPriorityColor(task.priority)}`} />

        {/* Task content */}
        <button className="min-w-0 flex-1 text-left" type="button" onClick={onClick}>
          <div className="flex items-center gap-2">
            <span
              className={`cursor-pointer font-medium text-gray-900 dark:text-white ${task.status === 'done' ? 'line-through opacity-50' : ''}`}
            >
              {task.title}
            </span>
            {subtasksTotal > 0 && (
              <button
                className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {subtasksCompleted}/{subtasksTotal}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
          {task.description && (
            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
              {task.description}
            </p>
          )}
        </button>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 ${overdue ? 'font-medium text-red-500' : ''}`}
            >
              <Calendar className="h-4 w-4" />
              {formatDate(task.dueDate)}
            </span>
          )}

          {task.estimatedHours && (
            <span className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              {task.loggedHours}/{task.estimatedHours}h
            </span>
          )}

          {task.assignee &&
            (task.assignee.avatar ? (
              <img
                alt={task.assignee.name}
                className="h-6 w-6 rounded-full"
                src={task.assignee.avatar}
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[10px] font-medium text-white">
                {getInitials(task.assignee.name)}
              </div>
            ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            title="Start timer"
            onClick={onStartTimer}
          >
            <PlayCircle className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <>
                <button
                  aria-label="Close menu"
                  className="fixed inset-0 cursor-default bg-transparent"
                  tabIndex={-1}
                  type="button"
                  onClick={() => setShowMenu(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowMenu(false);
                  }}
                />
                <TaskMenu
                  task={task}
                  onClose={() => setShowMenu(false)}
                  onStatusChange={onStatusChange}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && task.subtasks && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/30">
          {task.subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-3 py-1.5 pl-8">
              <button className="flex-shrink-0">
                {subtask.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <span
                className={`text-sm ${subtask.completed ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {subtask.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskBoard({
  tasks,
  onTaskClick,
  onAddTask,
  onStatusChange,
  onStartTimer,
}: Readonly<TaskBoardProps>) {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title'>('priority');

  const filteredTasks = tasks
    .filter((task) => filter === 'all' || task.status === filter)
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder: Record<TaskPriority, number> = {
          urgent: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value as TaskStatus | 'all')}
          >
            <option value="all">All Tasks</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>

          <select
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
            <option value="title">Name</option>
          </select>
        </div>

        <button
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          onClick={onAddTask}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Task List */}
      {filteredTasks.length > 0 ? (
        <div>
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              onStartTimer={() => onStartTimer?.(task)}
              onStatusChange={(status) => onStatusChange?.(task.id, status)}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'No tasks yet' : `No ${getStatusLabel(filter).toLowerCase()} tasks`}
          </p>
          <button
            className="mt-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            onClick={onAddTask}
          >
            Create a task
          </button>
        </div>
      )}
    </div>
  );
}

export default TaskBoard;
