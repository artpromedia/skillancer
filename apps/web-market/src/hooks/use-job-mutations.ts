/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
'use client';

/**
 * useJobMutations Hook
 *
 * TanStack Query mutations for creating, updating, and managing jobs.
 * For use by clients managing their job postings.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { jobQueryKeys } from './use-job';

import {
  createJob,
  updateJob,
  closeJob,
  reopenJob,
  deleteJob,
  pauseJob,
  resumeJob,
  publishJob,
  type CreateJobInput,
  type UpdateJobInput,
  type Job,
} from '@/lib/api/jobs';

// ============================================================================
// Types
// ============================================================================

export interface UseCreateJobOptions {
  onSuccess?: (job: Job) => void;
  onError?: (error: Error) => void;
}

export interface UseUpdateJobOptions {
  onSuccess?: (job: Job) => void;
  onError?: (error: Error) => void;
}

export interface UseCloseJobOptions {
  onSuccess?: (job: Job) => void;
  onError?: (error: Error) => void;
}

export interface UseDeleteJobOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface JobMutationState {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
}

// ============================================================================
// Query Keys for Client Jobs
// ============================================================================

export const clientJobQueryKeys = {
  all: ['client-jobs'] as const,
  list: (filters?: { status?: string }) => [...clientJobQueryKeys.all, 'list', filters] as const,
  detail: (id: string) => [...clientJobQueryKeys.all, 'detail', id] as const,
};

// ============================================================================
// Create Job Hook
// ============================================================================

/**
 * Hook for creating a new job posting
 *
 * @example
 * ```tsx
 * const { createJob, isCreating } = useCreateJob({
 *   onSuccess: (job) => router.push(`/dashboard/jobs/${job.id}`),
 * });
 *
 * const handleSubmit = (data: CreateJobInput) => {
 *   createJob(data);
 * };
 * ```
 */
export function useCreateJob(options: UseCreateJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, CreateJobInput>({
    mutationFn: createJob,
    onSuccess: (job) => {
      // Invalidate client jobs list
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    createJob: mutation.mutate,
    createJobAsync: mutation.mutateAsync,
    isCreating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Update Job Hook
// ============================================================================

/**
 * Hook for updating an existing job posting
 *
 * @example
 * ```tsx
 * const { updateJob, isUpdating } = useUpdateJob({
 *   onSuccess: () => toast.success('Job updated!'),
 * });
 *
 * const handleSave = (data: UpdateJobInput) => {
 *   updateJob({ jobId: 'job-123', input: data });
 * };
 * ```
 */
export function useUpdateJob(options: UseUpdateJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, { jobId: string; input: UpdateJobInput }>({
    mutationFn: ({ jobId, input }) => updateJob(jobId, input),
    onSuccess: (job) => {
      // Invalidate both the specific job and the list
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(job.id) });
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detailBySlug(job.slug) });
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    updateJob: mutation.mutate,
    updateJobAsync: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Close Job Hook
// ============================================================================

/**
 * Hook for closing a job posting
 *
 * @example
 * ```tsx
 * const { closeJob, isClosing } = useCloseJob({
 *   onSuccess: () => toast.success('Job closed'),
 * });
 *
 * const handleClose = () => {
 *   closeJob({ jobId: 'job-123', reason: 'Position filled' });
 * };
 * ```
 */
export function useCloseJob(options: UseCloseJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, { jobId: string; reason?: string }>({
    mutationFn: ({ jobId, reason }) => closeJob(jobId, reason),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(job.id) });
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detailBySlug(job.slug) });
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    closeJob: mutation.mutate,
    closeJobAsync: mutation.mutateAsync,
    isClosing: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Reopen Job Hook
// ============================================================================

/**
 * Hook for reopening a closed job posting
 */
export function useReopenJob(options: UseCloseJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, string>({
    mutationFn: reopenJob,
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(job.id) });
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detailBySlug(job.slug) });
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    reopenJob: mutation.mutate,
    reopenJobAsync: mutation.mutateAsync,
    isReopening: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Delete Job Hook
// ============================================================================

/**
 * Hook for deleting a draft job posting
 */
export function useDeleteJob(options: UseDeleteJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<void, Error, string>({
    mutationFn: deleteJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    deleteJob: mutation.mutate,
    deleteJobAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Pause Job Hook
// ============================================================================

/**
 * Hook for pausing a job posting
 */
export function usePauseJob(options: UseCloseJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, string>({
    mutationFn: pauseJob,
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(job.id) });
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detailBySlug(job.slug) });
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    pauseJob: mutation.mutate,
    pauseJobAsync: mutation.mutateAsync,
    isPausing: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Resume Job Hook
// ============================================================================

/**
 * Hook for resuming a paused job posting
 */
export function useResumeJob(options: UseCloseJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, string>({
    mutationFn: resumeJob,
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(job.id) });
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detailBySlug(job.slug) });
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    resumeJob: mutation.mutate,
    resumeJobAsync: mutation.mutateAsync,
    isResuming: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Publish Job Hook
// ============================================================================

/**
 * Hook for publishing a draft job posting
 */
export function usePublishJob(options: UseCloseJobOptions = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation<Job, Error, string>({
    mutationFn: publishJob,
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detail(job.id) });
      void queryClient.invalidateQueries({ queryKey: jobQueryKeys.detailBySlug(job.slug) });
      void queryClient.invalidateQueries({ queryKey: clientJobQueryKeys.all });
      onSuccess?.(job);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    publishJob: mutation.mutate,
    publishJobAsync: mutation.mutateAsync,
    isPublishing: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

// ============================================================================
// Combined Mutations Hook
// ============================================================================

/**
 * Combined hook for all job mutations
 * Useful when you need access to multiple mutation capabilities
 *
 * @example
 * ```tsx
 * const { createJob, updateJob, closeJob } = useJobMutations({
 *   onCreate: (job) => router.push(`/dashboard/jobs/${job.id}`),
 *   onUpdate: () => toast.success('Saved!'),
 *   onClose: () => toast.success('Job closed'),
 * });
 * ```
 */
export function useJobMutations(
  options: {
    onCreate?: (job: Job) => void;
    onUpdate?: (job: Job) => void;
    onClose?: (job: Job) => void;
    onDelete?: () => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const create = useCreateJob({
    onSuccess: options.onCreate,
    onError: options.onError,
  });

  const update = useUpdateJob({
    onSuccess: options.onUpdate,
    onError: options.onError,
  });

  const close = useCloseJob({
    onSuccess: options.onClose,
    onError: options.onError,
  });

  const remove = useDeleteJob({
    onSuccess: options.onDelete,
    onError: options.onError,
  });

  const pause = usePauseJob({ onError: options.onError });
  const resume = useResumeJob({ onError: options.onError });
  const publish = usePublishJob({ onError: options.onError });
  const reopen = useReopenJob({ onError: options.onError });

  return {
    // Create
    createJob: create.createJob,
    createJobAsync: create.createJobAsync,
    isCreating: create.isCreating,

    // Update
    updateJob: update.updateJob,
    updateJobAsync: update.updateJobAsync,
    isUpdating: update.isUpdating,

    // Close
    closeJob: close.closeJob,
    closeJobAsync: close.closeJobAsync,
    isClosing: close.isClosing,

    // Reopen
    reopenJob: reopen.reopenJob,
    reopenJobAsync: reopen.reopenJobAsync,
    isReopening: reopen.isReopening,

    // Delete
    deleteJob: remove.deleteJob,
    deleteJobAsync: remove.deleteJobAsync,
    isDeleting: remove.isDeleting,

    // Pause
    pauseJob: pause.pauseJob,
    pauseJobAsync: pause.pauseJobAsync,
    isPausing: pause.isPausing,

    // Resume
    resumeJob: resume.resumeJob,
    resumeJobAsync: resume.resumeJobAsync,
    isResuming: resume.isResuming,

    // Publish
    publishJob: publish.publishJob,
    publishJobAsync: publish.publishJobAsync,
    isPublishing: publish.isPublishing,

    // Combined state
    isAnyLoading:
      create.isCreating ||
      update.isUpdating ||
      close.isClosing ||
      remove.isDeleting ||
      pause.isPausing ||
      resume.isResuming ||
      publish.isPublishing ||
      reopen.isReopening,
  };
}
