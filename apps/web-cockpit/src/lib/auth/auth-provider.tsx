/**
 * Web Cockpit Auth Provider
 *
 * React context provider for authentication state management.
 * Handles user session, token refresh, tenant switching, and auth state synchronization.
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

import { cockpitAuthService, type CockpitUser, type TenantInfo } from './auth-service';
import { isAuthenticated as checkIsAuthenticated, getCurrentTenantId } from '../api/api-client';

// =============================================================================
// Types
// =============================================================================

export interface CockpitAuthContextValue {
  /** Current authenticated user, null if not logged in */
  user: CockpitUser | null;
  /** Whether authentication state is being loaded */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Error message from last auth operation */
  error: string | null;
  /** Current tenant ID */
  currentTenantId: string | null;
  /** Available tenants for multi-tenant support */
  tenants: TenantInfo[];
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
  /** Logout current user */
  logout: (allSessions?: boolean) => Promise<void>;
  /** Refresh current user data */
  refreshUser: () => Promise<void>;
  /** Switch to a different tenant */
  switchTenant: (tenantId: string) => Promise<{ success: boolean }>;
  /** Clear any auth errors */
  clearError: () => void;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Check if user has all of the specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
}

// =============================================================================
// Context
// =============================================================================

const CockpitAuthContext = createContext<CockpitAuthContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface CockpitAuthProviderProps {
  readonly children: ReactNode;
}

export function CockpitAuthProvider({ children }: CockpitAuthProviderProps) {
  const [user, setUser] = useState<CockpitUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => user !== null, [user]);

  /**
   * Refresh user data - defined early so it can be used in effects
   */
  const refreshUser = useCallback(async () => {
    if (!checkIsAuthenticated()) {
      setUser(null);
      setTenants([]);
      return;
    }

    try {
      const currentUser = await cockpitAuthService.getCurrentUser();
      setUser(currentUser);

      // Load tenants if user is authenticated
      if (currentUser.tenants) {
        setTenants(currentUser.tenants);
      } else {
        try {
          const userTenants = await cockpitAuthService.getTenants();
          setTenants(userTenants);
        } catch {
          // Tenants may not be available for all users
          setTenants([]);
        }
      }
    } catch {
      setUser(null);
      setTenants([]);
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
          // Get current tenant ID from storage
          const storedTenantId = getCurrentTenantId();
          if (storedTenantId) {
            setCurrentTenantIdState(storedTenantId);
          }

          // Fetch current user
          const currentUser = await cockpitAuthService.getCurrentUser();
          setUser(currentUser);

          // Set current tenant from user if not already set
          if (!storedTenantId && currentUser.currentTenantId) {
            setCurrentTenantIdState(currentUser.currentTenantId);
          }

          // Load tenants
          if (currentUser.tenants) {
            setTenants(currentUser.tenants);
          } else {
            try {
              const userTenants = await cockpitAuthService.getTenants();
              setTenants(userTenants);
            } catch {
              setTenants([]);
            }
          }
        }
      } catch {
        // Token invalid or expired, clear state
        setUser(null);
        setTenants([]);
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
      setTenants([]);
      setCurrentTenantIdState(null);
      setError(null);
    };

    const handleStorageChange = (e: StorageEvent) => {
      // Sync auth state across tabs
      if (e.key === 'skillancer_cockpit_access_token') {
        if (!e.newValue) {
          // Token was removed in another tab
          setUser(null);
          setTenants([]);
        } else if (!user && e.newValue) {
          // Token was added in another tab, refresh user
          void refreshUser();
        }
      }

      // Sync tenant changes
      if (e.key === 'skillancer_cockpit_tenant_id') {
        setCurrentTenantIdState(e.newValue);
      }
    };

    globalThis.addEventListener('auth:logout', handleLogout);
    globalThis.addEventListener('storage', handleStorageChange);

    return () => {
      globalThis.removeEventListener('auth:logout', handleLogout);
      globalThis.removeEventListener('storage', handleStorageChange);
    };
  }, [user, refreshUser]);

  /**
   * Login handler
   */
  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    setError(null);

    try {
      const result = await cockpitAuthService.login(email, password, rememberMe);

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
        if (result.user.currentTenantId) {
          setCurrentTenantIdState(result.user.currentTenantId);
        }
        if (result.user.tenants) {
          setTenants(result.user.tenants);
        }
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
      const result = await cockpitAuthService.verifyMFA(pendingSessionId, code, method);
      setUser(result.user);
      if (result.user.currentTenantId) {
        setCurrentTenantIdState(result.user.currentTenantId);
      }
      if (result.user.tenants) {
        setTenants(result.user.tenants);
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MFA verification failed';
      setError(message);
      return { success: false };
    }
  }, []);

  /**
   * Logout handler
   */
  const logout = useCallback(async (allSessions = false) => {
    try {
      await cockpitAuthService.logout(allSessions);
    } finally {
      setUser(null);
      setTenants([]);
      setCurrentTenantIdState(null);
      setError(null);
    }
  }, []);

  /**
   * Switch tenant handler
   */
  const switchTenant = useCallback(
    async (tenantId: string) => {
      setError(null);

      try {
        const result = await cockpitAuthService.switchTenant(tenantId);
        if (result.success) {
          setCurrentTenantIdState(tenantId);
          // Refresh user to get tenant-specific data
          await refreshUser();
        }
        return { success: result.success };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to switch tenant';
        setError(message);
        return { success: false };
      }
    },
    [refreshUser]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Permission checking helpers
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions?.includes(permission) || false;
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      return permissions.some((p) => user.permissions?.includes(p));
    },
    [user]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      return permissions.every((p) => user.permissions?.includes(p));
    },
    [user]
  );

  const value = useMemo<CockpitAuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      currentTenantId,
      tenants,
      login,
      verifyMFA,
      logout,
      refreshUser,
      switchTenant,
      clearError,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      error,
      currentTenantId,
      tenants,
      login,
      verifyMFA,
      logout,
      refreshUser,
      switchTenant,
      clearError,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    ]
  );

  return <CockpitAuthContext.Provider value={value}>{children}</CockpitAuthContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access cockpit auth context
 */
export function useCockpitAuth(): CockpitAuthContextValue {
  const context = useContext(CockpitAuthContext);

  if (!context) {
    throw new Error('useCockpitAuth must be used within a CockpitAuthProvider');
  }

  return context;
}

/**
 * Alias for useCockpitAuth
 */
export const useAuth = useCockpitAuth;

export default CockpitAuthProvider;
