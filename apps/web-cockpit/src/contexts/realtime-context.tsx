'use client';

/**
 * @module @skillancer/web-cockpit/contexts/realtime-context
 * Real-time Context Provider
 *
 * Provides WebSocket connection state and methods to entire app
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

import {
  getWebSocketClient,
  type ConnectionState,
  type WidgetUpdatePayload,
  type IntegrationStatusPayload,
  type SyncCompletePayload,
  type ErrorPayload,
} from '@/lib/realtime/websocket-client';

import type React from 'react';

export interface RealtimeContextValue {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  isReconnecting: boolean;

  // Connection methods
  connect: (token: string, workspaceId?: string) => void;
  disconnect: () => void;

  // Subscription methods
  subscribeToWorkspace: (workspaceId: string) => void;
  subscribeToWidget: (workspaceId: string, widgetId: string) => void;
  subscribeToIntegration: (workspaceId: string, integrationId: string) => void;
  unsubscribe: (channel: string) => void;

  // Last updates
  lastWidgetUpdate: WidgetUpdatePayload | null;
  lastIntegrationStatus: IntegrationStatusPayload | null;
  lastSyncComplete: SyncCompletePayload | null;
  lastError: ErrorPayload | null;

  // Update timestamps per widget
  widgetUpdateTimes: Record<string, number>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export interface RealtimeProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
  token?: string;
  workspaceId?: string;
}

export function RealtimeProvider({
  children,
  autoConnect = false,
  token,
  workspaceId,
}: RealtimeProviderProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastWidgetUpdate, setLastWidgetUpdate] = useState<WidgetUpdatePayload | null>(null);
  const [lastIntegrationStatus, setLastIntegrationStatus] =
    useState<IntegrationStatusPayload | null>(null);
  const [lastSyncComplete, setLastSyncComplete] = useState<SyncCompletePayload | null>(null);
  const [lastError, setLastError] = useState<ErrorPayload | null>(null);
  const [widgetUpdateTimes, setWidgetUpdateTimes] = useState<Record<string, number>>({});

  const clientRef = useRef(getWebSocketClient());

  // Setup event listeners
  useEffect(() => {
    const client = clientRef.current;

    const unsubState = client.onStateChange(setConnectionState);

    const unsubWidget = client.onWidgetUpdate((payload) => {
      setLastWidgetUpdate(payload);
      setWidgetUpdateTimes((prev) => ({
        ...prev,
        [payload.widgetId]: Date.now(),
      }));
    });

    const unsubStatus = client.onIntegrationStatus(setLastIntegrationStatus);
    const unsubSync = client.onSyncComplete(setLastSyncComplete);
    const unsubError = client.onError(setLastError);

    return () => {
      unsubState();
      unsubWidget();
      unsubStatus();
      unsubSync();
      unsubError();
    };
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && token) {
      clientRef.current.connect(token, workspaceId);
    }

    return () => {
      if (autoConnect) {
        clientRef.current.disconnect();
      }
    };
  }, [autoConnect, token, workspaceId]);

  const connect = useCallback((authToken: string, wsId?: string) => {
    clientRef.current.connect(authToken, wsId);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current.disconnect();
  }, []);

  const subscribeToWorkspace = useCallback((wsId: string) => {
    clientRef.current.subscribeToWorkspace(wsId);
  }, []);

  const subscribeToWidget = useCallback((wsId: string, widgetId: string) => {
    clientRef.current.subscribeToWidget(wsId, widgetId);
  }, []);

  const subscribeToIntegration = useCallback((wsId: string, integrationId: string) => {
    clientRef.current.subscribeToIntegration(wsId, integrationId);
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    clientRef.current.unsubscribe(channel);
  }, []);

  const value: RealtimeContextValue = {
    connectionState,
    isConnected: connectionState === 'connected',
    isReconnecting: connectionState === 'reconnecting',
    connect,
    disconnect,
    subscribeToWorkspace,
    subscribeToWidget,
    subscribeToIntegration,
    unsubscribe,
    lastWidgetUpdate,
    lastIntegrationStatus,
    lastSyncComplete,
    lastError,
    widgetUpdateTimes,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Hook to access realtime context
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

/**
 * Hook for widget-specific realtime updates
 */
export function useWidgetRealtime(widgetId: string) {
  const { lastWidgetUpdate, widgetUpdateTimes, subscribeToWidget, isConnected } = useRealtime();

  const [data, setData] = useState<unknown>(null);
  const lastUpdateTime = widgetUpdateTimes[widgetId] || null;

  useEffect(() => {
    if (lastWidgetUpdate?.widgetId === widgetId) {
      setData(lastWidgetUpdate.data);
    }
  }, [lastWidgetUpdate, widgetId]);

  return {
    data,
    lastUpdateTime,
    isConnected,
    subscribe: (workspaceId: string) => subscribeToWidget(workspaceId, widgetId),
  };
}

/**
 * Hook for integration status
 */
export function useIntegrationRealtime(integrationId: string) {
  const { lastIntegrationStatus, lastSyncComplete, subscribeToIntegration, isConnected } =
    useRealtime();

  const [status, setStatus] = useState<IntegrationStatusPayload['status'] | null>(null);
  const [lastSync, setLastSync] = useState<SyncCompletePayload | null>(null);

  useEffect(() => {
    if (lastIntegrationStatus?.integrationId === integrationId) {
      setStatus(lastIntegrationStatus.status);
    }
  }, [lastIntegrationStatus, integrationId]);

  useEffect(() => {
    if (lastSyncComplete?.integrationId === integrationId) {
      setLastSync(lastSyncComplete);
    }
  }, [lastSyncComplete, integrationId]);

  return {
    status,
    lastSync,
    isConnected,
    subscribe: (workspaceId: string) => subscribeToIntegration(workspaceId, integrationId),
  };
}

/**
 * Connection quality indicator hook
 */
export function useConnectionQuality() {
  const { connectionState, isReconnecting } = useRealtime();

  const quality = (() => {
    switch (connectionState) {
      case 'connected':
        return 'good';
      case 'reconnecting':
        return 'degraded';
      case 'error':
        return 'error';
      default:
        return 'unknown';
    }
  })();

  return {
    quality,
    isConnected: connectionState === 'connected',
    isReconnecting,
    state: connectionState,
  };
}

export default RealtimeProvider;
