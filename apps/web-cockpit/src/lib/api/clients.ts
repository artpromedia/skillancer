/**
 * Clients API Client
 * Handles all client-related API calls for the cockpit
 */

// Types
export type ClientStatus = 'active' | 'inactive' | 'prospect';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  avatar?: string;
  status: ClientStatus;
  source: 'skillancer' | 'upwork' | 'fiverr' | 'toptal' | 'freelancer' | 'direct';
  externalId?: string;
  contactPerson?: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  billing?: {
    currency: string;
    paymentTerms: number; // days
    preferredPaymentMethod?: string;
    taxId?: string;
  };
  tags: string[];
  notes?: string;
  howWeMet?: string;
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStats {
  totalRevenue: number;
  projectCount: number;
  activeProjects: number;
  avgProjectValue: number;
  lastProjectDate?: string;
  lastContactDate?: string;
  totalHoursLogged: number;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  type:
    | 'note'
    | 'email'
    | 'call'
    | 'meeting'
    | 'project_started'
    | 'project_completed'
    | 'payment_received';
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
}

export interface ClientListParams {
  page?: number;
  limit?: number;
  status?: ClientStatus;
  source?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'lastActivity' | 'revenue';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateClientInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: ClientStatus;
  source?: 'skillancer' | 'upwork' | 'fiverr' | 'toptal' | 'freelancer' | 'direct';
  contactPerson?: Client['contactPerson'];
  address?: Client['address'];
  billing?: Client['billing'];
  tags?: string[];
  notes?: string;
  howWeMet?: string;
  customFields?: Record<string, string>;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {
  id: string;
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

// Clients API
export const clientsApi = {
  /**
   * List clients with filters and pagination
   */
  async list(params: ClientListParams = {}): Promise<ClientListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.source) searchParams.set('source', params.source);
    if (params.search) searchParams.set('search', params.search);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    if (params.tags?.length) searchParams.set('tags', params.tags.join(','));

    const query = searchParams.toString();
    const baseUrl = '/clients';
    const url = query ? `${baseUrl}?${query}` : baseUrl;
    return fetchApi<ClientListResponse>(url);
  },

  /**
   * Get a single client by ID
   */
  async get(id: string): Promise<Client> {
    return fetchApi<Client>(`/clients/${id}`);
  },

  /**
   * Get client statistics
   */
  async getStats(id: string): Promise<ClientStats> {
    return fetchApi<ClientStats>(`/clients/${id}/stats`);
  },

  /**
   * Get client activity log
   */
  async getActivity(
    id: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<{ activities: ClientActivity[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const baseUrl = `/clients/${id}/activity`;
    const url = query ? `${baseUrl}?${query}` : baseUrl;
    return fetchApi(url);
  },

  /**
   * Create a new client
   */
  async create(input: CreateClientInput): Promise<Client> {
    return fetchApi<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing client
   */
  async update(input: UpdateClientInput): Promise<Client> {
    const { id, ...data } = input;
    return fetchApi<Client>(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a client
   */
  async delete(id: string): Promise<void> {
    await fetchApi(`/clients/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Add activity to client
   */
  async addActivity(
    clientId: string,
    activity: Omit<ClientActivity, 'id' | 'clientId' | 'createdAt'>
  ): Promise<ClientActivity> {
    return fetchApi<ClientActivity>(`/clients/${clientId}/activity`, {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  },

  /**
   * Import clients from external platform
   */
  async import(
    source: string,
    options: { syncAll?: boolean; clientIds?: string[] } = {}
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    return fetchApi(`/clients/import/${source}`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  /**
   * Merge duplicate clients
   */
  async merge(primaryId: string, duplicateIds: string[]): Promise<Client> {
    return fetchApi<Client>(`/clients/${primaryId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ duplicateIds }),
    });
  },

  /**
   * Get client health score
   */
  async getHealthScore(id: string): Promise<{
    score: number;
    metrics: Record<string, number>;
    recommendations: string[];
  }> {
    return fetchApi(`/clients/${id}/health`);
  },

  /**
   * Get client referrals
   */
  async getReferrals(id: string): Promise<{
    referrals: Array<{
      id: string;
      referredClientId?: string;
      referredClientName?: string;
      status: string;
      createdAt: string;
    }>;
    total: number;
  }> {
    return fetchApi(`/clients/${id}/referrals`);
  },

  /**
   * Add a referral
   */
  async addReferral(
    referrerId: string,
    data: {
      referredEmail: string;
      referredName?: string;
      notes?: string;
    }
  ): Promise<{ id: string }> {
    return fetchApi(`/clients/${referrerId}/referrals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get follow-up reminders for client
   */
  async getReminders(clientId: string): Promise<{
    reminders: Array<{
      id: string;
      type: string;
      title: string;
      dueDate: string;
      status: string;
    }>;
  }> {
    return fetchApi(`/clients/${clientId}/reminders`);
  },

  /**
   * Add a follow-up reminder
   */
  async addReminder(
    clientId: string,
    reminder: {
      type: string;
      title: string;
      description?: string;
      dueDate: string;
      isRecurring?: boolean;
      recurringInterval?: string;
    }
  ): Promise<{ id: string }> {
    return fetchApi(`/clients/${clientId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(reminder),
    });
  },

  /**
   * Complete a reminder
   */
  async completeReminder(clientId: string, reminderId: string): Promise<void> {
    await fetchApi(`/clients/${clientId}/reminders/${reminderId}/complete`, {
      method: 'POST',
    });
  },

  /**
   * Get all tags used across clients
   */
  async getTags(): Promise<{ tags: string[]; counts: Record<string, number> }> {
    return fetchApi('/clients/tags');
  },

  /**
   * Export clients to CSV
   */
  async export(params: ClientListParams = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.source) searchParams.set('source', params.source);
    if (params.tags?.length) searchParams.set('tags', params.tags.join(','));

    const query = searchParams.toString();
    const baseUrl = `${API_BASE}/clients/export`;
    const url = query ? `${baseUrl}?${query}` : baseUrl;
    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export clients');
    }

    return response.blob();
  },
};

export default clientsApi;
