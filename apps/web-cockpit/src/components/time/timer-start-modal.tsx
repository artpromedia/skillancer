/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Timer Start Modal Component
 *
 * Modal dialog for starting a new timer with project selection,
 * description, and optional task assignment.
 *
 * @module components/time/timer-start-modal
 */

import { X, Play, Briefcase, Tag, Clock, Search, Check, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Project {
  id: string;
  name: string;
  color: string;
  clientName: string;
}

interface Task {
  id: string;
  name: string;
  projectId: string;
}

interface RecentEntry {
  id: string;
  description: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskId?: string;
  taskName?: string;
}

export interface TimerStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (data: {
    projectId: string;
    description: string;
    taskId?: string;
    tags?: string[];
    billable?: boolean;
  }) => void;
  projects: Project[];
  tasks?: Task[];
  recentEntries?: RecentEntry[];
}

// ============================================================================
// Project Selector Component
// ============================================================================

function ProjectSelector({
  projects,
  selectedId,
  onSelect,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find((p) => p.id === selectedId);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {selectedProject ? (
            <>
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: selectedProject.color }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedProject.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedProject.clientName}
                </p>
              </div>
            </>
          ) : (
            <>
              <Briefcase className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Select a project</span>
            </>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-2 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-md border-0 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Search projects..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {filteredProjects.length === 0 ? (
              <p className="p-3 text-center text-sm text-gray-500">No projects found</p>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    project.id === selectedId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    onSelect(project.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{project.clientName}</p>
                  </div>
                  {project.id === selectedId && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Recent Entry Quick Select
// ============================================================================

function RecentEntries({
  entries,
  onSelect,
}: {
  entries: RecentEntry[];
  onSelect: (entry: RecentEntry) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Recent</p>
      <div className="space-y-2">
        {entries.slice(0, 3).map((entry) => (
          <button
            key={entry.id}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/20"
            type="button"
            onClick={() => onSelect(entry)}
          >
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.projectColor }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-900 dark:text-white">
                {entry.description || 'No description'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{entry.projectName}</p>
            </div>
            <Clock className="h-4 w-4 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Timer Start Modal Component
// ============================================================================

export function TimerStartModal({
  isOpen,
  onClose,
  onStart,
  projects,
  tasks = [],
  recentEntries = [],
}: TimerStartModalProps) {
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const descriptionRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setProjectId('');
      setTaskId('');
      setIsBillable(true);
      setTags([]);
      setTagInput('');
      // Focus description input
      setTimeout(() => descriptionRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, projectId, description]);

  const handleSubmit = () => {
    if (!projectId) return;

    onStart({
      projectId,
      description,
      taskId: taskId || undefined,
      tags: tags.length > 0 ? tags : undefined,
      billable: isBillable,
    });

    onClose();
  };

  const handleRecentSelect = (entry: RecentEntry) => {
    setDescription(entry.description);
    setProjectId(entry.projectId);
    if (entry.taskId) {
      setTaskId(entry.taskId);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const projectTasks = tasks.filter((t) => t.projectId === projectId);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-interactions */}
        <div
          aria-modal="true"
          className="w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-gray-800"
          role="dialog"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Start Timer</h2>
            <button
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Recent Entries */}
            <RecentEntries entries={recentEntries} onSelect={handleRecentSelect} />

            {/* Description */}
            <div className="mb-4">
              <label
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                htmlFor="timer-description"
              >
                What are you working on?
              </label>
              <input
                ref={descriptionRef}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                id="timer-description"
                placeholder="Enter a description..."
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Project */}
            <div className="mb-4">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Project <span className="text-red-500">*</span>
              </span>
              <ProjectSelector projects={projects} selectedId={projectId} onSelect={setProjectId} />
            </div>

            {/* Task */}
            {projectTasks.length > 0 && (
              <div className="mb-4">
                <label
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  htmlFor="timer-task"
                >
                  Task
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  id="timer-task"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                >
                  <option value="">No task</option>
                  {projectTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags */}
            <div className="mb-4">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tags
              </span>
              <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-600">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    #{tag}
                    <button
                      className="ml-0.5 hover:text-blue-900"
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-[100px] flex-1 border-0 bg-transparent p-1 text-sm focus:outline-none dark:text-white"
                  placeholder="Add tag..."
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
              </div>
            </div>

            {/* Billable Toggle */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billable</span>
              <button
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isBillable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                type="button"
                onClick={() => setIsBillable(!isBillable)}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isBillable ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!projectId}
              onClick={handleSubmit}
            >
              <Play className="h-4 w-4" />
              Start Timer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default TimerStartModal;
