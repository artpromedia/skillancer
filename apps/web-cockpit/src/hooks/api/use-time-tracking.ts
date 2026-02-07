/**
 * Time Tracking API Hooks
 *
 * React Query hooks for time tracking operations.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  timeTrackingService,
  type TimeEntry,
  type TimeEntryCreate,
  type TimeEntryUpdate,
  type TimeEntryFilters,
  type TimerState,
  type TimeCategory,
  type TimeReport,
  type TimeReportParams,
  type WeeklyReport,
  type DailyReport,
} from '../../lib/api/services/time-tracking';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const timeKeys = {
  all: ['time'] as const,
  entries: () => [...timeKeys.all, 'entries'] as const,
  entryList: (filters: TimeEntryFilters) => [...timeKeys.entries(), filters] as const,
  entry: (id: string) => [...timeKeys.entries(), id] as const,
  timer: () => [...timeKeys.all, 'timer'] as const,
  categories: () => [...timeKeys.all, 'categories'] as const,
  reports: () => [...timeKeys.all, 'reports'] as const,
  report: (params: TimeReportParams) => [...timeKeys.reports(), params] as const,
  weeklyReport: (weekStart?: string) => [...timeKeys.reports(), 'weekly', weekStart] as const,
  dailyReport: (date?: string) => [...timeKeys.reports(), 'daily', date] as const,
};

// =============================================================================
// Time Entry Hooks
// =============================================================================

export function useTimeEntries(
  filters: TimeEntryFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<TimeEntry>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.entryList(filters),
    queryFn: () => timeTrackingService.list(filters),
    ...options,
  });
}

export function useTimeEntry(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<TimeEntry>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.entry(id),
    queryFn: () => timeTrackingService.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useCreateTimeEntry(
  options?: UseMutationOptions<ApiResponse<TimeEntry>, Error, TimeEntryCreate>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TimeEntryCreate) => timeTrackingService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.entries() });
      queryClient.invalidateQueries({ queryKey: timeKeys.reports() });
    },
    ...options,
  });
}

export function useUpdateTimeEntry(
  options?: UseMutationOptions<ApiResponse<TimeEntry>, Error, { id: string; data: TimeEntryUpdate }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => timeTrackingService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: timeKeys.entry(id) });
      queryClient.invalidateQueries({ queryKey: timeKeys.entries() });
      queryClient.invalidateQueries({ queryKey: timeKeys.reports() });
    },
    ...options,
  });
}

export function useDeleteTimeEntry(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => timeTrackingService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.entries() });
      queryClient.invalidateQueries({ queryKey: timeKeys.reports() });
    },
    ...options,
  });
}

export function useBulkDeleteTimeEntries(
  options?: UseMutationOptions<ApiResponse<{ deleted: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => timeTrackingService.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.entries() });
      queryClient.invalidateQueries({ queryKey: timeKeys.reports() });
    },
    ...options,
  });
}

export function useDuplicateTimeEntry(
  options?: UseMutationOptions<ApiResponse<TimeEntry>, Error, { id: string; date?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, date }) => timeTrackingService.duplicate(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.entries() });
    },
    ...options,
  });
}

// =============================================================================
// Timer Hooks
// =============================================================================

export function useTimerState(
  options?: Omit<UseQueryOptions<ApiResponse<TimerState | null>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.timer(),
    queryFn: () => timeTrackingService.getTimerState(),
    refetchInterval: 1000, // Poll every second when timer is running
    ...options,
  });
}

export function useStartTimer(
  options?: UseMutationOptions<
    ApiResponse<TimerState>,
    Error,
    {
      projectId?: string;
      taskId?: string;
      categoryId?: string;
      description?: string;
      billable?: boolean;
      tags?: string[];
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => timeTrackingService.startTimer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.timer() });
    },
    ...options,
  });
}

export function useStopTimer(options?: UseMutationOptions<ApiResponse<TimeEntry>, Error, void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => timeTrackingService.stopTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.timer() });
      queryClient.invalidateQueries({ queryKey: timeKeys.entries() });
      queryClient.invalidateQueries({ queryKey: timeKeys.reports() });
    },
    ...options,
  });
}

export function usePauseTimer(options?: UseMutationOptions<ApiResponse<TimerState>, Error, void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => timeTrackingService.pauseTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.timer() });
    },
    ...options,
  });
}

export function useResumeTimer(options?: UseMutationOptions<ApiResponse<TimerState>, Error, void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => timeTrackingService.resumeTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.timer() });
    },
    ...options,
  });
}

export function useUpdateTimer(
  options?: UseMutationOptions<
    ApiResponse<TimerState>,
    Error,
    {
      projectId?: string;
      taskId?: string;
      categoryId?: string;
      description?: string;
      billable?: boolean;
      tags?: string[];
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => timeTrackingService.updateTimer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.timer() });
    },
    ...options,
  });
}

export function useDiscardTimer(options?: UseMutationOptions<ApiResponse<void>, Error, void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => timeTrackingService.discardTimer(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.timer() });
    },
    ...options,
  });
}

// =============================================================================
// Category Hooks
// =============================================================================

export function useTimeCategories(
  options?: Omit<UseQueryOptions<ApiResponse<TimeCategory[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.categories(),
    queryFn: () => timeTrackingService.getCategories(),
    ...options,
  });
}

export function useCreateTimeCategory(
  options?: UseMutationOptions<
    ApiResponse<TimeCategory>,
    Error,
    Omit<TimeCategory, 'id' | 'isActive'>
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => timeTrackingService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.categories() });
    },
    ...options,
  });
}

export function useUpdateTimeCategory(
  options?: UseMutationOptions<
    ApiResponse<TimeCategory>,
    Error,
    { id: string; data: Partial<TimeCategory> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => timeTrackingService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.categories() });
    },
    ...options,
  });
}

export function useDeleteTimeCategory(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => timeTrackingService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeKeys.categories() });
    },
    ...options,
  });
}

// =============================================================================
// Report Hooks
// =============================================================================

export function useTimeReport(
  params: TimeReportParams,
  options?: Omit<UseQueryOptions<ApiResponse<TimeReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.report(params),
    queryFn: () => timeTrackingService.generateReport(params),
    enabled: !!params.startDate && !!params.endDate,
    ...options,
  });
}

export function useWeeklyReport(
  weekStart?: string,
  options?: Omit<UseQueryOptions<ApiResponse<WeeklyReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.weeklyReport(weekStart),
    queryFn: () => timeTrackingService.getWeeklyReport(weekStart),
    ...options,
  });
}

export function useDailyReport(
  date?: string,
  options?: Omit<UseQueryOptions<ApiResponse<DailyReport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: timeKeys.dailyReport(date),
    queryFn: () => timeTrackingService.getDailyReport(date),
    ...options,
  });
}
