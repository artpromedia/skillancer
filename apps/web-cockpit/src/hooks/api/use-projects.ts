/**
 * Projects API Hooks
 *
 * React Query hooks for project operations.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  projectsService,
  type Project,
  type ProjectListParams,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectStats,
  type ProjectTask,
  type ProjectMilestone,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '../lib/api/services/projects';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: ProjectListParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  stats: (id: string) => [...projectKeys.detail(id), 'stats'] as const,
  tasks: (id: string) => [...projectKeys.detail(id), 'tasks'] as const,
  milestones: (id: string) => [...projectKeys.detail(id), 'milestones'] as const,
  timeEntries: (id: string) => [...projectKeys.detail(id), 'time-entries'] as const,
};

// =============================================================================
// List Hooks
// =============================================================================

export function useProjects(
  params: ProjectListParams = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Project>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsService.list(params),
    ...options,
  });
}

// =============================================================================
// Detail Hooks
// =============================================================================

export function useProject(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Project>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsService.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useProjectStats(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<ProjectStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: projectKeys.stats(id),
    queryFn: () => projectsService.getStats(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useCreateProject(
  options?: UseMutationOptions<ApiResponse<Project>, Error, CreateProjectInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    ...options,
  });
}

export function useUpdateProject(
  options?: UseMutationOptions<
    ApiResponse<Project>,
    Error,
    { id: string; data: UpdateProjectInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => projectsService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    ...options,
  });
}

export function useDeleteProject(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    ...options,
  });
}

export function useArchiveProject(
  options?: UseMutationOptions<ApiResponse<Project>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsService.archive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    ...options,
  });
}

export function useUnarchiveProject(
  options?: UseMutationOptions<ApiResponse<Project>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsService.unarchive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
    ...options,
  });
}

// =============================================================================
// Task Hooks
// =============================================================================

export function useProjectTasks(
  projectId: string,
  options?: Omit<UseQueryOptions<ApiResponse<ProjectTask[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: projectKeys.tasks(projectId),
    queryFn: () => projectsService.getTasks(projectId),
    enabled: !!projectId,
    ...options,
  });
}

export function useCreateTask(
  options?: UseMutationOptions<
    ApiResponse<ProjectTask>,
    Error,
    { projectId: string; data: CreateTaskInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }) => projectsService.createTask(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.stats(projectId) });
    },
    ...options,
  });
}

export function useUpdateTask(
  options?: UseMutationOptions<
    ApiResponse<ProjectTask>,
    Error,
    { projectId: string; taskId: string; data: UpdateTaskInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, taskId, data }) =>
      projectsService.updateTask(projectId, taskId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.stats(projectId) });
    },
    ...options,
  });
}

export function useDeleteTask(
  options?: UseMutationOptions<ApiResponse<void>, Error, { projectId: string; taskId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, taskId }) => projectsService.deleteTask(projectId, taskId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.stats(projectId) });
    },
    ...options,
  });
}

// =============================================================================
// Milestone Hooks
// =============================================================================

export function useProjectMilestones(
  projectId: string,
  options?: Omit<UseQueryOptions<ApiResponse<ProjectMilestone[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: projectKeys.milestones(projectId),
    queryFn: () => projectsService.getMilestones(projectId),
    enabled: !!projectId,
    ...options,
  });
}

export function useCreateMilestone(
  options?: UseMutationOptions<
    ApiResponse<ProjectMilestone>,
    Error,
    {
      projectId: string;
      data: Omit<ProjectMilestone, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }) => projectsService.createMilestone(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
    },
    ...options,
  });
}

export function useUpdateMilestone(
  options?: UseMutationOptions<
    ApiResponse<ProjectMilestone>,
    Error,
    { projectId: string; milestoneId: string; data: Partial<ProjectMilestone> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, milestoneId, data }) =>
      projectsService.updateMilestone(projectId, milestoneId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
    },
    ...options,
  });
}

export function useDeleteMilestone(
  options?: UseMutationOptions<ApiResponse<void>, Error, { projectId: string; milestoneId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, milestoneId }) =>
      projectsService.deleteMilestone(projectId, milestoneId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
    },
    ...options,
  });
}

export function useSubmitMilestone(
  options?: UseMutationOptions<
    ApiResponse<ProjectMilestone>,
    Error,
    { projectId: string; milestoneId: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, milestoneId }) =>
      projectsService.submitMilestone(projectId, milestoneId),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.milestones(projectId) });
    },
    ...options,
  });
}
