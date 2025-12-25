import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

import type { Job, JobSearchFilters } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

interface JobState {
  // Search State
  filters: JobSearchFilters;
  sortBy: 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count';
  viewMode: 'list' | 'grid';

  // Saved Jobs
  savedJobIds: Set<string>;

  // Recently Viewed
  recentlyViewedJobs: Job[];

  // Applied Jobs
  appliedJobIds: Set<string>;

  // UI State
  filtersOpen: boolean;

  // Actions
  setFilters: (filters: Partial<JobSearchFilters>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: JobState['sortBy']) => void;
  setViewMode: (mode: 'list' | 'grid') => void;

  // Saved Jobs Actions
  saveJob: (jobId: string) => void;
  unsaveJob: (jobId: string) => void;
  toggleSaveJob: (jobId: string) => void;
  isJobSaved: (jobId: string) => boolean;

  // Recently Viewed Actions
  addRecentlyViewed: (job: Job) => void;
  clearRecentlyViewed: () => void;

  // Applied Jobs Actions
  markAsApplied: (jobId: string) => void;
  hasApplied: (jobId: string) => boolean;

  // UI Actions
  toggleFilters: () => void;
  setFiltersOpen: (open: boolean) => void;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultFilters: JobSearchFilters = {};

// ============================================================================
// Store
// ============================================================================

export const useJobStore = create<JobState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        filters: defaultFilters,
        sortBy: 'relevance',
        viewMode: 'list',
        savedJobIds: new Set<string>(),
        recentlyViewedJobs: [],
        appliedJobIds: new Set<string>(),
        filtersOpen: true,

        // Filter Actions
        setFilters: (newFilters) =>
          set(
            (state) => ({
              filters: { ...state.filters, ...newFilters },
            }),
            false,
            'setFilters'
          ),

        clearFilters: () => set({ filters: defaultFilters }, false, 'clearFilters'),

        setSortBy: (sortBy) => set({ sortBy }, false, 'setSortBy'),

        setViewMode: (viewMode) => set({ viewMode }, false, 'setViewMode'),

        // Saved Jobs Actions
        saveJob: (jobId) =>
          set(
            (state) => {
              const newSet = new Set(state.savedJobIds);
              newSet.add(jobId);
              return { savedJobIds: newSet };
            },
            false,
            'saveJob'
          ),

        unsaveJob: (jobId) =>
          set(
            (state) => {
              const newSet = new Set(state.savedJobIds);
              newSet.delete(jobId);
              return { savedJobIds: newSet };
            },
            false,
            'unsaveJob'
          ),

        toggleSaveJob: (jobId) => {
          const state = get();
          if (state.savedJobIds.has(jobId)) {
            state.unsaveJob(jobId);
          } else {
            state.saveJob(jobId);
          }
        },

        isJobSaved: (jobId) => get().savedJobIds.has(jobId),

        // Recently Viewed Actions
        addRecentlyViewed: (job) =>
          set(
            (state) => {
              // Remove if already exists, then add to front
              const filtered = state.recentlyViewedJobs.filter((j) => j.id !== job.id);
              return {
                recentlyViewedJobs: [job, ...filtered].slice(0, 20), // Keep last 20
              };
            },
            false,
            'addRecentlyViewed'
          ),

        clearRecentlyViewed: () => set({ recentlyViewedJobs: [] }, false, 'clearRecentlyViewed'),

        // Applied Jobs Actions
        markAsApplied: (jobId) =>
          set(
            (state) => {
              const newSet = new Set(state.appliedJobIds);
              newSet.add(jobId);
              return { appliedJobIds: newSet };
            },
            false,
            'markAsApplied'
          ),

        hasApplied: (jobId) => get().appliedJobIds.has(jobId),

        // UI Actions
        toggleFilters: () =>
          set((state) => ({ filtersOpen: !state.filtersOpen }), false, 'toggleFilters'),

        setFiltersOpen: (open) => set({ filtersOpen: open }, false, 'setFiltersOpen'),
      }),
      {
        name: 'skillancer-job-store',
        // Custom serialization for Sets
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;

            const data = JSON.parse(str);
            return {
              ...data,
              state: {
                ...data.state,
                savedJobIds: new Set(data.state.savedJobIds || []),
                appliedJobIds: new Set(data.state.appliedJobIds || []),
              },
            };
          },
          setItem: (name, value) => {
            const data = {
              ...value,
              state: {
                ...value.state,
                savedJobIds: Array.from(value.state.savedJobIds || []),
                appliedJobIds: Array.from(value.state.appliedJobIds || []),
              },
            };
            localStorage.setItem(name, JSON.stringify(data));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
        partialize: (state) => ({
          savedJobIds: state.savedJobIds,
          recentlyViewedJobs: state.recentlyViewedJobs,
          appliedJobIds: state.appliedJobIds,
          viewMode: state.viewMode,
          filtersOpen: state.filtersOpen,
        }),
      }
    ),
    { name: 'JobStore' }
  )
);

// ============================================================================
// Selectors (for better performance)
// ============================================================================

export const useFilters = () => useJobStore((state) => state.filters);
export const useSortBy = () => useJobStore((state) => state.sortBy);
export const useViewMode = () => useJobStore((state) => state.viewMode);
export const useSavedJobIds = () => useJobStore((state) => state.savedJobIds);
export const useRecentlyViewedJobs = () => useJobStore((state) => state.recentlyViewedJobs);
export const useFiltersOpen = () => useJobStore((state) => state.filtersOpen);
