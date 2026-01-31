'use client';

/**
 * useJob Hook
 *
 * TanStack Query hook for fetching a single job by ID or slug.
 * Provides loading, error, and refetch capabilities.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getJobById, getJobBySlug, getRelatedJobs, getJobStats, type Job } from '@/lib/api/jobs';

// ============================================================================
// Query Keys
// ============================================================================

export const jobQueryKeys = {
  all: ['jobs'] as const,
  detail: (id: string) => [...jobQueryKeys.all, 'detail', id] as const,
  detailBySlug: (slug: string) => [...jobQueryKeys.all, 'detail', 'slug', slug] as const,
  related: (id: string) => [...jobQueryKeys.all, 'related', id] as const,
  stats: (id: string) => [...jobQueryKeys.all, 'stats', id] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface UseJobOptions {
  /** Whether to fetch by slug instead of ID */
  bySlug?: boolean;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Cache time in milliseconds */
  gcTime?: number;
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
}

export interface UseJobReturn {
  /** The job data */
  job: Job | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Fetching state (including background refetches) */
  isFetching: boolean;
  /** Error object if request failed */
  error: Error | null;
  /** Whether the query has successfully fetched at least once */
  isSuccess: boolean;
  /** Whether the query is in an error state */
  isError: boolean;
  /** Refetch the job data */
  refetch: () => Promise<void>;
  /** Invalidate and refetch the job data */
  invalidate: () => Promise<void>;
}

export interface JobStats {
  proposalCount: number;
  viewCount: number;
  averageBid: number;
  invitesSent: number;
  interviewsActive: number;
}

export interface UseJobStatsReturn {
  stats: JobStats | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseRelatedJobsReturn {
  jobs: Job[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch a single job by ID or slug
 *
 * @param identifier - The job ID or slug
 * @param options - Configuration options
 * @returns Job data with loading and error states
 *
 * @example
 * ```tsx
 * // Fetch by ID
 * const { job, isLoading, error } = useJob('job-123');
 *
 * // Fetch by slug
 * const { job, isLoading, error } = useJob('senior-developer-role', { bySlug: true });
 * ```
 */
export function useJob(identifier: string, options: UseJobOptions = {}): UseJobReturn {
  const {
    bySlug = false,
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus = false,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = bySlug ? jobQueryKeys.detailBySlug(identifier) : jobQueryKeys.detail(identifier);

  const queryFn = bySlug ? () => getJobBySlug(identifier) : () => getJobById(identifier);

  const query = useQuery<Job, Error>({
    queryKey,
    queryFn,
    enabled: enabled && !!identifier,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    job: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isSuccess: query.isSuccess,
    isError: query.isError,
    refetch,
    invalidate,
  };
}

/**
 * Hook to fetch job statistics (for clients managing their jobs)
 *
 * @param jobId - The job ID
 * @param enabled - Whether to enable the query
 * @returns Job statistics with loading and error states
 */
export function useJobStats(jobId: string, enabled = true): UseJobStatsReturn {
  const query = useQuery<JobStats, Error>({
    queryKey: jobQueryKeys.stats(jobId),
    queryFn: () => getJobStats(jobId),
    enabled: enabled && !!jobId,
    staleTime: 60 * 1000, // 1 minute - stats can change frequently
    refetchOnWindowFocus: true,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    stats: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

/**
 * Hook to fetch related/similar jobs
 *
 * @param jobId - The job ID to find related jobs for
 * @param limit - Maximum number of related jobs to return
 * @param enabled - Whether to enable the query
 * @returns Related jobs with loading and error states
 */
export function useRelatedJobs(jobId: string, limit = 6, enabled = true): UseRelatedJobsReturn {
  const query = useQuery<Job[], Error>({
    queryKey: [...jobQueryKeys.related(jobId), limit],
    queryFn: () => getRelatedJobs(jobId, limit),
    enabled: enabled && !!jobId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    jobs: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

/**
 * Hook to prefetch a job into the cache
 * Useful for optimistic prefetching on hover
 *
 * @returns Function to prefetch a job
 */
export function usePrefetchJob() {
  const queryClient = useQueryClient();

  const prefetchById = useCallback(
    async (id: string) => {
      await queryClient.prefetchQuery({
        queryKey: jobQueryKeys.detail(id),
        queryFn: () => getJobById(id),
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  const prefetchBySlug = useCallback(
    async (slug: string) => {
      await queryClient.prefetchQuery({
        queryKey: jobQueryKeys.detailBySlug(slug),
        queryFn: () => getJobBySlug(slug),
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchById, prefetchBySlug };
}

/**
 * Hook to set job data in the cache
 * Useful for optimistic updates after SSR
 *
 * @returns Function to set job data
 */
export function useSetJobData() {
  const queryClient = useQueryClient();

  const setJobData = useCallback(
    (job: Job) => {
      queryClient.setQueryData(jobQueryKeys.detail(job.id), job);
      queryClient.setQueryData(jobQueryKeys.detailBySlug(job.slug), job);
    },
    [queryClient]
  );

  return setJobData;
}
