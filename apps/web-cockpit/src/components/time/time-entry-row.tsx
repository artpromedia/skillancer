/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Time Entry Row Component
 *
 * Individual time entry row with inline editing, duration display,
 * and action buttons.
 *
 * @module components/time/time-entry-row
 */

import {
  Play,
  Pause,
  Edit3,
  Trash2,
  MoreHorizontal,
  Copy,
  Tag,
  DollarSign,
  Clock,
  Briefcase,
  Check,
  X,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TimeEntry {
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

export interface TimeEntryRowProps {
  entry: TimeEntry;
  isEditing?: boolean;
  onEdit?: (id: string) => void;
  onSave?: (entry: TimeEntry) => void;
  onCancel?: () => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (entry: TimeEntry) => void;
  onStartTimer?: (entry: TimeEntry) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
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

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateDuration(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return end >= start ? end - start : 24 * 60 - start + end;
}

// ============================================================================
// Time Entry Row Component
// ============================================================================

export function TimeEntryRow({
  entry,
  isEditing = false,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  onStartTimer,
}: TimeEntryRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editedEntry, setEditedEntry] = useState(entry);
  const menuRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  // Focus description input when editing starts
  useEffect(() => {
    if (isEditing && descriptionRef.current) {
      descriptionRef.current.focus();
      descriptionRef.current.select();
    }
  }, [isEditing]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle time changes
  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    const updated = { ...editedEntry, [field]: value };
    updated.duration = calculateDuration(updated.startTime, updated.endTime);
    setEditedEntry(updated);
  };

  // Calculate earnings
  const earnings =
    entry.billable && entry.hourlyRate ? (entry.duration / 60) * entry.hourlyRate : 0;

  // Editing mode
  if (isEditing) {
    return (
      <div className="flex items-center gap-4 rounded-lg border-2 border-blue-500 bg-blue-50 p-4 dark:border-blue-400 dark:bg-blue-900/20">
        {/* Project Color Indicator */}
        <div className="h-10 w-1 rounded-full" style={{ backgroundColor: entry.projectColor }} />

        {/* Description */}
        <div className="min-w-0 flex-1">
          <input
            ref={descriptionRef}
            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
            placeholder="What did you work on?"
            type="text"
            value={editedEntry.description}
            onChange={(e) => setEditedEntry({ ...editedEntry, description: e.target.value })}
          />
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Briefcase className="h-3 w-3" />
            <span>{entry.projectName}</span>
          </div>
        </div>

        {/* Time Inputs */}
        <div className="flex items-center gap-2">
          <input
            className="rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
            type="time"
            value={editedEntry.startTime}
            onChange={(e) => handleTimeChange('startTime', e.target.value)}
          />
          <span className="text-gray-400">-</span>
          <input
            className="rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700"
            type="time"
            value={editedEntry.endTime}
            onChange={(e) => handleTimeChange('endTime', e.target.value)}
          />
        </div>

        {/* Duration Display */}
        <div className="text-right">
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
            {formatDuration(editedEntry.duration)}
          </span>
        </div>

        {/* Billable Toggle */}
        <button
          className={`rounded p-1.5 ${
            editedEntry.billable
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
          }`}
          title={editedEntry.billable ? 'Billable' : 'Non-billable'}
          onClick={() => setEditedEntry({ ...editedEntry, billable: !editedEntry.billable })}
        >
          <DollarSign className="h-4 w-4" />
        </button>

        {/* Save/Cancel Actions */}
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1.5 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
            title="Save"
            onClick={() => onSave?.(editedEntry)}
          >
            <Check className="h-5 w-5" />
          </button>
          <button
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            title="Cancel"
            onClick={onCancel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <div className="group flex items-center gap-4 rounded-lg p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
      {/* Project Color Indicator */}
      <div className="h-10 w-1 rounded-full" style={{ backgroundColor: entry.projectColor }} />

      {/* Description & Project */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {entry.description || 'No description'}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Briefcase className="h-3 w-3" />
          <span>{entry.projectName}</span>
          {entry.taskName && (
            <>
              <span>•</span>
              <span>{entry.taskName}</span>
            </>
          )}
          {entry.tags.length > 0 && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {entry.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-blue-600 dark:text-blue-400">
                    #{tag}
                  </span>
                ))}
                {entry.tags.length > 2 && (
                  <span className="text-gray-400">+{entry.tags.length - 2}</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Time Range */}
      <div className="text-right">
        <p className="text-sm text-gray-900 dark:text-white">
          {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(entry.duration)}</p>
      </div>

      {/* Earnings (if billable) */}
      {entry.billable && earnings > 0 && (
        <div className="text-right">
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            {formatCurrency(earnings)}
          </p>
          <p className="text-xs text-gray-400">@ {formatCurrency(entry.hourlyRate || 0)}/hr</p>
        </div>
      )}

      {/* Billable Indicator */}
      <div
        className={`rounded p-1.5 ${
          entry.billable
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
        }`}
        title={entry.billable ? 'Billable' : 'Non-billable'}
      >
        <DollarSign className="h-4 w-4" />
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="rounded p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30"
          title="Start timer with this entry"
          onClick={() => onStartTimer?.(entry)}
        >
          <Play className="h-4 w-4" />
        </button>
        <button
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          title="Edit"
          onClick={() => onEdit?.(entry.id)}
        >
          <Edit3 className="h-4 w-4" />
        </button>

        {/* More Actions Menu */}
        <div ref={menuRef} className="relative">
          <button
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => {
                  onDuplicate?.(entry);
                  setIsMenuOpen(false);
                }}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => {
                  onDelete?.(entry.id);
                  setIsMenuOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default TimeEntryRow;
