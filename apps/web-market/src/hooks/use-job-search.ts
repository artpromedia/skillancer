'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition, useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { searchJobs, type JobSearchFilters, type JobSearchResult } from '@/lib/api/jobs';
import { useDebounce } from '@/hooks/use-debounce';
import { useJobStore } from '@/stores/job-store';

// ============================================================================
// Types
// ============================================================================

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
  jobs: JobSearchResult['jobs'];
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
  sortBy: string;
  setSortBy: (sortBy: string) => void;

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
        value.forEach((v) => params.append(key, v));
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
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  // Get store state and actions
  const storeFilters = useJobStore((state) => state.filters);
  const storeSortBy = useJobStore((state) => state.sortBy);
  const setStoreFilters = useJobStore((state) => state.setFilters);
  const clearStoreFilters = useJobStore((state) => state.clearFilters);
  const setStoreSortBy = useJobStore((state) => state.setSortBy);

  // Parse initial filters from URL on mount
  const urlFilters = useMemo(
    () => (syncUrl ? searchParamsToFilters(searchParams) : {}),
    [searchParams, syncUrl]
  );

  // Merge filters: URL takes precedence, then store, then initial
  const mergedFilters = useMemo(
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
  } = useInfiniteQuery({
    queryKey: ['jobs', 'search', debouncedFilters, storeSortBy],
    queryFn: async ({ pageParam = 1 }) => {
      return searchJobs(
        { ...debouncedFilters, sortBy: storeSortBy as JobSearchFilters['sortBy'] },
        { page: pageParam, limit: pageSize }
      );
    },
    getNextPageParam: (lastPage) => {
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
  const jobs = useMemo(() => data?.pages.flatMap((page) => page.jobs) ?? [], [data]);

  const total = data?.pages[0]?.total ?? 0;

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const f = mergedFilters;
    if (f.query) count++;
    if (f.skills?.length) count++;
    if (f.budgetMin || f.budgetMax) count++;
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
      const newFilters = { ...mergedFilters, [key]: value };
      setStoreFilters(newFilters);
      updateUrl(newFilters);
    },
    [mergedFilters, setStoreFilters, updateUrl]
  );

  const setFilters = useCallback(
    (filters: Partial<JobSearchFilters>) => {
      const newFilters = { ...mergedFilters, ...filters };
      setStoreFilters(newFilters);
      updateUrl(newFilters);
    },
    [mergedFilters, setStoreFilters, updateUrl]
  );

  const removeFilter = useCallback(
    (key: keyof JobSearchFilters) => {
      const newFilters = { ...mergedFilters };
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
    (sortBy: string) => {
      setStoreSortBy(sortBy as UseJobSearchReturn['sortBy']);
    },
    [setStoreSortBy]
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    // Data
    jobs,
    total,
    hasMore: !!hasNextPage,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error: error as Error | null,

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
