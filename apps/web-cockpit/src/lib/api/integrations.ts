/**
 * Integrations API Client
 * Handles all platform integration-related API calls for the cockpit
 */

// Types
export interface Platform {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  category: 'marketplace' | 'crm' | 'invoicing' | 'communication';
  features: string[];
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: string;
  connectedAt?: string;
  stats?: {
    clientsImported: number;
    projectsImported: number;
    lastActivity?: string;
  };
  config?: {
    autoSync: boolean;
    syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    syncClients: boolean;
    syncProjects: boolean;
    syncEarnings: boolean;
    syncMessages: boolean;
    conflictResolution: 'local' | 'remote' | 'ask';
  };
}

export interface SyncLog {
  id: string;
  platformId: string;
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string;
  itemsSynced: {
    clients: number;
    projects: number;
    earnings: number;
  };
  errors?: string[];
}

export interface OAuthState {
  state: string;
  redirectUrl: string;
  expiresAt: string;
}

export interface ConnectResult {
  success: boolean;
  platform: Platform;
  importSummary?: {
    clients: number;
    projects: number;
    earnings: number;
  };
  errors?: string[];
}

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// Helper for API calls
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Integrations API
export const integrationsApi = {
  /**
   * List all available platforms
   */
  async listPlatforms(): Promise<{ platforms: Platform[] }> {
    return fetchApi('/integrations/platforms');
  },

  /**
   * Get a specific platform
   */
  async getPlatform(slug: string): Promise<Platform> {
    return fetchApi<Platform>(`/integrations/platforms/${slug}`);
  },

  /**
   * Get connected platforms only
   */
  async getConnected(): Promise<{ platforms: Platform[] }> {
    return fetchApi('/integrations/connected');
  },

  /**
   * Initiate OAuth connection flow
   */
  async initiateConnect(
    platformSlug: string,
    options: { redirectUrl?: string; scopes?: string[] } = {}
  ): Promise<OAuthState> {
    return fetchApi<OAuthState>(`/integrations/${platformSlug}/connect`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  /**
   * Complete OAuth callback
   */
  async completeConnect(
    platformSlug: string,
    params: { code: string; state: string }
  ): Promise<ConnectResult> {
    return fetchApi<ConnectResult>(`/integrations/${platformSlug}/callback`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Disconnect a platform
   */
  async disconnect(platformSlug: string): Promise<void> {
    await fetchApi(`/integrations/${platformSlug}/disconnect`, {
      method: 'POST',
    });
  },

  /**
   * Trigger manual sync
   */
  async sync(
    platformSlug: string,
    options: {
      syncClients?: boolean;
      syncProjects?: boolean;
      syncEarnings?: boolean;
    } = {}
  ): Promise<{
    syncId: string;
    status: 'started' | 'queued';
  }> {
    return fetchApi(`/integrations/${platformSlug}/sync`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  /**
   * Get sync status
   */
  async getSyncStatus(
    platformSlug: string,
    syncId: string
  ): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    itemsSynced?: {
      clients: number;
      projects: number;
      earnings: number;
    };
    errors?: string[];
  }> {
    return fetchApi(`/integrations/${platformSlug}/sync/${syncId}`);
  },

  /**
   * Get sync history
   */
  async getSyncHistory(
    platformSlug: string,
    params: { limit?: number } = {}
  ): Promise<{ logs: SyncLog[] }> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const baseUrl = `/integrations/${platformSlug}/history`;
    const url = query ? `${baseUrl}?${query}` : baseUrl;
    return fetchApi(url);
  },

  /**
   * Update platform settings
   */
  async updateSettings(
    platformSlug: string,
    settings: Partial<Platform['config']>
  ): Promise<Platform> {
    return fetchApi<Platform>(`/integrations/${platformSlug}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Test platform connection
   */
  async testConnection(platformSlug: string): Promise<{
    success: boolean;
    latency: number;
    message?: string;
  }> {
    return fetchApi(`/integrations/${platformSlug}/test`);
  },

  /**
   * Re-authorize platform (refresh tokens)
   */
  async reauthorize(platformSlug: string): Promise<OAuthState> {
    return fetchApi<OAuthState>(`/integrations/${platformSlug}/reauthorize`, {
      method: 'POST',
    });
  },

  /**
   * Get platform-specific data mappings
   */
  async getMappings(platformSlug: string): Promise<{
    clientFields: Array<{
      source: string;
      target: string;
      transform?: string;
    }>;
    projectFields: Array<{
      source: string;
      target: string;
      transform?: string;
    }>;
  }> {
    return fetchApi(`/integrations/${platformSlug}/mappings`);
  },

  /**
   * Update field mappings
   */
  async updateMappings(
    platformSlug: string,
    mappings: {
      clientFields?: Array<{ source: string; target: string }>;
      projectFields?: Array<{ source: string; target: string }>;
    }
  ): Promise<void> {
    await fetchApi(`/integrations/${platformSlug}/mappings`, {
      method: 'PUT',
      body: JSON.stringify(mappings),
    });
  },

  /**
   * Get webhook configuration
   */
  async getWebhooks(platformSlug: string): Promise<{
    enabled: boolean;
    url: string;
    events: string[];
    secret?: string;
  }> {
    return fetchApi(`/integrations/${platformSlug}/webhooks`);
  },

  /**
   * Configure webhooks
   */
  async configureWebhooks(
    platformSlug: string,
    config: {
      enabled: boolean;
      events?: string[];
    }
  ): Promise<{
    url: string;
    secret: string;
  }> {
    return fetchApi(`/integrations/${platformSlug}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get import preview (dry run)
   */
  async previewImport(platformSlug: string): Promise<{
    clients: Array<{
      externalId: string;
      name: string;
      email?: string;
      exists: boolean;
      conflict?: boolean;
    }>;
    projects: Array<{
      externalId: string;
      name: string;
      clientName?: string;
      exists: boolean;
      conflict?: boolean;
    }>;
  }> {
    return fetchApi(`/integrations/${platformSlug}/preview`);
  },

  /**
   * Resolve import conflicts
   */
  async resolveConflicts(
    platformSlug: string,
    resolutions: Array<{
      type: 'client' | 'project';
      externalId: string;
      action: 'skip' | 'merge' | 'create_new' | 'overwrite';
      targetId?: string; // for merge
    }>
  ): Promise<void> {
    await fetchApi(`/integrations/${platformSlug}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutions }),
    });
  },

  /**
   * Get integration stats summary
   */
  async getStats(): Promise<{
    totalConnected: number;
    totalClients: number;
    totalProjects: number;
    lastSyncAt?: string;
    platformBreakdown: Array<{
      slug: string;
      name: string;
      clients: number;
      projects: number;
    }>;
  }> {
    return fetchApi('/integrations/stats');
  },

  /**
   * Request new integration
   */
  async requestIntegration(data: {
    platformName: string;
    platformUrl?: string;
    useCase?: string;
    email?: string;
  }): Promise<{ success: boolean }> {
    return fetchApi('/integrations/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export default integrationsApi;
