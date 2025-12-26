/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Time Entry Form Component
 *
 * Full form for creating and editing time entries with project selection,
 * duration picker, date picker, and all entry options.
 *
 * @module components/time/time-entry-form
 */

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Calendar,
  Clock,
  Briefcase,
  Tag,
  DollarSign,
  FileText,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Project {
  id: string;
  name: string;
  color: string;
  clientName: string;
  defaultHourlyRate?: number;
}

interface Task {
  id: string;
  name: string;
  projectId: string;
}

export interface TimeEntryFormData {
  id?: string;
  description: string;
  projectId: string;
  taskId?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  hourlyRate?: number;
  billable: boolean;
  tags: string[];
  notes?: string;
}

export interface TimeEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TimeEntryFormData) => void;
  entry?: Partial<TimeEntryFormData>;
  projects: Project[];
  tasks?: Task[];
  mode?: 'create' | 'edit';
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return end >= start ? end - start : 24 * 60 - start + end;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

// ============================================================================
// Duration Picker Component
// ============================================================================

function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  const handleHoursChange = (h: number) => {
    onChange(h * 60 + minutes);
  };

  const handleMinutesChange = (m: number) => {
    onChange(hours * 60 + m);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={23}
          value={hours}
          onChange={(e) => handleHoursChange(parseInt(e.target.value) || 0)}
          className="w-16 rounded border border-gray-200 px-2 py-2 text-center text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
        />
        <span className="text-sm text-gray-500">h</span>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={59}
          step={5}
          value={minutes}
          onChange={(e) => handleMinutesChange(parseInt(e.target.value) || 0)}
          className="w-16 rounded border border-gray-200 px-2 py-2 text-center text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
        />
        <span className="text-sm text-gray-500">m</span>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Duration Buttons
// ============================================================================

function QuickDurationButtons({ onSelect }: { onSelect: (minutes: number) => void }) {
  const presets = [15, 30, 45, 60, 90, 120, 180, 240];

  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((mins) => (
        <button
          key={mins}
          type="button"
          onClick={() => onSelect(mins)}
          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          {formatDuration(mins)}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Time Entry Form Component
// ============================================================================

export function TimeEntryForm({
  isOpen,
  onClose,
  onSave,
  entry,
  projects,
  tasks = [],
  mode = 'create',
}: TimeEntryFormProps) {
  const [formData, setFormData] = useState<TimeEntryFormData>({
    description: '',
    projectId: '',
    taskId: '',
    date: getCurrentDate(),
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    hourlyRate: undefined,
    billable: true,
    tags: [],
    notes: '',
  });

  const [tagInput, setTagInput] = useState('');
  const [timeMode, setTimeMode] = useState<'range' | 'duration'>('range');
  const [projectSearch, setProjectSearch] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Initialize form with entry data or defaults
  useEffect(() => {
    if (entry) {
      setFormData({
        id: entry.id,
        description: entry.description || '',
        projectId: entry.projectId || '',
        taskId: entry.taskId || '',
        date: entry.date || getCurrentDate(),
        startTime: entry.startTime || '09:00',
        endTime: entry.endTime || '10:00',
        duration: entry.duration || 60,
        hourlyRate: entry.hourlyRate,
        billable: entry.billable ?? true,
        tags: entry.tags || [],
        notes: entry.notes || '',
      });
    } else {
      // Reset to defaults
      setFormData({
        description: '',
        projectId: '',
        taskId: '',
        date: getCurrentDate(),
        startTime: getCurrentTime(),
        endTime: minutesToTime(parseTimeToMinutes(getCurrentTime()) + 60),
        duration: 60,
        hourlyRate: undefined,
        billable: true,
        tags: [],
        notes: '',
      });
    }
  }, [entry, isOpen]);

  // Focus description on open
  useEffect(() => {
    if (isOpen && descriptionRef.current) {
      setTimeout(() => descriptionRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close project dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update duration when times change
  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    const updated = { ...formData, [field]: value };
    if (timeMode === 'range') {
      updated.duration = calculateDuration(updated.startTime, updated.endTime);
    }
    setFormData(updated);
  };

  // Update end time when duration changes
  const handleDurationChange = (duration: number) => {
    if (timeMode === 'duration') {
      const start = parseTimeToMinutes(formData.startTime);
      const endTime = minutesToTime(start + duration);
      setFormData({ ...formData, duration, endTime });
    } else {
      setFormData({ ...formData, duration });
    }
  };

  // Handle project selection
  const handleProjectSelect = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    setFormData({
      ...formData,
      projectId,
      hourlyRate: project?.defaultHourlyRate || formData.hourlyRate,
      taskId: '', // Reset task when project changes
    });
    setIsProjectDropdownOpen(false);
    setProjectSearch('');
  };

  // Handle tag input
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId) return;
    onSave(formData);
    onClose();
  };

  // Filter projects
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.clientName.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // Get selected project
  const selectedProject = projects.find((p) => p.id === formData.projectId);

  // Get tasks for selected project
  const projectTasks = tasks.filter((t) => t.projectId === formData.projectId);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
        <div
          className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {mode === 'create' ? 'Add Time Entry' : 'Edit Time Entry'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {/* Description */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  ref={descriptionRef}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What did you work on?"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Project */}
              <div className="mb-4" ref={projectDropdownRef}>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Project <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-gray-300 dark:border-gray-600"
                  >
                    {selectedProject ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: selectedProject.color }}
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {selectedProject.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Select a project</span>
                    )}
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  {isProjectDropdownOpen && (
                    <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <div className="border-b border-gray-200 p-2 dark:border-gray-700">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search projects..."
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            className="w-full rounded-md border-0 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-2">
                        {filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => handleProjectSelect(project.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              project.id === formData.projectId
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : ''
                            }`}
                          >
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 dark:text-white">
                                {project.name}
                              </p>
                              <p className="text-xs text-gray-500">{project.clientName}</p>
                            </div>
                            {project.id === formData.projectId && (
                              <Check className="h-4 w-4 text-blue-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Task (if project has tasks) */}
              {projectTasks.length > 0 && (
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Task
                  </label>
                  <select
                    value={formData.taskId}
                    onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
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

              {/* Date */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              {/* Time Mode Toggle */}
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimeMode('range')}
                  className={`rounded-lg px-3 py-1 text-sm font-medium ${
                    timeMode === 'range'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  Time Range
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode('duration')}
                  className={`rounded-lg px-3 py-1 text-sm font-medium ${
                    timeMode === 'duration'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  Duration
                </button>
              </div>

              {/* Time Inputs */}
              <div className="mb-4">
                {timeMode === 'range' ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">Start</label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => handleTimeChange('startTime', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">End</label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => handleTimeChange('endTime', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
                      />
                    </div>
                    <div className="text-right">
                      <label className="mb-1 block text-xs text-gray-500">Duration</label>
                      <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                        {formatDuration(formData.duration)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Duration</label>
                    <DurationPicker value={formData.duration} onChange={handleDurationChange} />
                    <div className="mt-2">
                      <QuickDurationButtons onSelect={handleDurationChange} />
                    </div>
                  </div>
                )}
              </div>

              {/* Hourly Rate & Billable */}
              <div className="mb-4 flex items-end gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hourly Rate
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={formData.hourlyRate || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          hourlyRate: parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billable: !formData.billable })}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      formData.billable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        formData.billable ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Billable</span>
                </div>
              </div>

              {/* Tags */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-600">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-blue-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="min-w-[100px] flex-1 border-0 bg-transparent p-1 text-sm focus:outline-none dark:text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.projectId}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {mode === 'create' ? 'Add Entry' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default TimeEntryForm;
