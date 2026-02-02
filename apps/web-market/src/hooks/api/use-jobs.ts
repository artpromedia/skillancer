/**
 * Jobs API Hooks
 *
 * React Query hooks for job-related operations.
 */

'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import {
  jobsService,
  type Job,
  type JobSearchParams,
  type CreateJobInput,
  type UpdateJobInput,
  type JobStatus,
  type Category,
  type JobSkill,
} from '@/lib/api/services';

// =============================================================================
// Query Keys
// =============================================================================

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (params: JobSearchParams) => [...jobKeys.lists(), params] as const,
  search: (params: JobSearchParams) => [...jobKeys.all, 'search', params] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
  detailBySlug: (slug: string) => [...jobKeys.details(), 'slug', slug] as const,
  my: (params?: { status?: JobStatus }) => [...jobKeys.all, 'my', params] as const,
  featured: () => [...jobKeys.all, 'featured'] as const,
  recommended: () => [...jobKeys.all, 'recommended'] as const,
  categories: () => [...jobKeys.all, 'categories'] as const,
  skills: (query?: string) => [...jobKeys.all, 'skills', query] as const,
  popularSkills: () => [...jobKeys.all, 'skills', 'popular'] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Search jobs with filters and pagination
 */
export function useJobSearch(params: JobSearchParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobKeys.search(params),
    queryFn: () => jobsService.search(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Infinite scroll job search
 */
export function useInfiniteJobSearch(params: Omit<JobSearchParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...jobKeys.search(params), 'infinite'],
    queryFn: ({ pageParam = 1 }) => jobsService.search({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta?.hasMore) return undefined;
      return lastPage.meta.page + 1;
    },
    initialPageParam: 1,
  });
}

/**
 * Get a single job by ID
 */
export function useJob(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => jobsService.getById(id),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get a single job by slug
 */
export function useJobBySlug(slug: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobKeys.detailBySlug(slug),
    queryFn: () => jobsService.getBySlug(slug),
    enabled: !!slug && (options?.enabled ?? true),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get current user's posted jobs
 */
export function useMyJobs(params: { page?: number; limit?: number; status?: JobStatus } = {}) {
  return useQuery({
    queryKey: jobKeys.my(params),
    queryFn: () => jobsService.getMyJobs(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Get featured jobs
 */
export function useFeaturedJobs(limit = 6) {
  return useQuery({
    queryKey: jobKeys.featured(),
    queryFn: () => jobsService.getFeatured(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get recommended jobs for current user
 */
export function useRecommendedJobs(limit = 10, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobKeys.recommended(),
    queryFn: () => jobsService.getRecommended(limit),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get job categories
 */
export function useCategories() {
  return useQuery({
    queryKey: jobKeys.categories(),
    queryFn: () => jobsService.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes - categories don't change often
  });
}

/**
 * Search skills
 */
export function useSkillsSearch(query?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobKeys.skills(query),
    queryFn: () => jobsService.getSkills(query),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get popular skills
 */
export function usePopularSkills(limit = 20) {
  return useQuery({
    queryKey: jobKeys.popularSkills(),
    queryFn: () => jobsService.getPopularSkills(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Create a new job
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobInput) => jobsService.create(data),
    onSuccess: (result) => {
      // Invalidate job lists
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.my() });

      // Add the new job to cache
      if (result.data) {
        queryClient.setQueryData(jobKeys.detail(result.data.id), result);
      }
    },
  });
}

/**
 * Update a job
 */
export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateJobInput }) =>
      jobsService.update(id, data),
    onSuccess: (result, variables) => {
      // Update the job in cache
      queryClient.setQueryData(jobKeys.detail(variables.id), result);

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.my() });
    },
  });
}

/**
 * Delete a job
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobsService.delete(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: jobKeys.detail(id) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      queryClient.invalidateQueries({ queryKey: jobKeys.my() });
    },
  });
}

/**
 * Publish a draft job
 */
export function usePublishJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobsService.publish(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(jobKeys.detail(id), result);
      queryClient.invalidateQueries({ queryKey: jobKeys.my() });
    },
  });
}

/**
 * Pause a job
 */
export function usePauseJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobsService.pause(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(jobKeys.detail(id), result);
      queryClient.invalidateQueries({ queryKey: jobKeys.my() });
    },
  });
}

/**
 * Close a job
 */
export function useCloseJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobsService.close(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(jobKeys.detail(id), result);
      queryClient.invalidateQueries({ queryKey: jobKeys.my() });
    },
  });
}

// =============================================================================
// Helper Types
// =============================================================================

export type { Job, JobSearchParams, CreateJobInput, UpdateJobInput, Category, JobSkill };
