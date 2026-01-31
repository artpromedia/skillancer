'use client';

/**
 * Saved Searches Hook
 *
 * TanStack Query hooks for managing saved job searches with email alerts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  getSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  markSavedSearchViewed,
  runSavedSearch,
  type SavedSearch,
  type CreateSavedSearchData,
  type UpdateSavedSearchData,
  type JobSearchResult,
  type PaginationParams,
} from '@/lib/api/jobs';

// ============================================================================
// Query Keys
// ============================================================================

export const savedSearchQueryKeys = {
  all: ['saved-searches'] as const,
  list: () => [...savedSearchQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...savedSearchQueryKeys.all, 'detail', id] as const,
  results: (id: string, page?: number) =>
    [...savedSearchQueryKeys.all, 'results', id, page] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseSavedSearchesReturn {
  /** List of saved searches */
  savedSearches: SavedSearch[];
  /** Whether saved searches are loading */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Total count of new jobs across all saved searches */
  totalNewJobs: number;
  /** Create a new saved search */
  createSearch: (data: CreateSavedSearchData) => Promise<SavedSearch>;
  /** Update an existing saved search */
  updateSearch: (id: string, data: UpdateSavedSearchData) => Promise<SavedSearch>;
  /** Delete a saved search */
  deleteSearch: (id: string) => Promise<void>;
  /** Mark a saved search as viewed */
  markViewed: (id: string) => Promise<void>;
  /** Toggle email alerts for a saved search */
  toggleEmailAlerts: (id: string, enabled: boolean) => Promise<SavedSearch>;
  /** Check if creating/updating is in progress */
  isSaving: boolean;
  /** Check if deleting is in progress */
  isDeleting: boolean;
  /** Refresh saved searches */
  refresh: () => void;
}

export interface UseSavedSearchResultsOptions {
  /** The saved search ID */
  searchId: string;
  /** Pagination params */
  pagination?: PaginationParams;
  /** Whether to auto-mark as viewed */
  autoMarkViewed?: boolean;
}

export interface UseSavedSearchResultsReturn {
  /** Search results */
  results: JobSearchResult | null;
  /** Whether results are loading */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Refresh results */
  refresh: () => void;
}

// ============================================================================
// useSavedSearches Hook
// ============================================================================

export function useSavedSearches(): UseSavedSearchesReturn {
  const queryClient = useQueryClient();

  // Fetch saved searches
  const {
    data: savedSearches = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: savedSearchQueryKeys.list(),
    queryFn: getSavedSearches,
    staleTime: 60 * 1000, // 1 minute
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createSavedSearch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchQueryKeys.list() });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedSearchData }) =>
      updateSavedSearch(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchQueryKeys.list() });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSavedSearch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchQueryKeys.list() });
    },
  });

  // Mark viewed mutation
  const markViewedMutation = useMutation({
    mutationFn: markSavedSearchViewed,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savedSearchQueryKeys.list() });
    },
  });

  // Create search
  const createSearch = useCallback(
    async (data: CreateSavedSearchData): Promise<SavedSearch> => {
      return createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  // Update search
  const updateSearch = useCallback(
    async (id: string, data: UpdateSavedSearchData): Promise<SavedSearch> => {
      return updateMutation.mutateAsync({ id, data });
    },
    [updateMutation]
  );

  // Delete search
  const deleteSearch = useCallback(
    async (id: string): Promise<void> => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  // Mark viewed
  const markViewed = useCallback(
    async (id: string): Promise<void> => {
      await markViewedMutation.mutateAsync(id);
    },
    [markViewedMutation]
  );

  // Toggle email alerts
  const toggleEmailAlerts = useCallback(
    async (id: string, enabled: boolean): Promise<SavedSearch> => {
      return updateMutation.mutateAsync({ id, data: { emailAlerts: enabled } });
    },
    [updateMutation]
  );

  // Calculate total new jobs
  const totalNewJobs = savedSearches.reduce((sum, search) => sum + search.newJobsCount, 0);

  // Refresh
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    savedSearches,
    isLoading,
    error: error instanceof Error ? error : null,
    totalNewJobs,
    createSearch,
    updateSearch,
    deleteSearch,
    markViewed,
    toggleEmailAlerts,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refresh,
  };
}

// ============================================================================
// useSavedSearchResults Hook
// ============================================================================

export function useSavedSearchResults(
  options: UseSavedSearchResultsOptions
): UseSavedSearchResultsReturn {
  const { searchId, pagination = {}, autoMarkViewed = true } = options;
  const queryClient = useQueryClient();

  const { page = 1 } = pagination;

  // Fetch results
  const {
    data: results = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: savedSearchQueryKeys.results(searchId, page),
    queryFn: async () => {
      const data = await runSavedSearch(searchId, pagination);

      // Auto mark as viewed
      if (autoMarkViewed) {
        try {
          await markSavedSearchViewed(searchId);
          void queryClient.invalidateQueries({ queryKey: savedSearchQueryKeys.list() });
        } catch {
          // Silent fail - viewing is not critical
        }
      }

      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: Boolean(searchId),
  });

  // Refresh
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    results,
    isLoading,
    error: error instanceof Error ? error : null,
    refresh,
  };
}

// ============================================================================
// useCanSaveSearch Hook (check if current search is already saved)
// ============================================================================

export interface UseCanSaveSearchReturn {
  /** Whether the current filters match an existing saved search */
  isAlreadySaved: boolean;
  /** The matching saved search if found */
  matchingSavedSearch: SavedSearch | null;
}

export function useCanSaveSearch(currentFilters: Record<string, unknown>): UseCanSaveSearchReturn {
  const { savedSearches } = useSavedSearches();

  // Simple deep comparison of filters
  const filtersString = JSON.stringify(currentFilters);

  const matchingSavedSearch =
    savedSearches.find((search) => JSON.stringify(search.filters) === filtersString) ?? null;

  return {
    isAlreadySaved: matchingSavedSearch !== null,
    matchingSavedSearch,
  };
}
