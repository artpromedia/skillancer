/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * useClientJobs Hook
 *
 * TanStack Query hook for fetching jobs posted by the current client.
 * Used in the client dashboard for job management.
 */

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { clientJobQueryKeys } from './use-job-mutations';

import { getMyPostedJobs, getJobStats, type Job, type JobSearchResult } from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

export interface ClientJobFilters {
  status?: Job['status'];
  sortBy?: 'newest' | 'oldest' | 'proposals';
}

export interface UseClientJobsOptions {
  filters?: ClientJobFilters;
  enabled?: boolean;
  pageSize?: number;
}

export interface UseClientJobsReturn {
  jobs: Job[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}

export interface ClientJobStats {
  totalJobs: number;
  activeJobs: number;
  draftJobs: number;
  closedJobs: number;
  totalProposals: number;
  totalHired: number;
}

export interface UseClientJobStatsReturn {
  stats: ClientJobStats | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch paginated list of jobs posted by the current client
 *
 * @example
 * ```tsx
 * const { jobs, isLoading, hasMore, loadMore } = useClientJobs({
 *   filters: { status: 'OPEN' },
 * });
 * ```
 */
export function useClientJobs(options: UseClientJobsOptions = {}): UseClientJobsReturn {
  const { filters = {}, enabled = true, pageSize = 10 } = options;
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<JobSearchResult, Error>({
    queryKey: clientJobQueryKeys.list(filters),
    queryFn: ({ pageParam = 1 }) => {
      return getMyPostedJobs(filters, { page: pageParam as number, limit: pageSize });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const jobs = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.jobs) ?? [];
  }, [query.data]);

  const total = query.data?.pages[0]?.total ?? 0;

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
  }, [queryClient]);

  return {
    jobs,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasMore: !!query.hasNextPage,
    error: query.error,
    loadMore,
    refetch,
    invalidate,
  };
}

/**
 * Hook to fetch aggregated stats for client's job postings
 *
 * @example
 * ```tsx
 * const { stats, isLoading } = useClientJobStats();
 *
 * if (stats) {
 *   console.log(`You have ${stats.activeJobs} active jobs`);
 * }
 * ```
 */
export function useClientJobStats(enabled = true): UseClientJobStatsReturn {
  const query = useQuery<ClientJobStats, Error>({
    queryKey: [...clientJobQueryKeys.all, 'stats'],
    queryFn: async () => {
      // Fetch all jobs to compute stats (could be a dedicated endpoint)
      const [active, drafts, closed] = await Promise.all([
        getMyPostedJobs({ status: 'OPEN' }, { limit: 1 }),
        getMyPostedJobs({ status: 'DRAFT' }, { limit: 1 }),
        getMyPostedJobs({ status: 'CLOSED' }, { limit: 1 }),
      ]);

      // Get proposal counts from active jobs
      const totalProposals = active.jobs.reduce((sum, job) => sum + job.proposalCount, 0);

      return {
        totalJobs: active.total + drafts.total + closed.total,
        activeJobs: active.total,
        draftJobs: drafts.total,
        closedJobs: closed.total,
        totalProposals,
        totalHired: 0, // Would come from contracts API
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

/**
 * Hook to fetch a single job with its stats (for client dashboard)
 *
 * @example
 * ```tsx
 * const { job, stats, isLoading } = useClientJob('job-123');
 * ```
 */
export function useClientJob(jobId: string, enabled = true) {
  const queryClient = useQueryClient();

  const jobQuery = useQuery<Job, Error>({
    queryKey: clientJobQueryKeys.detail(jobId),
    queryFn: async () => {
      const result = await getMyPostedJobs({}, { limit: 100 });
      const job = result.jobs.find((j) => j.id === jobId);
      if (!job) throw new Error('Job not found');
      return job;
    },
    enabled: enabled && !!jobId,
    staleTime: 2 * 60 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: [...clientJobQueryKeys.detail(jobId), 'stats'],
    queryFn: () => getJobStats(jobId),
    enabled: enabled && !!jobId,
    staleTime: 60 * 1000, // 1 minute - stats change frequently
  });

  const refetch = useCallback(async () => {
    await Promise.all([jobQuery.refetch(), statsQuery.refetch()]);
  }, [jobQuery, statsQuery]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.detail(jobId) });
  }, [queryClient, jobId]);

  return {
    job: jobQuery.data,
    stats: statsQuery.data,
    isLoading: jobQuery.isLoading || statsQuery.isLoading,
    isFetching: jobQuery.isFetching || statsQuery.isFetching,
    error: jobQuery.error ?? statsQuery.error,
    refetch,
    invalidate,
  };
}
