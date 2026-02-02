/**
 * Clients Service
 *
 * Type-safe API methods for client management using the shared API client.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type ClientStatus = 'active' | 'inactive' | 'prospect' | 'archived';

export interface ClientContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
}

export interface ClientAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface Client {
  id: string;
  name: string;
  displayName?: string;
  email: string;
  phone?: string;
  website?: string;
  status: ClientStatus;
  industry?: string;
  companySize?: string;
  taxId?: string;
  defaultCurrency: string;
  defaultHourlyRate?: number;
  paymentTermsDays: number;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  contacts: ClientContact[];
  notes?: string;
  tags: string[];
  logoUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCreate {
  name: string;
  displayName?: string;
  email: string;
  phone?: string;
  website?: string;
  status?: ClientStatus;
  industry?: string;
  companySize?: string;
  taxId?: string;
  defaultCurrency?: string;
  defaultHourlyRate?: number;
  paymentTermsDays?: number;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  contacts?: Omit<ClientContact, 'id'>[];
  notes?: string;
  tags?: string[];
}

export interface ClientUpdate {
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  website?: string;
  status?: ClientStatus;
  industry?: string;
  companySize?: string;
  taxId?: string;
  defaultCurrency?: string;
  defaultHourlyRate?: number;
  paymentTermsDays?: number;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  notes?: string;
  tags?: string[];
}

export interface ClientFilters {
  page?: number;
  limit?: number;
  status?: ClientStatus | ClientStatus[];
  industry?: string;
  search?: string;
  tags?: string[];
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ClientStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalRevenue: number;
  outstandingAmount: number;
  totalHours: number;
  averageProjectValue: number;
  invoicesSent: number;
  invoicesPaid: number;
  lastActivityAt?: string;
}

export interface ClientActivity {
  id: string;
  type:
    | 'project_created'
    | 'project_completed'
    | 'invoice_sent'
    | 'invoice_paid'
    | 'payment_received'
    | 'contact_added'
    | 'note_added'
    | 'other';
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ClientSummary {
  totalClients: number;
  activeClients: number;
  newClientsThisMonth: number;
  topClients: Array<{
    id: string;
    name: string;
    revenue: number;
    projectCount: number;
  }>;
  byIndustry: Array<{
    industry: string;
    count: number;
    revenue: number;
  }>;
  byStatus: Record<ClientStatus, number>;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

// =============================================================================
// Clients API Service
// =============================================================================

export const clientsService = {
  // =============================================================================
  // Clients CRUD
  // =============================================================================

  /**
   * List clients with filters
   */
  async list(filters: ClientFilters = {}): Promise<PaginatedResponse<Client>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, tags, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }
    if (tags?.length) {
      params.tags = tags.join(',');
    }

    return client.get<Client[]>('/clients', { params }) as Promise<PaginatedResponse<Client>>;
  },

  /**
   * Get a single client
   */
  async getById(id: string): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.get<Client>(`/clients/${id}`);
  },

  /**
   * Create a client
   */
  async create(data: ClientCreate): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.post<Client, ClientCreate>('/clients', data);
  },

  /**
   * Update a client
   */
  async update(id: string, data: ClientUpdate): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.patch<Client, ClientUpdate>(`/clients/${id}`, data);
  },

  /**
   * Delete a client
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/clients/${id}`);
  },

  /**
   * Archive a client
   */
  async archive(id: string): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.post<Client>(`/clients/${id}/archive`);
  },

  /**
   * Unarchive a client
   */
  async unarchive(id: string): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.post<Client>(`/clients/${id}/unarchive`);
  },

  // =============================================================================
  // Contacts
  // =============================================================================

  /**
   * Add a contact
   */
  async addContact(
    clientId: string,
    data: Omit<ClientContact, 'id'>
  ): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.post<Client>(`/clients/${clientId}/contacts`, data);
  },

  /**
   * Update a contact
   */
  async updateContact(
    clientId: string,
    contactId: string,
    data: Partial<ClientContact>
  ): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.patch<Client>(`/clients/${clientId}/contacts/${contactId}`, data);
  },

  /**
   * Delete a contact
   */
  async deleteContact(clientId: string, contactId: string): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.delete<Client>(`/clients/${clientId}/contacts/${contactId}`);
  },

  /**
   * Set primary contact
   */
  async setPrimaryContact(clientId: string, contactId: string): Promise<ApiResponse<Client>> {
    const client = getApiClient();
    return client.post<Client>(`/clients/${clientId}/contacts/${contactId}/set-primary`);
  },

  // =============================================================================
  // Stats & Activity
  // =============================================================================

  /**
   * Get client stats
   */
  async getStats(id: string): Promise<ApiResponse<ClientStats>> {
    const client = getApiClient();
    return client.get<ClientStats>(`/clients/${id}/stats`);
  },

  /**
   * Get client activity
   */
  async getActivity(
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<ClientActivity>> {
    const client = getApiClient();
    return client.get<ClientActivity[]>(`/clients/${id}/activity`, {
      params,
    }) as Promise<PaginatedResponse<ClientActivity>>;
  },

  /**
   * Add a note
   */
  async addNote(id: string, content: string): Promise<ApiResponse<ClientActivity>> {
    const client = getApiClient();
    return client.post<ClientActivity>(`/clients/${id}/notes`, { content });
  },

  // =============================================================================
  // Documents
  // =============================================================================

  /**
   * List client documents
   */
  async getDocuments(id: string): Promise<ApiResponse<ClientDocument[]>> {
    const client = getApiClient();
    return client.get<ClientDocument[]>(`/clients/${id}/documents`);
  },

  /**
   * Upload a document
   */
  async uploadDocument(id: string, file: File): Promise<ApiResponse<ClientDocument>> {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('file', file);

    const axios = client.getAxiosInstance();
    const response = await axios.post(`/clients/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete a document
   */
  async deleteDocument(clientId: string, documentId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/clients/${clientId}/documents/${documentId}`);
  },

  // =============================================================================
  // Summary
  // =============================================================================

  /**
   * Get clients summary
   */
  async getSummary(): Promise<ApiResponse<ClientSummary>> {
    const client = getApiClient();
    return client.get<ClientSummary>('/clients/summary');
  },

  // =============================================================================
  // Related Data
  // =============================================================================

  /**
   * Get client's projects
   */
  async getProjects(
    id: string
  ): Promise<ApiResponse<Array<{ id: string; name: string; status: string }>>> {
    const client = getApiClient();
    return client.get<Array<{ id: string; name: string; status: string }>>(
      `/clients/${id}/projects`
    );
  },

  /**
   * Get client's invoices
   */
  async getInvoices(
    id: string
  ): Promise<
    ApiResponse<Array<{ id: string; invoiceNumber: string; status: string; total: number }>>
  > {
    const client = getApiClient();
    return client.get<Array<{ id: string; invoiceNumber: string; status: string; total: number }>>(
      `/clients/${id}/invoices`
    );
  },

  // =============================================================================
  // Bulk Operations
  // =============================================================================

  /**
   * Bulk update clients
   */
  async bulkUpdate(
    ids: string[],
    data: Partial<ClientUpdate>
  ): Promise<ApiResponse<{ updated: number }>> {
    const client = getApiClient();
    return client.post<{ updated: number }>('/clients/bulk-update', { ids, data });
  },

  /**
   * Bulk archive clients
   */
  async bulkArchive(ids: string[]): Promise<ApiResponse<{ archived: number }>> {
    const client = getApiClient();
    return client.post<{ archived: number }>('/clients/bulk-archive', { ids });
  },

  /**
   * Export clients
   */
  async export(filters: ClientFilters & { format: 'csv' | 'xlsx' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/clients/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Import clients
   */
  async import(file: File): Promise<ApiResponse<{ imported: number; errors: string[] }>> {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('file', file);

    const axios = client.getAxiosInstance();
    const response = await axios.post('/clients/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default clientsService;
