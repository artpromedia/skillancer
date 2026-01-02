'use client';

/**
 * Workspace Data Store
 * Centralized data store for workspace to prevent duplicate API calls
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface IntegrationData {
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: Date;
  error?: string;
  entities: Record<string, unknown>;
  widgetData: Record<string, WidgetCacheEntry>;
}

export interface WidgetCacheEntry {
  data: unknown;
  fetchedAt: Date;
  expiresAt: Date;
  isStale: boolean;
}

export interface WorkspaceDataState {
  workspaceId: string | null;
  integrations: Record<string, IntegrationData>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;

  // Actions
  setWorkspace: (workspaceId: string) => void;
  setIntegrationStatus: (integrationId: string, status: IntegrationData['status']) => void;
  setIntegrationError: (integrationId: string, error: string) => void;
  setWidgetData: (integrationId: string, widgetId: string, data: unknown, ttl?: number) => void;
  getWidgetData: (integrationId: string, widgetId: string) => WidgetCacheEntry | null;
  invalidateWidget: (integrationId: string, widgetId: string) => void;
  invalidateIntegration: (integrationId: string) => void;
  setLoading: (key: string, loading: boolean) => void;
  reset: () => void;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const useWorkspaceDataStore = create<WorkspaceDataState>()(
  subscribeWithSelector((set, get) => ({
    workspaceId: null,
    integrations: {},
    loading: {},
    errors: {},

    setWorkspace: (workspaceId) => {
      set({ workspaceId, integrations: {}, loading: {}, errors: {} });
    },

    setIntegrationStatus: (integrationId, status) => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          [integrationId]: {
            ...state.integrations[integrationId],
            status,
            lastSync:
              status === 'connected' ? new Date() : state.integrations[integrationId]?.lastSync,
            entities: state.integrations[integrationId]?.entities || {},
            widgetData: state.integrations[integrationId]?.widgetData || {},
          },
        },
      }));
    },

    setIntegrationError: (integrationId, error) => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          [integrationId]: {
            ...state.integrations[integrationId],
            status: 'error',
            error,
            entities: state.integrations[integrationId]?.entities || {},
            widgetData: state.integrations[integrationId]?.widgetData || {},
          },
        },
      }));
    },

    setWidgetData: (integrationId, widgetId, data, ttl = DEFAULT_TTL) => {
      const now = new Date();
      set((state) => ({
        integrations: {
          ...state.integrations,
          [integrationId]: {
            ...state.integrations[integrationId],
            status: state.integrations[integrationId]?.status || 'connected',
            entities: state.integrations[integrationId]?.entities || {},
            widgetData: {
              ...state.integrations[integrationId]?.widgetData,
              [widgetId]: {
                data,
                fetchedAt: now,
                expiresAt: new Date(now.getTime() + ttl),
                isStale: false,
              },
            },
          },
        },
      }));
    },

    getWidgetData: (integrationId, widgetId) => {
      const state = get();
      const cache = state.integrations[integrationId]?.widgetData[widgetId];
      if (!cache) return null;

      const now = new Date();
      if (now > cache.expiresAt) {
        return { ...cache, isStale: true };
      }
      return cache;
    },

    invalidateWidget: (integrationId, widgetId) => {
      set((state) => {
        const integration = state.integrations[integrationId];
        if (!integration) return state;

        const { [widgetId]: _, ...rest } = integration.widgetData;
        return {
          integrations: {
            ...state.integrations,
            [integrationId]: { ...integration, widgetData: rest },
          },
        };
      });
    },

    invalidateIntegration: (integrationId) => {
      set((state) => {
        const integration = state.integrations[integrationId];
        if (!integration) return state;

        return {
          integrations: {
            ...state.integrations,
            [integrationId]: { ...integration, widgetData: {}, entities: {} },
          },
        };
      });
    },

    setLoading: (key, loading) => {
      set((state) => ({ loading: { ...state.loading, [key]: loading } }));
    },

    reset: () => {
      set({ workspaceId: null, integrations: {}, loading: {}, errors: {} });
    },
  }))
);

export default useWorkspaceDataStore;
