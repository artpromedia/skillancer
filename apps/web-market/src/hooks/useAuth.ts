'use client';

/**
 * Auth Hooks
 *
 * React Query hooks for authentication operations.
 * These hooks provide a consistent interface for auth operations
 * with automatic cache management and optimistic updates.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuthContext } from '@/lib/auth/auth-provider';
import { authService } from '@/lib/auth/auth-service';

// Query keys for auth-related queries
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  sessions: () => [...authKeys.all, 'sessions'] as const,
};

/**
 * Hook to get the current authenticated user
 * Uses the auth context for immediate access
 */
export function useUser() {
  const { user, isLoading, isAuthenticated, error, refreshUser } = useAuthContext();

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    refetch: refreshUser,
  };
}

/**
 * Hook to check if user is authenticated
 * Returns a simple boolean for conditional rendering
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuthContext();
  return isAuthenticated;
}

/**
 * Login mutation hook
 *
 * Handles the login flow including MFA verification if required.
 * Automatically updates the auth context on success.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const { login } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      email,
      password,
      rememberMe = false,
    }: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => {
      return login(email, password, rememberMe);
    },
    onSuccess: (response) => {
      // If login successful (not MFA required), invalidate user queries
      if ('success' in response && response.success && !response.mfaRequired) {
        void queryClient.invalidateQueries({ queryKey: authKeys.user() });
      }
    },
    onError: (error: Error) => {
      console.error('Login failed:', error.message);
    },
  });
}

/**
 * MFA verification mutation hook
 *
 * Used to complete login when MFA is required.
 */
export function useVerifyMFA() {
  const queryClient = useQueryClient();
  const { verifyMFA } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      pendingSessionId,
      code,
      method,
    }: {
      pendingSessionId: string;
      code: string;
      method: string;
    }) => {
      return verifyMFA(pendingSessionId, code, method);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
    onError: (error: Error) => {
      console.error('MFA verification failed:', error.message);
    },
  });
}

/**
 * Registration mutation hook
 *
 * Handles new user registration with role selection.
 */
export function useRegister() {
  const queryClient = useQueryClient();
  const { register } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      email,
      password,
      firstName,
      lastName,
      role,
    }: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: 'FREELANCER' | 'CLIENT' | 'BOTH';
    }) => {
      return register({ email, password, firstName, lastName, role });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
    onError: (error: Error) => {
      console.error('Registration failed:', error.message);
    },
  });
}

/**
 * Logout mutation hook
 *
 * Handles user logout and clears all auth-related cache.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthContext();

  return useMutation({
    mutationFn: async () => {
      return logout();
    },
    onSuccess: () => {
      // Clear all auth-related queries
      queryClient.removeQueries({ queryKey: authKeys.all });
      // Optionally invalidate other user-specific queries
      queryClient.clear();
    },
    onError: (error: Error) => {
      console.error('Logout failed:', error.message);
      // Still clear local state even if server logout fails
      queryClient.removeQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Forgot password mutation hook
 *
 * Sends a password reset email to the user.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      return authService.forgotPassword(email);
    },
    onError: (error: Error) => {
      console.error('Forgot password failed:', error.message);
    },
  });
}

/**
 * Reset password mutation hook
 *
 * Resets the user's password using a reset token.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      return authService.resetPassword(token, password);
    },
    onError: (error: Error) => {
      console.error('Reset password failed:', error.message);
    },
  });
}

/**
 * Verify email mutation hook
 *
 * Verifies the user's email address using a verification token.
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      return authService.verifyEmail(token);
    },
    onSuccess: () => {
      // Refresh user data after email verification
      void queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
    onError: (error: Error) => {
      console.error('Email verification failed:', error.message);
    },
  });
}

/**
 * Resend verification email mutation hook
 *
 * Resends the verification email to the user.
 */
export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      return authService.resendVerificationEmail(email);
    },
    onError: (error: Error) => {
      console.error('Resend verification email failed:', error.message);
    },
  });
}

/**
 * Update profile mutation hook
 *
 * Updates the current user's profile information.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuthContext();

  return useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; avatarUrl?: string }) => {
      return authService.updateProfile(data);
    },
    onSuccess: async () => {
      // Refresh user data after profile update
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
    onError: (error: Error) => {
      console.error('Profile update failed:', error.message);
    },
  });
}

/**
 * Change password mutation hook
 *
 * Changes the current user's password.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      return authService.changePassword(currentPassword, newPassword);
    },
    onError: (error: Error) => {
      console.error('Change password failed:', error.message);
    },
  });
}

/**
 * Get active sessions query hook
 *
 * Fetches all active sessions for the current user.
 */
export function useSessions() {
  const { isAuthenticated } = useAuthContext();

  return useQuery({
    queryKey: authKeys.sessions(),
    queryFn: () => authService.getSessions(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Revoke session mutation hook
 *
 * Revokes a specific session for the current user.
 */
export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      return authService.revokeSession(sessionId);
    },
    onSuccess: () => {
      // Refresh sessions list after revoking
      void queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
    onError: (error: Error) => {
      console.error('Revoke session failed:', error.message);
    },
  });
}

/**
 * Combined auth hook for common use cases
 *
 * Provides access to the most commonly used auth operations and state.
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, error, clearError } = useAuthContext();

  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const registerMutation = useRegister();

  const login = useCallback(
    (email: string, password: string, rememberMe?: boolean) => {
      return loginMutation.mutateAsync({ email, password, rememberMe });
    },
    [loginMutation]
  );

  const logout = useCallback(() => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const register = useCallback(
    (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: 'FREELANCER' | 'CLIENT' | 'BOTH';
    }) => {
      return registerMutation.mutateAsync(data);
    },
    [registerMutation]
  );

  return {
    // State
    user,
    isLoading:
      isLoading ||
      loginMutation.isPending ||
      logoutMutation.isPending ||
      registerMutation.isPending,
    isAuthenticated,
    error:
      error ||
      loginMutation.error?.message ||
      logoutMutation.error?.message ||
      registerMutation.error?.message,
    clearError,

    // Operations
    login,
    logout,
    register,

    // Mutation states for UI feedback
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error?.message,
    logoutError: logoutMutation.error?.message,
    registerError: registerMutation.error?.message,
  };
}

export type { AuthUser } from '@/lib/auth/auth-service';
