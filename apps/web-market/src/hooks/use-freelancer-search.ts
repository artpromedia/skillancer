/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

/**
 * Freelancer Search Hook
 *
 * TanStack Query-based hook for searching freelancers with caching,
 * URL sync, and invite-to-job functionality.
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import {
  searchFreelancers,
  type FreelancerSearchFilters,
  type FreelancerSearchResponse,
  type FreelancerListItem,
  type FreelancerSortBy,
} from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

export interface UseFreelancerSearchOptions {
  /** Initial filters from server */
  initialFilters?: FreelancerSearchFilters;
  /** Initial data from server (SSR) */
  initialData?: FreelancerSearchResponse;
  /** Items per page */
  pageSize?: number;
  /** Enable URL sync */
  syncUrl?: boolean;
  /** Stale time for caching (default: 5 minutes) */
  staleTime?: number;
}

export interface UseFreelancerSearchReturn {
  // Data
  freelancers: FreelancerListItem[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;

  // Pagination
  loadMore: () => void;
  page: number;
  totalPages: number;

  // Filters
  filters: FreelancerSearchFilters;
  setFilter: <K extends keyof FreelancerSearchFilters>(
    key: K,
    value: FreelancerSearchFilters[K]
  ) => void;
  setFilters: (filters: Partial<FreelancerSearchFilters>) => void;
  clearFilters: () => void;
  removeFilter: (key: keyof FreelancerSearchFilters) => void;
  activeFilterCount: number;

  // Sorting
  sortBy: FreelancerSortBy;
  setSortBy: (sortBy: FreelancerSortBy) => void;

  // Search
  query: string;
  setQuery: (query: string) => void;

  // Refresh
  refresh: () => void;
}

export interface InviteToJobData {
  freelancerId: string;
  jobId: string;
  message?: string;
}

export interface InviteResult {
  success: boolean;
  inviteId: string;
  message: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const freelancerSearchQueryKeys = {
  all: ['freelancers'] as const,
  search: (filters: FreelancerSearchFilters, sortBy: FreelancerSortBy) =>
    ['freelancers', 'search', { filters, sortBy }] as const,
  detail: (id: string) => ['freelancers', 'detail', id] as const,
  similar: (id: string) => ['freelancers', 'similar', id] as const,
};

// ============================================================================
// URL Helpers
// ============================================================================

function filtersToSearchParams(
  filters: FreelancerSearchFilters,
  sortBy: FreelancerSortBy
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.query) params.set('q', filters.query);
  if (filters.skills?.length) {
    filters.skills.forEach((skill) => params.append('skills', skill));
  }
  if (filters.categories?.length) {
    filters.categories.forEach((cat) => params.append('categories', cat));
  }
  if (filters.minRate !== undefined) params.set('minRate', String(filters.minRate));
  if (filters.maxRate !== undefined) params.set('maxRate', String(filters.maxRate));
  if (filters.location) params.set('location', filters.location);
  if (filters.country) params.set('country', filters.country);
  if (filters.verificationLevel) params.set('verification', filters.verificationLevel);
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
  if (filters.minJobs !== undefined) params.set('minJobs', String(filters.minJobs));
  if (filters.hasPortfolio) params.set('hasPortfolio', 'true');
  if (filters.languages?.length) {
    filters.languages.forEach((lang) => params.append('languages', lang));
  }
  if (sortBy !== 'relevance') params.set('sortBy', sortBy);

  return params;
}

function searchParamsToFilters(searchParams: URLSearchParams): {
  filters: FreelancerSearchFilters;
  sortBy: FreelancerSortBy;
} {
  const filters: FreelancerSearchFilters = {};

  const query = searchParams.get('q');
  if (query) filters.query = query;

  const skills = searchParams.getAll('skills');
  if (skills.length > 0) filters.skills = skills;

  const categories = searchParams.getAll('categories');
  if (categories.length > 0) filters.categories = categories;

  const minRate = searchParams.get('minRate');
  if (minRate) filters.minRate = Number(minRate);

  const maxRate = searchParams.get('maxRate');
  if (maxRate) filters.maxRate = Number(maxRate);

  const location = searchParams.get('location');
  if (location) filters.location = location;

  const country = searchParams.get('country');
  if (country) filters.country = country;

  const verification = searchParams.get('verification');
  if (verification) {
    filters.verificationLevel = verification as FreelancerSearchFilters['verificationLevel'];
  }

  const availability = searchParams.get('availability');
  if (availability) {
    filters.availability = availability as FreelancerSearchFilters['availability'];
  }

  const minRating = searchParams.get('minRating');
  if (minRating) filters.minRating = Number(minRating);

  const minJobs = searchParams.get('minJobs');
  if (minJobs) filters.minJobs = Number(minJobs);

  const hasPortfolio = searchParams.get('hasPortfolio');
  if (hasPortfolio === 'true') filters.hasPortfolio = true;

  const languages = searchParams.getAll('languages');
  if (languages.length > 0) filters.languages = languages;

  const sortBy = (searchParams.get('sortBy') as FreelancerSortBy) || 'relevance';

  return { filters, sortBy };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useFreelancerSearch(
  options: UseFreelancerSearchOptions = {}
): UseFreelancerSearchReturn {
  const { initialFilters = {}, pageSize = 20, syncUrl = true, staleTime = 5 * 60 * 1000 } = options;

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Parse URL params if syncUrl is enabled
  const urlParams = useMemo(() => {
    if (syncUrl && searchParams) {
      return searchParamsToFilters(searchParams);
    }
    return { filters: initialFilters, sortBy: 'relevance' as FreelancerSortBy };
  }, [syncUrl, searchParams, initialFilters]);

  // Local state derived from URL or initial
  const filters = urlParams.filters;
  const sortBy = urlParams.sortBy;
  const query = filters.query || '';

  // Debounce search query
  const debouncedQuery = useDebounce(query, 300);

  // Build effective filters with debounced query
  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      query: debouncedQuery || undefined,
    }),
    [filters, debouncedQuery]
  );

  // Infinite query for freelancer search with stale-while-revalidate
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: freelancerSearchQueryKeys.search(effectiveFilters, sortBy),
    queryFn: async ({ pageParam = 1 }) => {
      return searchFreelancers({
        ...effectiveFilters,
        sortBy,
        page: pageParam,
        limit: pageSize,
      });
    },
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.page ?? 1;
      const totalPages = Math.ceil(lastPage.total / pageSize);
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime, // Data is fresh for 5 minutes (stale-while-revalidate)
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  });

  // Flatten pages into freelancers array
  const freelancers = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.freelancers ?? []);
  }, [data]);

  const total = data?.pages[0]?.total ?? 0;
  const currentPage = data?.pages.length ?? 1;
  const totalPages = Math.ceil(total / pageSize);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.skills?.length) count += filters.skills.length;
    if (filters.categories?.length) count += filters.categories.length;
    if (filters.minRate !== undefined) count++;
    if (filters.maxRate !== undefined) count++;
    if (filters.location) count++;
    if (filters.country) count++;
    if (filters.verificationLevel) count++;
    if (filters.availability) count++;
    if (filters.minRating !== undefined) count++;
    if (filters.minJobs !== undefined) count++;
    if (filters.hasPortfolio) count++;
    if (filters.languages?.length) count += filters.languages.length;
    return count;
  }, [filters]);

  // URL update helper
  const updateUrl = useCallback(
    (newFilters: FreelancerSearchFilters, newSortBy: FreelancerSortBy) => {
      if (!syncUrl) return;
      const params = filtersToSearchParams(newFilters, newSortBy);
      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      startTransition(() => {
        router.push(url, { scroll: false });
      });
    },
    [syncUrl, pathname, router]
  );

  // Filter setters
  const setFilter = useCallback(
    <K extends keyof FreelancerSearchFilters>(key: K, value: FreelancerSearchFilters[K]) => {
      const newFilters = { ...filters, [key]: value };
      updateUrl(newFilters, sortBy);
    },
    [filters, sortBy, updateUrl]
  );

  const setFilters = useCallback(
    (newFilters: Partial<FreelancerSearchFilters>) => {
      const merged = { ...filters, ...newFilters };
      updateUrl(merged, sortBy);
    },
    [filters, sortBy, updateUrl]
  );

  const clearFilters = useCallback(() => {
    updateUrl({}, 'relevance');
  }, [updateUrl]);

  const removeFilter = useCallback(
    (key: keyof FreelancerSearchFilters) => {
      const { [key]: _, ...rest } = filters;
      updateUrl(rest, sortBy);
    },
    [filters, sortBy, updateUrl]
  );

  const setQuery = useCallback(
    (newQuery: string) => {
      const newFilters = { ...filters, query: newQuery || undefined };
      updateUrl(newFilters, sortBy);
    },
    [filters, sortBy, updateUrl]
  );

  const setSortBy = useCallback(
    (newSortBy: FreelancerSortBy) => {
      updateUrl(filters, newSortBy);
    },
    [filters, updateUrl]
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
    freelancers,
    total,
    hasMore: hasNextPage ?? false,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error: error,

    // Pagination
    loadMore,
    page: currentPage,
    totalPages,

    // Filters
    filters,
    setFilter,
    setFilters,
    clearFilters,
    removeFilter,
    activeFilterCount,

    // Sorting
    sortBy,
    setSortBy,

    // Search
    query,
    setQuery,

    // Refresh
    refresh,
  };
}

// ============================================================================
// Invite to Job Hook
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/market';

async function inviteFreelancerToJob(data: InviteToJobData): Promise<InviteResult> {
  const response = await fetch(`${API_BASE_URL}/jobs/${data.jobId}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      freelancerId: data.freelancerId,
      message: data.message,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to send invite' }));
    throw new Error(error.message || 'Failed to send invite');
  }

  return response.json() as Promise<InviteResult>;
}

export function useInviteToJob() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: inviteFreelancerToJob,
    onSuccess: (_data, variables) => {
      // Invalidate job invites cache
      void queryClient.invalidateQueries({
        queryKey: ['jobs', variables.jobId, 'invites'],
      });
    },
  });

  return {
    invite: mutation.mutate,
    inviteAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    isSuccess: mutation.isSuccess,
  };
}

// ============================================================================
// Get Client's Active Jobs Hook (for invite dropdown)
// ============================================================================

export interface ClientJob {
  id: string;
  title: string;
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS';
  postedAt: string;
  proposalCount: number;
}

async function getClientActiveJobs(): Promise<ClientJob[]> {
  const response = await fetch(`${API_BASE_URL}/jobs/my-jobs?status=OPEN,DRAFT`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch jobs');
  }

  const data = await response.json();
  return (data.jobs ?? data.items ?? data) as ClientJob[];
}

export function useClientActiveJobs() {
  return useInfiniteQuery({
    queryKey: ['client', 'active-jobs'],
    queryFn: getClientActiveJobs,
    getNextPageParam: () => undefined, // No pagination for this
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
