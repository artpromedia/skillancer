/**
 * @module @skillancer/api-client/react
 * React hooks and context for Skillancer API client
 */

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  createSkillancerClient,
  type SkillancerClient,
  type SkillancerClientConfig,
} from '../skillancer-client';
import { LocalStorageTokenStorage } from '../storage';
import type {
  AuthUser,
  LoginCredentials,
  RegisterData,
  LoginResponse,
  RegisterResponse,
} from '../services/auth';

// =============================================================================
// Context
// =============================================================================

interface SkillancerContextValue {
  client: SkillancerClient;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  register: (data: RegisterData) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SkillancerContext = createContext<SkillancerContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface SkillancerProviderProps {
  children: ReactNode;
  config: Omit<SkillancerClientConfig, 'tokenStorage'>;
  tokenStorageKey?: string;
  onAuthStateChange?: (user: AuthUser | null) => void;
}

export function SkillancerProvider({
  children,
  config,
  tokenStorageKey = 'skillancer_auth',
  onAuthStateChange,
}: SkillancerProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create token storage
  const tokenStorage = new LocalStorageTokenStorage(
    `${tokenStorageKey}_access`,
    `${tokenStorageKey}_refresh`
  );

  // Create client
  const [client] = useState(() =>
    createSkillancerClient({
      ...config,
      tokenStorage,
      errorHandlers: {
        ...config.errorHandlers,
        onUnauthorized: () => {
          setUser(null);
          config.errorHandlers?.onUnauthorized?.();
        },
      },
    })
  );

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      if (!client.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await client.auth.me();
        setUser(currentUser);
        onAuthStateChange?.(currentUser);

        // Connect WebSocket after authentication
        client.connectWebSocket();
      } catch {
        // Token might be invalid, clear it
        client.clearTokens();
        setUser(null);
        onAuthStateChange?.(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();

    // Cleanup WebSocket on unmount
    return () => {
      client.disconnectWebSocket();
    };
  }, [client, onAuthStateChange]);

  // Login handler
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const response = await client.auth.login(credentials);

      if (!response.mfaRequired) {
        client.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
        setUser(response.user);
        onAuthStateChange?.(response.user);
        client.connectWebSocket();
      }

      return response;
    },
    [client, onAuthStateChange]
  );

  // Register handler
  const register = useCallback(
    async (data: RegisterData): Promise<RegisterResponse> => {
      const response = await client.auth.register(data);

      client.setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setUser({ ...response.user, roles: [], permissions: [] });
      onAuthStateChange?.({ ...response.user, roles: [], permissions: [] });
      client.connectWebSocket();

      return response;
    },
    [client, onAuthStateChange]
  );

  // Logout handler
  const logout = useCallback(async (): Promise<void> => {
    try {
      await client.auth.logout();
    } finally {
      client.clearTokens();
      client.disconnectWebSocket();
      setUser(null);
      onAuthStateChange?.(null);
    }
  }, [client, onAuthStateChange]);

  // Refresh user handler
  const refreshUser = useCallback(async (): Promise<void> => {
    if (!client.isAuthenticated()) return;

    try {
      const currentUser = await client.auth.me();
      setUser(currentUser);
      onAuthStateChange?.(currentUser);
    } catch {
      // If refresh fails, user might need to re-login
    }
  }, [client, onAuthStateChange]);

  const value: SkillancerContextValue = {
    client,
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <SkillancerContext.Provider value={value}>{children}</SkillancerContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Get the Skillancer API client
 */
export function useSkillancerClient(): SkillancerClient {
  const context = useContext(SkillancerContext);
  if (!context) {
    throw new Error('useSkillancerClient must be used within a SkillancerProvider');
  }
  return context.client;
}

/**
 * Get current authenticated user
 */
export function useUser(): AuthUser | null {
  const context = useContext(SkillancerContext);
  if (!context) {
    throw new Error('useUser must be used within a SkillancerProvider');
  }
  return context.user;
}

/**
 * Get authentication state and methods
 */
export function useAuth() {
  const context = useContext(SkillancerContext);
  if (!context) {
    throw new Error('useAuth must be used within a SkillancerProvider');
  }

  return {
    user: context.user,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    login: context.login,
    register: context.register,
    logout: context.logout,
    refreshUser: context.refreshUser,
  };
}

/**
 * Get auth service client
 */
export function useAuthService() {
  const client = useSkillancerClient();
  return client.auth;
}

/**
 * Get user service client
 */
export function useUserService() {
  const client = useSkillancerClient();
  return client.users;
}

/**
 * Get job service client
 */
export function useJobService() {
  const client = useSkillancerClient();
  return client.jobs;
}

/**
 * Get messaging service client
 */
export function useMessagingService() {
  const client = useSkillancerClient();
  return client.messages;
}

/**
 * Get billing service client
 */
export function useBillingService() {
  const client = useSkillancerClient();
  return client.billing;
}

/**
 * Get WebSocket client
 */
export function useWebSocket() {
  const client = useSkillancerClient();
  return client.ws;
}

/**
 * Subscribe to WebSocket events
 */
export function useWebSocketEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const ws = useWebSocket();

  useEffect(() => {
    if (!ws) return;

    const unsubscribe = ws.on(event as any, (e) => {
      handler(e.payload as T);
    });

    return unsubscribe;
  }, [ws, event, handler]);
}

/**
 * Get WebSocket connection status
 */
export function useWebSocketStatus() {
  const ws = useWebSocket();
  const [isConnected, setIsConnected] = useState(ws?.isConnected() ?? false);

  useEffect(() => {
    if (!ws) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const unsubConnect = ws.onConnect(handleConnect);
    const unsubDisconnect = ws.onDisconnect(handleDisconnect);

    // Check initial state
    setIsConnected(ws.isConnected());

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [ws]);

  return isConnected;
}
