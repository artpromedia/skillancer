/**
 * User Management Hooks
 *
 * React Query hooks for user management in the admin panel.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  usersService,
  type User,
  type UserFilters,
  type UserCreate,
  type UserUpdate,
  type UserActivity,
  type UserSession,
  type UserStats,
} from '../../lib/api/services/users';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const userKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  byEmail: (email: string) => [...userKeys.all, 'email', email] as const,
  activity: (id: string) => [...userKeys.detail(id), 'activity'] as const,
  sessions: (id: string) => [...userKeys.detail(id), 'sessions'] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * List users
 */
export function useUsers(
  filters: UserFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<User>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => usersService.listUsers(filters),
    ...options,
  });
}

/**
 * Get user by ID
 */
export function useUser(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<User>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersService.getUser(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Get user by email
 */
export function useUserByEmail(
  email: string,
  options?: Omit<UseQueryOptions<ApiResponse<User>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.byEmail(email),
    queryFn: () => usersService.getUserByEmail(email),
    enabled: !!email,
    ...options,
  });
}

/**
 * Get user activity
 */
export function useUserActivity(
  userId: string,
  params?: { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<UserActivity>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.activity(userId),
    queryFn: () => usersService.getUserActivity(userId, params),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Get user sessions
 */
export function useUserSessions(
  userId: string,
  options?: Omit<UseQueryOptions<ApiResponse<UserSession[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.sessions(userId),
    queryFn: () => usersService.getUserSessions(userId),
    enabled: !!userId,
    ...options,
  });
}

/**
 * Get user stats
 */
export function useUserStats(
  options?: Omit<UseQueryOptions<ApiResponse<UserStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: () => usersService.getStats(),
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Create user
 */
export function useCreateUser(options?: UseMutationOptions<ApiResponse<User>, Error, UserCreate>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserCreate) => usersService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
    ...options,
  });
}

/**
 * Update user
 */
export function useUpdateUser(
  options?: UseMutationOptions<ApiResponse<User>, Error, { id: string; data: UserUpdate }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => usersService.updateUser(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    ...options,
  });
}

/**
 * Delete user
 */
export function useDeleteUser(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
    ...options,
  });
}

/**
 * Suspend user
 */
export function useSuspendUser(
  options?: UseMutationOptions<
    ApiResponse<User>,
    Error,
    { id: string; reason: string; duration?: number }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, duration }) => usersService.suspendUser(id, reason, duration),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    ...options,
  });
}

/**
 * Unsuspend user
 */
export function useUnsuspendUser(options?: UseMutationOptions<ApiResponse<User>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.unsuspendUser(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    ...options,
  });
}

/**
 * Ban user
 */
export function useBanUser(
  options?: UseMutationOptions<ApiResponse<User>, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => usersService.banUser(id, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    ...options,
  });
}

/**
 * Unban user
 */
export function useUnbanUser(options?: UseMutationOptions<ApiResponse<User>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.unbanUser(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    ...options,
  });
}

/**
 * Reset user password
 */
export function useResetUserPassword(
  options?: UseMutationOptions<ApiResponse<void>, Error, string>
) {
  return useMutation({
    mutationFn: (id: string) => usersService.resetPassword(id),
    ...options,
  });
}

/**
 * Force logout user
 */
export function useForceLogoutUser(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.forceLogout(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.sessions(id) });
    },
    ...options,
  });
}

/**
 * Verify user email
 */
export function useVerifyUserEmail(options?: UseMutationOptions<ApiResponse<User>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.verifyEmail(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
    ...options,
  });
}

/**
 * Disable user 2FA
 */
export function useDisableUser2FA(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.disable2FA(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
    ...options,
  });
}

/**
 * Unlock user account
 */
export function useUnlockUserAccount(
  options?: UseMutationOptions<ApiResponse<User>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.unlockAccount(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
    ...options,
  });
}

/**
 * Bulk suspend users
 */
export function useBulkSuspendUsers(
  options?: UseMutationOptions<
    ApiResponse<{ suspended: number }>,
    Error,
    { userIds: string[]; reason: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userIds, reason }) => usersService.bulkSuspend(userIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    ...options,
  });
}

/**
 * Bulk delete users
 */
export function useBulkDeleteUsers(
  options?: UseMutationOptions<ApiResponse<{ deleted: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) => usersService.bulkDelete(userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
    ...options,
  });
}

/**
 * Impersonate user
 */
export function useImpersonateUser(
  options?: UseMutationOptions<ApiResponse<{ token: string; expiresAt: string }>, Error, string>
) {
  return useMutation({
    mutationFn: (userId: string) => usersService.impersonate(userId),
    ...options,
  });
}
