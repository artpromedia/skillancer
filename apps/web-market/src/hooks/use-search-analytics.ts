'use client';

/**
 * Search Analytics Hook
 *
 * Tracks search queries for insights and provides "no results" suggestions.
 * Integrates with TanStack Query for data fetching.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useMemo } from 'react';

import {
  trackSearchAnalytics,
  getNoResultsSuggestions,
  getTrendingSearches,
  getSearchSuggestions,
  type JobSearchFilters,
  type SearchAnalyticsEvent,
  type SearchSuggestion,
} from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

export interface UseSearchAnalyticsOptions {
  /** Whether to track analytics (disable for testing) */
  enabled?: boolean;
  /** Session ID for tracking across page loads */
  sessionId?: string;
  /** Debounce time for tracking (ms) */
  debounceMs?: number;
}

export interface UseSearchAnalyticsReturn {
  /** Track a search event */
  trackSearch: (query: string, filters: JobSearchFilters, resultsCount: number) => void;
  /** Get suggestions for autocomplete */
  suggestions: SearchSuggestion[];
  /** Loading state for suggestions */
  isLoadingSuggestions: boolean;
  /** Fetch suggestions for a query */
  fetchSuggestions: (query: string) => void;
  /** Trending searches */
  trendingSearches: { query: string; searchCount: number; trend: 'up' | 'stable' | 'down' }[];
  /** Loading state for trending */
  isLoadingTrending: boolean;
}

export interface UseNoResultsSuggestionsOptions {
  /** Current filters to base suggestions on */
  filters: JobSearchFilters;
  /** Whether there are results (skip fetching if there are) */
  hasResults: boolean;
  /** Whether the search is still loading */
  isLoading: boolean;
}

export interface UseNoResultsSuggestionsReturn {
  /** Suggestions for improving search */
  suggestions: {
    alternativeQueries: string[];
    relatedCategories: { id: string; name: string; jobCount: number }[];
    popularSkills: { id: string; name: string; jobCount: number }[];
    broaderSearchTips: string[];
  } | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
}

// ============================================================================
// Query Keys
// ============================================================================

export const searchAnalyticsQueryKeys = {
  all: ['search-analytics'] as const,
  suggestions: (query: string) => [...searchAnalyticsQueryKeys.all, 'suggestions', query] as const,
  trending: () => [...searchAnalyticsQueryKeys.all, 'trending'] as const,
  noResults: (filters: JobSearchFilters) =>
    [...searchAnalyticsQueryKeys.all, 'no-results', filters] as const,
};

// ============================================================================
// Session ID Helper
// ============================================================================

function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = sessionStorage.getItem('skillancer-search-session');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('skillancer-search-session', sessionId);
  }
  return sessionId;
}

// ============================================================================
// useSearchAnalytics Hook
// ============================================================================

export function useSearchAnalytics(
  options: UseSearchAnalyticsOptions = {}
): UseSearchAnalyticsReturn {
  const { enabled = true, sessionId, debounceMs = 1000 } = options;

  const queryClient = useQueryClient();
  const trackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackedRef = useRef<string>('');
  const effectiveSessionId = sessionId ?? getSessionId();

  // Track search mutation
  const trackMutation = useMutation({
    mutationFn: (event: SearchAnalyticsEvent) => trackSearchAnalytics(event),
    onError: () => {
      // Silent fail - analytics shouldn't break user experience
    },
  });

  // Suggestions state
  const suggestionsQueryRef = useRef<string>('');

  const { data: suggestionsData, isLoading: isLoadingSuggestions } = useQuery({
    queryKey: searchAnalyticsQueryKeys.suggestions(suggestionsQueryRef.current),
    queryFn: () => getSearchSuggestions(suggestionsQueryRef.current),
    enabled: suggestionsQueryRef.current.length >= 2,
    staleTime: 60 * 1000, // 1 minute
  });

  // Trending searches
  const { data: trendingData, isLoading: isLoadingTrending } = useQuery({
    queryKey: searchAnalyticsQueryKeys.trending(),
    queryFn: getTrendingSearches,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Track search with debounce
  const trackSearch = useCallback(
    (query: string, filters: JobSearchFilters, resultsCount: number) => {
      if (!enabled) return;

      // Create unique key for this search to avoid duplicate tracking
      const searchKey = JSON.stringify({ query, filters, resultsCount });
      if (searchKey === lastTrackedRef.current) return;

      // Clear any pending tracking
      if (trackTimeoutRef.current) {
        clearTimeout(trackTimeoutRef.current);
      }

      // Debounce tracking
      trackTimeoutRef.current = setTimeout(() => {
        lastTrackedRef.current = searchKey;

        const event: SearchAnalyticsEvent = {
          query: query || '',
          filters,
          resultsCount,
          timestamp: new Date().toISOString(),
          sessionId: effectiveSessionId,
        };

        trackMutation.mutate(event);
      }, debounceMs);
    },
    [enabled, debounceMs, effectiveSessionId, trackMutation]
  );

  // Fetch suggestions
  const fetchSuggestions = useCallback(
    (query: string) => {
      suggestionsQueryRef.current = query;
      if (query.length >= 2) {
        void queryClient.invalidateQueries({
          queryKey: searchAnalyticsQueryKeys.suggestions(query),
        });
      }
    },
    [queryClient]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (trackTimeoutRef.current) {
        clearTimeout(trackTimeoutRef.current);
      }
    };
  }, []);

  return {
    trackSearch,
    suggestions: suggestionsData ?? [],
    isLoadingSuggestions,
    fetchSuggestions,
    trendingSearches: trendingData ?? [],
    isLoadingTrending,
  };
}

// ============================================================================
// useNoResultsSuggestions Hook
// ============================================================================

export function useNoResultsSuggestions(
  options: UseNoResultsSuggestionsOptions
): UseNoResultsSuggestionsReturn {
  const { filters, hasResults, isLoading } = options;

  // Only fetch suggestions when there are no results and not loading
  const shouldFetch = !hasResults && !isLoading && (!!filters.query || !!filters.category);

  const {
    data,
    isLoading: isFetching,
    error,
  } = useQuery({
    queryKey: searchAnalyticsQueryKeys.noResults(filters),
    queryFn: () => getNoResultsSuggestions(filters),
    enabled: shouldFetch,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });

  return {
    suggestions: shouldFetch ? (data ?? null) : null,
    isLoading: isFetching,
    error: error instanceof Error ? error : null,
  };
}

// ============================================================================
// useRecentSearches Hook (localStorage-based)
// ============================================================================

const RECENT_SEARCHES_KEY = 'skillancer-recent-searches';
const MAX_RECENT_SEARCHES = 10;

export interface UseRecentSearchesReturn {
  /** Recent search queries */
  recentSearches: string[];
  /** Add a search to recent */
  addRecentSearch: (query: string) => void;
  /** Remove a search from recent */
  removeRecentSearch: (query: string) => void;
  /** Clear all recent searches */
  clearRecentSearches: () => void;
}

export function useRecentSearches(): UseRecentSearchesReturn {
  const getRecentSearches = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];

    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  }, []);

  const saveRecentSearches = useCallback((searches: string[]) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch {
      // Storage full or unavailable
    }
  }, []);

  const recentSearches = useMemo(() => getRecentSearches(), [getRecentSearches]);

  const addRecentSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      const current = getRecentSearches();
      const updated = [
        query.trim(),
        ...current.filter((s) => s.toLowerCase() !== query.trim().toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);

      saveRecentSearches(updated);
    },
    [getRecentSearches, saveRecentSearches]
  );

  const removeRecentSearch = useCallback(
    (query: string) => {
      const current = getRecentSearches();
      const updated = current.filter((s) => s.toLowerCase() !== query.toLowerCase());
      saveRecentSearches(updated);
    },
    [getRecentSearches, saveRecentSearches]
  );

  const clearRecentSearches = useCallback(() => {
    saveRecentSearches([]);
  }, [saveRecentSearches]);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
}

// ============================================================================
// useSearchTracking Hook (combines analytics + recent)
// ============================================================================

export interface UseSearchTrackingOptions {
  /** Track to analytics API */
  trackAnalytics?: boolean;
  /** Save to recent searches */
  saveToRecent?: boolean;
}

export interface UseSearchTrackingReturn {
  /** Track a completed search */
  trackSearch: (query: string, filters: JobSearchFilters, resultsCount: number) => void;
  /** Recent searches */
  recentSearches: string[];
  /** Clear recent searches */
  clearRecentSearches: () => void;
}

export function useSearchTracking(options: UseSearchTrackingOptions = {}): UseSearchTrackingReturn {
  const { trackAnalytics = true, saveToRecent = true } = options;

  const { trackSearch: analyticsTrack } = useSearchAnalytics({ enabled: trackAnalytics });
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  const trackSearch = useCallback(
    (query: string, filters: JobSearchFilters, resultsCount: number) => {
      // Track analytics
      if (trackAnalytics) {
        analyticsTrack(query, filters, resultsCount);
      }

      // Save to recent
      if (saveToRecent && query.trim()) {
        addRecentSearch(query.trim());
      }
    },
    [trackAnalytics, saveToRecent, analyticsTrack, addRecentSearch]
  );

  return {
    trackSearch,
    recentSearches,
    clearRecentSearches,
  };
}
