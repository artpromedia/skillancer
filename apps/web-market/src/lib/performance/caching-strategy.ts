/**
 * Caching strategy configuration for optimal performance
 */

import { QueryClient } from '@tanstack/react-query';

// Cache time constants (in milliseconds)
export const CACHE_TIMES = {
  SHORT: 1000 * 60, // 1 minute - frequently changing data
  MEDIUM: 1000 * 60 * 5, // 5 minutes - moderately stable data
  LONG: 1000 * 60 * 30, // 30 minutes - stable data
  VERY_LONG: 1000 * 60 * 60, // 1 hour - rarely changing data
};

// Stale times (when to consider data stale)
export const STALE_TIMES = {
  INSTANT: 0, // Always refetch in background
  SHORT: 1000 * 30, // 30 seconds
  MEDIUM: 1000 * 60 * 2, // 2 minutes
  LONG: 1000 * 60 * 10, // 10 minutes
};

/**
 * Create optimized QueryClient with caching defaults
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - data is fresh for 30 seconds
        staleTime: STALE_TIMES.SHORT,
        // Keep unused data in cache for 5 minutes
        gcTime: CACHE_TIMES.MEDIUM,
        // Retry failed requests 3 times with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect by default (can be overridden)
        refetchOnReconnect: 'always',
        // Enable background refetching
        refetchOnMount: true,
        // Network mode - fetch only when online
        networkMode: 'offlineFirst',
      },
      mutations: {
        // Retry mutations once
        retry: 1,
        retryDelay: 1000,
        networkMode: 'offlineFirst',
      },
    },
  });
}

/**
 * Query key factories for consistent cache key generation
 */
export const queryKeys = {
  // Jobs
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...queryKeys.jobs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.jobs.lists(), filters] as const,
    details: () => [...queryKeys.jobs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
    featured: () => [...queryKeys.jobs.all, 'featured'] as const,
    saved: (userId: string) => [...queryKeys.jobs.all, 'saved', userId] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
    profile: (id: string) => [...queryKeys.users.all, 'profile', id] as const,
    notifications: (userId: string) => [...queryKeys.users.all, 'notifications', userId] as const,
  },

  // Proposals
  proposals: {
    all: ['proposals'] as const,
    list: (userId: string) => [...queryKeys.proposals.all, 'list', userId] as const,
    detail: (id: string) => [...queryKeys.proposals.all, 'detail', id] as const,
  },

  // Contracts
  contracts: {
    all: ['contracts'] as const,
    list: (userId: string) => [...queryKeys.contracts.all, 'list', userId] as const,
    detail: (id: string) => [...queryKeys.contracts.all, 'detail', id] as const,
  },

  // Messages
  messages: {
    all: ['messages'] as const,
    conversations: (userId: string) =>
      [...queryKeys.messages.all, 'conversations', userId] as const,
    conversation: (id: string) => [...queryKeys.messages.all, 'conversation', id] as const,
  },
};

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  // Invalidate all job-related caches
  jobs: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  },

  // Invalidate specific job
  job: (queryClient: QueryClient, jobId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
  },

  // Invalidate user data
  user: (queryClient: QueryClient, userId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.profile(userId) });
  },

  // Invalidate current user
  currentUser: (queryClient: QueryClient) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
  },

  // Invalidate all user's proposals
  proposals: (queryClient: QueryClient, userId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.proposals.list(userId) });
  },

  // Invalidate all user's contracts
  contracts: (queryClient: QueryClient, userId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.contracts.list(userId) });
  },

  // Clear entire cache (use sparingly)
  all: (queryClient: QueryClient) => {
    queryClient.clear();
  },
};

/**
 * Prefetch strategies for better UX
 */
export const prefetchStrategies = {
  // Prefetch job details on hover
  jobDetails: async (queryClient: QueryClient, jobId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.jobs.detail(jobId),
      queryFn: () => fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
      staleTime: STALE_TIMES.MEDIUM,
    });
  },

  // Prefetch user profile on hover
  userProfile: async (queryClient: QueryClient, userId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.users.profile(userId),
      queryFn: () => fetch(`/api/users/${userId}`).then((r) => r.json()),
      staleTime: STALE_TIMES.LONG,
    });
  },

  // Prefetch next page of jobs
  nextJobPage: async (
    queryClient: QueryClient,
    filters: Record<string, string>,
    nextPage: number
  ) => {
    const params = new URLSearchParams({ ...filters, page: nextPage.toString() });
    await queryClient.prefetchQuery({
      queryKey: queryKeys.jobs.list({ ...filters, page: nextPage }),
      queryFn: () =>
        fetch(`/api/jobs?${params.toString()}`).then((r) => r.json() as Promise<unknown>),
      staleTime: STALE_TIMES.SHORT,
    });
  },
};

/**
 * Optimistic update helpers
 */
export const optimisticUpdates = {
  // Optimistically update saved job status
  toggleSaveJob: (queryClient: QueryClient, userId: string, jobId: string, isSaved: boolean) => {
    const previousData = queryClient.getQueryData<string[]>(queryKeys.jobs.saved(userId));

    queryClient.setQueryData<string[]>(queryKeys.jobs.saved(userId), (old) => {
      if (!old) return isSaved ? [jobId] : [];
      return isSaved ? [...old, jobId] : old.filter((id) => id !== jobId);
    });

    return { previousData };
  },

  // Rollback on error
  rollbackSaveJob: (
    queryClient: QueryClient,
    userId: string,
    previousData: string[] | undefined
  ) => {
    queryClient.setQueryData(queryKeys.jobs.saved(userId), previousData);
  },
};
