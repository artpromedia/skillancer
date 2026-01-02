/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * useTimeEntries Hook
 *
 * Custom hook for managing time entries with CRUD operations,
 * filtering, and aggregations.
 *
 * @module hooks/use-time-entries
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

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
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryInput {
  description: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskId?: string;
  taskName?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  hourlyRate?: number;
  billable?: boolean;
  tags?: string[];
  notes?: string;
}

export interface TimeEntriesFilter {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  taskId?: string;
  billable?: boolean;
  tags?: string[];
  search?: string;
}

export interface TimeEntriesAggregation {
  totalDuration: number; // minutes
  billableDuration: number;
  totalEarnings: number;
  entriesCount: number;
  projectBreakdown: {
    projectId: string;
    projectName: string;
    projectColor: string;
    duration: number;
    earnings: number;
  }[];
  dailyBreakdown: {
    date: string;
    duration: number;
    earnings: number;
  }[];
}

export interface UseTimeEntriesOptions {
  initialEntries?: TimeEntry[];
  storageKey?: string;
  autoSync?: boolean;
}

export interface UseTimeEntriesReturn {
  entries: TimeEntry[];
  isLoading: boolean;
  error: Error | null;
  filter: TimeEntriesFilter;
  setFilter: (filter: TimeEntriesFilter) => void;
  filteredEntries: TimeEntry[];
  aggregation: TimeEntriesAggregation;
  addEntry: (entry: TimeEntryInput) => TimeEntry;
  updateEntry: (id: string, updates: Partial<TimeEntryInput>) => TimeEntry | null;
  deleteEntry: (id: string) => boolean;
  duplicateEntry: (id: string) => TimeEntry | null;
  getEntryById: (id: string) => TimeEntry | undefined;
  getEntriesByDate: (date: string) => TimeEntry[];
  getEntriesByProject: (projectId: string) => TimeEntry[];
  getEntriesByDateRange: (startDate: string, endDate: string) => TimeEntry[];
  clearAllEntries: () => void;
  importEntries: (entries: TimeEntry[]) => void;
  exportEntries: () => TimeEntry[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STORAGE_KEY = 'timeEntries';

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
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
// useTimeEntries Hook
// ============================================================================

export function useTimeEntries(options: UseTimeEntriesOptions = {}): UseTimeEntriesReturn {
  const { initialEntries = [], storageKey = DEFAULT_STORAGE_KEY, autoSync = true } = options;

  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<TimeEntriesFilter>({});

  // Load entries from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as TimeEntry[];
        setEntries(parsed);
      }
    } catch (e) {
      console.error('Failed to load entries from storage:', e);
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Save entries to localStorage when they change
  useEffect(() => {
    if (typeof window === 'undefined' || !autoSync || isLoading) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save entries to storage:', e);
    }
  }, [entries, storageKey, autoSync, isLoading]);

  // Filter entries based on current filter
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Date range filter
      if (filter.startDate && entry.date < filter.startDate) return false;
      if (filter.endDate && entry.date > filter.endDate) return false;

      // Project filter
      if (filter.projectId && entry.projectId !== filter.projectId) return false;

      // Task filter
      if (filter.taskId && entry.taskId !== filter.taskId) return false;

      // Billable filter
      if (filter.billable !== undefined && entry.billable !== filter.billable) return false;

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        const hasMatchingTag = filter.tags.some((tag) => entry.tags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesDescription = entry.description.toLowerCase().includes(searchLower);
        const matchesProject = entry.projectName.toLowerCase().includes(searchLower);
        const matchesTags = entry.tags.some((tag) => tag.toLowerCase().includes(searchLower));
        if (!matchesDescription && !matchesProject && !matchesTags) return false;
      }

      return true;
    });
  }, [entries, filter]);

  // Calculate aggregations
  const aggregation = useMemo((): TimeEntriesAggregation => {
    const projectMap = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        projectColor: string;
        duration: number;
        earnings: number;
      }
    >();
    const dailyMap = new Map<string, { date: string; duration: number; earnings: number }>();

    let totalDuration = 0;
    let billableDuration = 0;
    let totalEarnings = 0;

    filteredEntries.forEach((entry) => {
      totalDuration += entry.duration;

      if (entry.billable) {
        billableDuration += entry.duration;
        const earnings = entry.hourlyRate ? (entry.duration / 60) * entry.hourlyRate : 0;
        totalEarnings += earnings;
      }

      // Project breakdown
      if (!projectMap.has(entry.projectId)) {
        projectMap.set(entry.projectId, {
          projectId: entry.projectId,
          projectName: entry.projectName,
          projectColor: entry.projectColor,
          duration: 0,
          earnings: 0,
        });
      }
      const projectData = projectMap.get(entry.projectId);
      if (!projectData) return;
      projectData.duration += entry.duration;
      if (entry.billable && entry.hourlyRate) {
        projectData.earnings += (entry.duration / 60) * entry.hourlyRate;
      }

      // Daily breakdown
      if (!dailyMap.has(entry.date)) {
        dailyMap.set(entry.date, { date: entry.date, duration: 0, earnings: 0 });
      }
      const dailyData = dailyMap.get(entry.date);
      if (!dailyData) return;
      dailyData.duration += entry.duration;
      if (entry.billable && entry.hourlyRate) {
        dailyData.earnings += (entry.duration / 60) * entry.hourlyRate;
      }
    });

    return {
      totalDuration,
      billableDuration,
      totalEarnings,
      entriesCount: filteredEntries.length,
      projectBreakdown: Array.from(projectMap.values()).sort((a, b) => b.duration - a.duration),
      dailyBreakdown: Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [filteredEntries]);

  // Add a new entry
  const addEntry = useCallback((input: TimeEntryInput): TimeEntry => {
    const now = getCurrentTimestamp();
    const entry: TimeEntry = {
      id: generateId(),
      description: input.description,
      projectId: input.projectId,
      projectName: input.projectName,
      projectColor: input.projectColor,
      taskId: input.taskId,
      taskName: input.taskName,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      duration: input.duration || calculateDuration(input.startTime, input.endTime),
      hourlyRate: input.hourlyRate,
      billable: input.billable ?? true,
      tags: input.tags || [],
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    setEntries((prev) => [entry, ...prev]);
    return entry;
  }, []);

  // Update an existing entry
  const updateEntry = useCallback(
    (id: string, updates: Partial<TimeEntryInput>): TimeEntry | null => {
      let updatedEntry: TimeEntry | null = null;

      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;

          updatedEntry = {
            ...entry,
            ...updates,
            updatedAt: getCurrentTimestamp(),
          };

          // Recalculate duration if times changed
          if (updates.startTime || updates.endTime) {
            updatedEntry.duration = calculateDuration(
              updates.startTime || entry.startTime,
              updates.endTime || entry.endTime
            );
          }

          return updatedEntry;
        })
      );

      return updatedEntry;
    },
    []
  );

  // Delete an entry
  const deleteEntry = useCallback((id: string): boolean => {
    let found = false;
    setEntries((prev) => {
      const filtered = prev.filter((entry) => {
        if (entry.id === id) {
          found = true;
          return false;
        }
        return true;
      });
      return filtered;
    });
    return found;
  }, []);

  // Duplicate an entry
  const duplicateEntry = useCallback(
    (id: string): TimeEntry | null => {
      const original = entries.find((e) => e.id === id);
      if (!original) return null;

      const duplicate: TimeEntry = {
        ...original,
        id: generateId(),
        date: new Date().toISOString().split('T')[0], // Use today's date
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
      };

      setEntries((prev) => [duplicate, ...prev]);
      return duplicate;
    },
    [entries]
  );

  // Get entry by ID
  const getEntryById = useCallback(
    (id: string): TimeEntry | undefined => {
      return entries.find((e) => e.id === id);
    },
    [entries]
  );

  // Get entries by date
  const getEntriesByDate = useCallback(
    (date: string): TimeEntry[] => {
      return entries.filter((e) => e.date === date);
    },
    [entries]
  );

  // Get entries by project
  const getEntriesByProject = useCallback(
    (projectId: string): TimeEntry[] => {
      return entries.filter((e) => e.projectId === projectId);
    },
    [entries]
  );

  // Get entries by date range
  const getEntriesByDateRange = useCallback(
    (startDate: string, endDate: string): TimeEntry[] => {
      return entries.filter((e) => e.date >= startDate && e.date <= endDate);
    },
    [entries]
  );

  // Clear all entries
  const clearAllEntries = useCallback(() => {
    setEntries([]);
  }, []);

  // Import entries
  const importEntries = useCallback((newEntries: TimeEntry[]) => {
    setEntries((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const uniqueNew = newEntries.filter((e) => !existingIds.has(e.id));
      return [...prev, ...uniqueNew];
    });
  }, []);

  // Export entries
  const exportEntries = useCallback((): TimeEntry[] => {
    return [...entries];
  }, [entries]);

  return {
    entries,
    isLoading,
    error,
    filter,
    setFilter,
    filteredEntries,
    aggregation,
    addEntry,
    updateEntry,
    deleteEntry,
    duplicateEntry,
    getEntryById,
    getEntriesByDate,
    getEntriesByProject,
    getEntriesByDateRange,
    clearAllEntries,
    importEntries,
    exportEntries,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default useTimeEntries;
