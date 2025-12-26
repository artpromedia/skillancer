/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

// Note: React Query + Zustand integration requires type workarounds for strict TypeScript mode.

import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import { searchJobs, type JobSearchFilters, type JobSearchResult, type Job } from '@/lib/api/jobs';
import { useJobStore } from '@/stores/job-store';

// ============================================================================
// Types
// ============================================================================

type SortByOption = 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count';

export interface UseJobSearchOptions {
  /** Initial filters from server */
  initialFilters?: JobSearchFilters;
  /** Initial data from server (SSR) */
  initialData?: JobSearchResult;
  /** Items per page */
  pageSize?: number;
  /** Enable URL sync */
  syncUrl?: boolean;
}

export interface UseJobSearchReturn {
  // Data
  jobs: Job[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;

  // Pagination
  loadMore: () => void;

  // Filters
  filters: JobSearchFilters;
  setFilter: <K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) => void;
  setFilters: (filters: Partial<JobSearchFilters>) => void;
  clearFilters: () => void;
  removeFilter: (key: keyof JobSearchFilters) => void;
  activeFilterCount: number;

  // Sorting
  sortBy: SortByOption;
  setSortBy: (sortBy: SortByOption) => void;

  // Search
  query: string;
  setQuery: (query: string) => void;

  // Refresh
  refresh: () => void;
}

// ============================================================================
// URL Helpers
// ============================================================================

function filtersToSearchParams(filters: JobSearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v: string) => params.append(key, v));
      } else {
        params.set(key, String(value));
      }
    }
  });

  return params;
}

function searchParamsToFilters(searchParams: URLSearchParams): JobSearchFilters {
  const filters: JobSearchFilters = {};

  const query = searchParams.get('q');
  if (query) filters.query = query;

  const skills = searchParams.getAll('skills');
  if (skills.length > 0) filters.skills = skills;

  const budgetMin = searchParams.get('budgetMin');
  if (budgetMin) filters.budgetMin = Number(budgetMin);

  const budgetMax = searchParams.get('budgetMax');
  if (budgetMax) filters.budgetMax = Number(budgetMax);

  const budgetType = searchParams.get('budgetType') as JobSearchFilters['budgetType'];
  if (budgetType) filters.budgetType = budgetType;

  const experienceLevel = searchParams.get(
    'experienceLevel'
  ) as JobSearchFilters['experienceLevel'];
  if (experienceLevel) filters.experienceLevel = experienceLevel;

  const category = searchParams.get('category');
  if (category) filters.category = category;

  const subcategory = searchParams.get('subcategory');
  if (subcategory) filters.subcategory = subcategory;

  const duration = searchParams.get('duration');
  if (duration) filters.duration = duration;

  const postedWithin = searchParams.get('postedWithin') as JobSearchFilters['postedWithin'];
  if (postedWithin) filters.postedWithin = postedWithin;

  const clientHistory = searchParams.get('clientHistory') as JobSearchFilters['clientHistory'];
  if (clientHistory) filters.clientHistory = clientHistory;

  const sortBy = searchParams.get('sortBy') as JobSearchFilters['sortBy'];
  if (sortBy) filters.sortBy = sortBy;

  return filters;
}

// ============================================================================
// Hook
// ============================================================================

export function useJobSearch(options: UseJobSearchOptions = {}): UseJobSearchReturn {
  const { initialFilters = {}, initialData, pageSize = 20, syncUrl = true } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Get store state and actions - Zustand middleware type inference handled by file-level eslint-disable
  const storeFilters = useJobStore((state) => state.filters);
  const storeSortBy = useJobStore((state) => state.sortBy) as SortByOption;
  const setStoreFilters = useJobStore((state) => state.setFilters) as (
    filters: Partial<JobSearchFilters>
  ) => void;
  const clearStoreFilters = useJobStore((state) => state.clearFilters) as () => void;
  const setStoreSortBy = useJobStore((state) => state.setSortBy) as (sortBy: SortByOption) => void;

  // Parse initial filters from URL on mount
  const urlFilters = useMemo(
    () => (syncUrl ? searchParamsToFilters(searchParams) : {}),
    [searchParams, syncUrl]
  );

  // Merge filters: URL takes precedence, then store, then initial
  const mergedFilters: JobSearchFilters = useMemo(
    () => ({ ...initialFilters, ...storeFilters, ...urlFilters }),
    [initialFilters, storeFilters, urlFilters]
  );

  // Debounce the query for API calls
  const debouncedFilters = useDebounce(mergedFilters, 300);

  // Sync URL with filters
  const updateUrl = useCallback(
    (newFilters: JobSearchFilters) => {
      if (!syncUrl) return;

      const params = filtersToSearchParams(newFilters);
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;

      startTransition(() => {
        router.push(newUrl, { scroll: false });
      });
    },
    [pathname, router, syncUrl]
  );

  // Infinite query for job search
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery<JobSearchResult>({
    queryKey: ['jobs', 'search', debouncedFilters, storeSortBy],
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1;
      return searchJobs(
        { ...debouncedFilters, sortBy: storeSortBy as JobSearchFilters['sortBy'] },
        { page, limit: pageSize }
      );
    },
    getNextPageParam: (lastPage: JobSearchResult) => {
      if (lastPage.hasMore) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    initialData: initialData
      ? {
          pages: [initialData],
          pageParams: [1],
        }
      : undefined,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Flatten paginated results
  const jobs: Job[] = useMemo(
    () => data?.pages.flatMap((page: JobSearchResult) => page.jobs) ?? [],
    [data]
  );

  const total = data?.pages[0]?.total ?? 0;

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const f = mergedFilters;
    if (f.query) count++;
    if (f.skills?.length) count++;
    if (f.budgetMin ?? f.budgetMax) count++;
    if (f.budgetType) count++;
    if (f.experienceLevel) count++;
    if (f.category) count++;
    if (f.duration) count++;
    if (f.postedWithin) count++;
    if (f.clientHistory) count++;
    return count;
  }, [mergedFilters]);

  // Filter actions
  const setFilter = useCallback(
    <K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) => {
      const newFilters: JobSearchFilters = { ...mergedFilters, [key]: value };
      setStoreFilters(newFilters);
      updateUrl(newFilters);
    },
    [mergedFilters, setStoreFilters, updateUrl]
  );

  const setFilters = useCallback(
    (filters: Partial<JobSearchFilters>) => {
      const newFilters: JobSearchFilters = { ...mergedFilters, ...filters };
      setStoreFilters(newFilters);
      updateUrl(newFilters);
    },
    [mergedFilters, setStoreFilters, updateUrl]
  );

  const removeFilter = useCallback(
    (key: keyof JobSearchFilters) => {
      const newFilters: JobSearchFilters = { ...mergedFilters };
      delete newFilters[key];
      setStoreFilters(newFilters);
      updateUrl(newFilters);
    },
    [mergedFilters, setStoreFilters, updateUrl]
  );

  const clearFilters = useCallback(() => {
    clearStoreFilters();
    updateUrl({});
  }, [clearStoreFilters, updateUrl]);

  const setQuery = useCallback(
    (query: string) => {
      setFilter('query', query || undefined);
    },
    [setFilter]
  );

  const setSortBy = useCallback(
    (sortBy: SortByOption) => {
      setStoreSortBy(sortBy);
    },
    [setStoreSortBy]
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    // Data
    jobs,
    total,
    hasMore: Boolean(hasNextPage),
    isLoading,
    isFetching,
    isFetchingNextPage,
    error: error instanceof Error ? error : null,

    // Pagination
    loadMore,

    // Filters
    filters: mergedFilters,
    setFilter,
    setFilters,
    clearFilters,
    removeFilter,
    activeFilterCount,

    // Sorting
    sortBy: storeSortBy,
    setSortBy,

    // Search
    query: mergedFilters.query ?? '',
    setQuery,

    // Refresh
    refresh,
  };
}
