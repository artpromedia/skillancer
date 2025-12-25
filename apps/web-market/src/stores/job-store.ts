'use client';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
// Note: Zustand with persist middleware has poor type inference in strict TypeScript mode.
// These eslint-disable comments are required until Zustand improves its middleware types.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Job, JobSearchFilters } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

type SortByOption = 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count';
type ViewMode = 'list' | 'grid';

interface JobState {
  filters: JobSearchFilters;
  sortBy: SortByOption;
  viewMode: ViewMode;
  savedJobIds: string[];
  recentlyViewedJobs: Job[];
  appliedJobIds: string[];
  filtersOpen: boolean;
}

interface JobActions {
  setFilters: (filters: Partial<JobSearchFilters>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: SortByOption) => void;
  setViewMode: (mode: ViewMode) => void;
  saveJob: (jobId: string) => void;
  unsaveJob: (jobId: string) => void;
  toggleSaveJob: (jobId: string) => void;
  isJobSaved: (jobId: string) => boolean;
  addRecentlyViewed: (job: Job) => void;
  clearRecentlyViewed: () => void;
  markAsApplied: (jobId: string) => void;
  hasApplied: (jobId: string) => boolean;
  toggleFilters: () => void;
  setFiltersOpen: (open: boolean) => void;
}

type JobStore = JobState & JobActions;

// ============================================================================
// Default Values
// ============================================================================

const defaultFilters: JobSearchFilters = {};

const initialState: JobState = {
  filters: defaultFilters,
  sortBy: 'relevance',
  viewMode: 'list',
  savedJobIds: [],
  recentlyViewedJobs: [],
  appliedJobIds: [],
  filtersOpen: true,
};

// ============================================================================
// Store
// ============================================================================

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setFilters: (newFilters: Partial<JobSearchFilters>): void => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
      },

      clearFilters: (): void => {
        set({ filters: defaultFilters });
      },

      setSortBy: (sortBy: SortByOption): void => {
        set({ sortBy });
      },

      setViewMode: (viewMode: ViewMode): void => {
        set({ viewMode });
      },

      saveJob: (jobId: string): void => {
        set((state) => ({
          savedJobIds: state.savedJobIds.includes(jobId)
            ? state.savedJobIds
            : [...state.savedJobIds, jobId],
        }));
      },

      unsaveJob: (jobId: string): void => {
        set((state) => ({
          savedJobIds: state.savedJobIds.filter((id) => id !== jobId),
        }));
      },

      toggleSaveJob: (jobId: string): void => {
        const state = get();
        if (state.savedJobIds.includes(jobId)) {
          state.unsaveJob(jobId);
        } else {
          state.saveJob(jobId);
        }
      },

      isJobSaved: (jobId: string): boolean => {
        return get().savedJobIds.includes(jobId);
      },

      addRecentlyViewed: (job: Job): void => {
        set((state) => {
          const filtered = state.recentlyViewedJobs.filter((j) => j.id !== job.id);
          return {
            recentlyViewedJobs: [job, ...filtered].slice(0, 20),
          };
        });
      },

      clearRecentlyViewed: (): void => {
        set({ recentlyViewedJobs: [] });
      },

      markAsApplied: (jobId: string): void => {
        set((state) => ({
          appliedJobIds: state.appliedJobIds.includes(jobId)
            ? state.appliedJobIds
            : [...state.appliedJobIds, jobId],
        }));
      },

      hasApplied: (jobId: string): boolean => {
        return get().appliedJobIds.includes(jobId);
      },

      toggleFilters: (): void => {
        set((state) => ({ filtersOpen: !state.filtersOpen }));
      },

      setFiltersOpen: (open: boolean): void => {
        set({ filtersOpen: open });
      },
    }),
    {
      name: 'skillancer-job-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        savedJobIds: state.savedJobIds,
        recentlyViewedJobs: state.recentlyViewedJobs,
        appliedJobIds: state.appliedJobIds,
        viewMode: state.viewMode,
        filtersOpen: state.filtersOpen,
      }),
    }
  )
);

// ============================================================================
// Typed Selectors
// ============================================================================

export const useFilters = (): JobSearchFilters => useJobStore((state) => state.filters);
export const useSortBy = (): SortByOption => useJobStore((state) => state.sortBy);
export const useViewMode = (): ViewMode => useJobStore((state) => state.viewMode);
export const useSavedJobIds = (): string[] => useJobStore((state) => state.savedJobIds);
export const useRecentlyViewedJobs = (): Job[] => useJobStore((state) => state.recentlyViewedJobs);
export const useFiltersOpen = (): boolean => useJobStore((state) => state.filtersOpen);
