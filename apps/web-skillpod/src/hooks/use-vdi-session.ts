/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars */
'use client';

/**
 * useVdiSession Hook
 *
 * VDI session management:
 * - Session state management
 * - Connection lifecycle
 * - Automatic reconnection with backoff
 * - Quality monitoring
 * - Activity tracking
 * - Session extension requests
 */

import { useToast } from '@skillancer/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { viewerApi, type SessionDetails, type SessionToken } from '@/lib/api/viewer';
import {
  type ConnectionState,
  type KasmConnectionOptions,
  type KasmQualityMetrics,
  kasmClient,
  type QualityLevel,
} from '@/lib/kasm/kasm-client';

// ============================================================================
// TYPES
// ============================================================================

export interface VdiSessionState {
  sessionId: string | null;
  connectionState: ConnectionState;
  quality: QualityLevel;
  metrics: KasmQualityMetrics | null;
  sessionDetails: SessionDetails | null;
  startTime: Date | null;
  isActive: boolean;
  error: string | null;
  reconnectAttempt: number;
}

export interface VdiSessionActions {
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  setQuality: (quality: QualityLevel) => void;
  extendSession: () => Promise<void>;
  reportActivity: (event: string, data?: Record<string, unknown>) => Promise<void>;
}

export interface UseVdiSessionOptions {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onError?: (error: string) => void;
  onSessionExpiring?: (remainingSeconds: number) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  idleTimeoutMs?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const SESSION_WARNING_THRESHOLD = 5 * 60; // 5 minutes before expiry

// ============================================================================
// HOOK
// ============================================================================

export function useVdiSession(
  options: UseVdiSessionOptions = {}
): [VdiSessionState, VdiSessionActions] {
  const {
    onConnected,
    onDisconnected,
    onError,
    onSessionExpiring,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT,
  } = options;

  const { toast } = useToast();

  // State
  const [state, setState] = useState<VdiSessionState>({
    sessionId: null,
    connectionState: 'disconnected',
    quality: 'auto',
    metrics: null,
    sessionDetails: null,
    startTime: null,
    isActive: false,
    error: null,
    reconnectAttempt: 0,
  });

  // Refs
  const sessionTokenRef = useRef<SessionToken | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionWarningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());

  // ============================================================================
  // CONNECTION HANDLERS
  // ============================================================================

  const handleConnected = useCallback(() => {
    setState((prev) => ({
      ...prev,
      connectionState: 'connected',
      startTime: new Date(),
      isActive: true,
      error: null,
      reconnectAttempt: 0,
    }));

    onConnected?.();

    toast({
      title: 'Connected',
      description: 'Successfully connected to secure workspace',
    });
  }, [onConnected, toast]);

  const handleDisconnected = useCallback(
    (reason?: string) => {
      setState((prev) => ({
        ...prev,
        connectionState: 'disconnected',
        isActive: false,
      }));

      onDisconnected?.(reason);

      if (reason !== 'User requested disconnect') {
        toast({
          title: 'Disconnected',
          description: reason || 'Connection to workspace lost',
          variant: 'destructive',
        });
      }
    },
    [onDisconnected, toast]
  );

  const handleError = useCallback(
    (error: Error) => {
      setState((prev) => ({
        ...prev,
        connectionState: 'error',
        error: error.message,
        isActive: false,
      }));

      onError?.(error.message);

      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    [onError, toast]
  );

  const handleReconnecting = useCallback((attempt: number) => {
    setState((prev) => ({
      ...prev,
      connectionState: 'reconnecting',
      reconnectAttempt: attempt,
    }));
  }, []);

  const handleQualityChange = useCallback((metrics: KasmQualityMetrics) => {
    setState((prev) => ({
      ...prev,
      metrics,
    }));
  }, []);

  // ============================================================================
  // SESSION ACTIONS
  // ============================================================================

  const connect = useCallback(
    async (sessionId: string) => {
      try {
        setState((prev) => ({
          ...prev,
          sessionId,
          connectionState: 'connecting',
          error: null,
        }));

        // Get session details
        const details = await viewerApi.getConnectionDetails(sessionId);
        setState((prev) => ({
          ...prev,
          sessionDetails: details,
        }));

        // Get connection token
        const token = await viewerApi.getSessionToken(sessionId);
        sessionTokenRef.current = token;

        // Initialize Kasm client
        kasmClient.initialize({
          apiUrl: token.apiUrl,
          sessionToken: token.token,
          userId: details.userId,
        });

        // Set up event handlers
        kasmClient.setEventHandlers({
          onConnected: handleConnected,
          onDisconnected: handleDisconnected,
          onError: handleError,
          onReconnecting: handleReconnecting,
          onQualityChange: handleQualityChange,
        });

        // Connect
        const connectionOptions: KasmConnectionOptions = {
          quality: state.quality,
          audioEnabled: true,
          microphoneEnabled: false,
        };

        await kasmClient.connect(connectionOptions);

        // Start session expiry warning timer
        startSessionWarningTimer(token.expiresAt);

        // Start idle tracking
        startIdleTracking();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect';
        setState((prev) => ({
          ...prev,
          connectionState: 'error',
          error: message,
        }));
        throw error;
      }
    },
    [
      state.quality,
      handleConnected,
      handleDisconnected,
      handleError,
      handleReconnecting,
      handleQualityChange,
    ]
  );

  const disconnect = useCallback(() => {
    kasmClient.disconnect();
    stopIdleTracking();
    stopSessionWarningTimer();

    setState((prev) => ({
      ...prev,
      connectionState: 'disconnected',
      isActive: false,
    }));
  }, []);

  const reconnect = useCallback(async () => {
    if (!state.sessionId) return;

    if (state.reconnectAttempt >= maxReconnectAttempts) {
      handleError(new Error('Maximum reconnection attempts reached'));
      return;
    }

    await kasmClient.reconnect();
  }, [state.sessionId, state.reconnectAttempt, maxReconnectAttempts, handleError]);

  const setQuality = useCallback((quality: QualityLevel) => {
    kasmClient.setQuality(quality);
    setState((prev) => ({
      ...prev,
      quality,
    }));
  }, []);

  const extendSession = useCallback(async () => {
    if (!state.sessionId) return;

    try {
      await viewerApi.extendSession(state.sessionId);
      toast({
        title: 'Session Extended',
        description: 'Your session has been extended',
      });

      // Reset warning timer
      if (sessionTokenRef.current) {
        startSessionWarningTimer(new Date(Date.now() + 60 * 60 * 1000)); // Extend by 1 hour
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
      toast({
        title: 'Failed to Extend',
        description: 'Could not extend session. Please save your work.',
        variant: 'destructive',
      });
    }
  }, [state.sessionId, toast]);

  const reportActivity = useCallback(
    async (event: string, data?: Record<string, unknown>) => {
      if (!state.sessionId) return;

      lastActivityRef.current = new Date();

      try {
        await viewerApi.reportActivity(state.sessionId, {
          event,
          timestamp: new Date().toISOString(),
          ...data,
        });
      } catch (error) {
        console.error('Failed to report activity:', error);
      }
    },
    [state.sessionId]
  );

  // ============================================================================
  // IDLE TRACKING
  // ============================================================================

  const startIdleTracking = useCallback(() => {
    stopIdleTracking();

    idleTimerRef.current = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current.getTime();

      if (idleTime >= idleTimeoutMs) {
        toast({
          title: 'Session Idle',
          description: 'Your session will disconnect due to inactivity',
          variant: 'destructive',
        });

        // Give user 60 seconds to respond
        setTimeout(() => {
          const stillIdle = Date.now() - lastActivityRef.current.getTime() >= idleTimeoutMs;
          if (stillIdle) {
            disconnect();
          }
        }, 60000);
      }
    }, 60000); // Check every minute
  }, [idleTimeoutMs, toast, disconnect]);

  const stopIdleTracking = useCallback(() => {
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // ============================================================================
  // SESSION WARNING
  // ============================================================================

  const startSessionWarningTimer = useCallback(
    (expiresAt: Date) => {
      stopSessionWarningTimer();

      const msUntilWarning = expiresAt.getTime() - Date.now() - SESSION_WARNING_THRESHOLD * 1000;

      if (msUntilWarning > 0) {
        sessionWarningTimerRef.current = setTimeout(() => {
          onSessionExpiring?.(SESSION_WARNING_THRESHOLD);
          toast({
            title: 'Session Expiring',
            description: `Your session will expire in ${SESSION_WARNING_THRESHOLD / 60} minutes. Extend to continue.`,
          });
        }, msUntilWarning);
      }
    },
    [onSessionExpiring, toast]
  );

  const stopSessionWarningTimer = useCallback(() => {
    if (sessionWarningTimerRef.current) {
      clearTimeout(sessionWarningTimerRef.current);
      sessionWarningTimerRef.current = null;
    }
  }, []);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      disconnect();
      stopIdleTracking();
      stopSessionWarningTimer();
    };
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  const actions: VdiSessionActions = {
    connect,
    disconnect,
    reconnect,
    setQuality,
    extendSession,
    reportActivity,
  };

  return [state, actions];
}
