/**
 * Auth Provider
 *
 * React context provider for authentication state management.
 * Handles user session, token refresh, and auth state synchronization.
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import { authService, type AuthUser } from './auth-service';
import { isAuthenticated as checkIsAuthenticated } from '../api/api-client';

// =============================================================================
// Types
// =============================================================================

export interface AuthContextValue {
  /** Current authenticated user, null if not logged in */
  user: AuthUser | null;
  /** Whether authentication state is being loaded */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Error message from last auth operation */
  error: string | null;
  /** Login with email and password */
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; mfaRequired?: boolean; pendingSessionId?: string }>;
  /** Complete MFA verification */
  verifyMFA: (
    pendingSessionId: string,
    code: string,
    method: string
  ) => Promise<{ success: boolean }>;
  /** Register new user */
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: 'FREELANCER' | 'CLIENT' | 'BOTH';
  }) => Promise<{ success: boolean; message?: string }>;
  /** Logout current user */
  logout: (allSessions?: boolean) => Promise<void>;
  /** Refresh current user data */
  refreshUser: () => Promise<void>;
  /** Clear any auth errors */
  clearError: () => void;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => user !== null, [user]);

  /**
   * Refresh user data - defined early so it can be used in effects
   */
  const refreshUser = useCallback(async () => {
    if (!checkIsAuthenticated()) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, []);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a valid token
        if (checkIsAuthenticated()) {
          // Fetch current user
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch {
        // Token invalid or expired, clear state
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  /**
   * Listen for auth events (token expiry, logout from other tabs)
   */
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setError(null);
    };

    const handleTokenRefreshed = () => {
      // Optionally refresh user data when token is refreshed
      // This ensures user data stays in sync
    };

    const handleStorageChange = (e: StorageEvent) => {
      // Sync auth state across tabs
      if (e.key === 'skillancer_access_token') {
        if (!e.newValue) {
          // Token was removed in another tab
          setUser(null);
        } else if (!user && e.newValue) {
          // Token was added in another tab, refresh user
          void refreshUser();
        }
      }
    };

    globalThis.addEventListener('auth:logout', handleLogout);
    globalThis.addEventListener('auth:token_refreshed', handleTokenRefreshed);
    globalThis.addEventListener('storage', handleStorageChange);

    return () => {
      globalThis.removeEventListener('auth:logout', handleLogout);
      globalThis.removeEventListener('auth:token_refreshed', handleTokenRefreshed);
      globalThis.removeEventListener('storage', handleStorageChange);
    };
  }, [user, refreshUser]);

  /**
   * Login handler
   */
  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    setError(null);

    try {
      const result = await authService.login(email, password, rememberMe);

      // Check if MFA is required
      if ('mfaRequired' in result && result.mfaRequired) {
        return {
          success: true,
          mfaRequired: true,
          pendingSessionId: result.pendingSessionId,
        };
      }

      // Login successful - result is LoginResponse with user
      if ('user' in result) {
        setUser(result.user);
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { success: false };
    }
  }, []);

  /**
   * MFA verification handler
   */
  const verifyMFA = useCallback(async (pendingSessionId: string, code: string, method: string) => {
    setError(null);

    try {
      const result = await authService.verifyMFA(pendingSessionId, code, method);
      setUser(result.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MFA verification failed';
      setError(message);
      return { success: false };
    }
  }, []);

  /**
   * Register handler
   */
  const register = useCallback(
    async (data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      role?: 'FREELANCER' | 'CLIENT' | 'BOTH';
    }) => {
      setError(null);

      try {
        const result = await authService.register(data);
        return { success: result.success, message: result.message };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
        return { success: false, message };
      }
    },
    []
  );

  /**
   * Logout handler
   */
  const logout = useCallback(async (allSessions = false) => {
    try {
      await authService.logout(allSessions);
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      login,
      verifyMFA,
      register,
      logout,
      refreshUser,
      clearError,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      error,
      login,
      verifyMFA,
      register,
      logout,
      refreshUser,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access auth context
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

export default AuthProvider;
