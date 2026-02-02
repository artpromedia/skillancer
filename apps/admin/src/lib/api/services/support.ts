/**
 * Support Service
 *
 * Type-safe API methods for support ticket management in the admin panel.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'waiting_on_third_party'
  | 'resolved'
  | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
  | 'account'
  | 'billing'
  | 'technical'
  | 'project'
  | 'payment'
  | 'dispute'
  | 'verification'
  | 'other';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  subject: string;
  description: string;
  category: TicketCategory;
  subcategory?: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: 'web' | 'email' | 'chat' | 'phone';
  assignedTo?: string;
  assignedToName?: string;
  team?: string;
  tags: string[];
  relatedEntityType?: 'project' | 'payment' | 'dispute' | 'user';
  relatedEntityId?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  satisfactionRating?: number;
  satisfactionFeedback?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: 'user' | 'agent' | 'system';
  senderName?: string;
  content: string;
  contentType: 'text' | 'html';
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  isInternal: boolean;
  via: 'web' | 'email' | 'chat' | 'api';
  createdAt: string;
}

export interface TicketFilters {
  page?: number;
  limit?: number;
  category?: TicketCategory | TicketCategory[];
  status?: TicketStatus | TicketStatus[];
  priority?: TicketPriority | TicketPriority[];
  assignedTo?: string;
  team?: string;
  userId?: string;
  channel?: string;
  search?: string;
  tags?: string[];
  hasRating?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category?: TicketCategory;
  tags: string[];
  variables: string[];
  usageCount: number;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupportStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  satisfactionScore: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  byCategory: Record<TicketCategory, number>;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    assigned: number;
    resolved: number;
    averageTime: number;
    satisfaction: number;
  }>;
  trends: Array<{
    date: string;
    created: number;
    resolved: number;
  }>;
}

export interface TicketNote {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// =============================================================================
// Support API Service
// =============================================================================

export const supportService = {
  // =============================================================================
  // Tickets
  // =============================================================================

  /**
   * List tickets
   */
  async listTickets(filters: TicketFilters = {}): Promise<PaginatedResponse<SupportTicket>> {
    const client = getApiClient();
    const { page = 1, limit = 20, category, status, priority, tags, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (category) {
      params.category = Array.isArray(category) ? category.join(',') : category;
    }
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }
    if (priority) {
      params.priority = Array.isArray(priority) ? priority.join(',') : priority;
    }
    if (tags?.length) {
      params.tags = tags.join(',');
    }

    return client.get<SupportTicket[]>('/admin/support/tickets', { params }) as Promise<
      PaginatedResponse<SupportTicket>
    >;
  },

  /**
   * Get ticket by ID
   */
  async getTicket(id: string): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.get<SupportTicket>(`/admin/support/tickets/${id}`);
  },

  /**
   * Get ticket by number
   */
  async getByTicketNumber(ticketNumber: string): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.get<SupportTicket>(`/admin/support/tickets/number/${ticketNumber}`);
  },

  /**
   * Create ticket (on behalf of user)
   */
  async createTicket(data: {
    userId: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority?: TicketPriority;
    tags?: string[];
    assignTo?: string;
  }): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>('/admin/support/tickets', data);
  },

  /**
   * Update ticket
   */
  async updateTicket(
    id: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      category?: TicketCategory;
      tags?: string[];
      assignedTo?: string;
      team?: string;
    }
  ): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.patch<SupportTicket>(`/admin/support/tickets/${id}`, data);
  },

  /**
   * Close ticket
   */
  async closeTicket(id: string, resolution?: string): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>(`/admin/support/tickets/${id}/close`, { resolution });
  },

  /**
   * Reopen ticket
   */
  async reopenTicket(id: string, reason?: string): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>(`/admin/support/tickets/${id}/reopen`, { reason });
  },

  /**
   * Merge tickets
   */
  async mergeTickets(targetId: string, sourceIds: string[]): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>(`/admin/support/tickets/${targetId}/merge`, { sourceIds });
  },

  /**
   * Assign ticket
   */
  async assignTicket(id: string, agentId: string): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>(`/admin/support/tickets/${id}/assign`, { agentId });
  },

  /**
   * Unassign ticket
   */
  async unassignTicket(id: string): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>(`/admin/support/tickets/${id}/unassign`);
  },

  /**
   * Escalate ticket
   */
  async escalateTicket(
    id: string,
    reason: string,
    escalateTo?: string
  ): Promise<ApiResponse<SupportTicket>> {
    const client = getApiClient();
    return client.post<SupportTicket>(`/admin/support/tickets/${id}/escalate`, {
      reason,
      escalateTo,
    });
  },

  // =============================================================================
  // Messages
  // =============================================================================

  /**
   * Get ticket messages
   */
  async getMessages(
    ticketId: string,
    params?: { page?: number; limit?: number; includeInternal?: boolean }
  ): Promise<PaginatedResponse<TicketMessage>> {
    const client = getApiClient();
    return client.get<TicketMessage[]>(`/admin/support/tickets/${ticketId}/messages`, {
      params,
    }) as Promise<PaginatedResponse<TicketMessage>>;
  },

  /**
   * Send message
   */
  async sendMessage(
    ticketId: string,
    data: {
      content: string;
      contentType?: 'text' | 'html';
      attachmentIds?: string[];
      isInternal?: boolean;
    }
  ): Promise<ApiResponse<TicketMessage>> {
    const client = getApiClient();
    return client.post<TicketMessage>(`/admin/support/tickets/${ticketId}/messages`, data);
  },

  /**
   * Upload attachment
   */
  async uploadAttachment(
    ticketId: string,
    file: File
  ): Promise<
    ApiResponse<{
      id: string;
      name: string;
      url: string;
      type: string;
      size: number;
    }>
  > {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('file', file);

    const axios = client.getAxiosInstance();
    const response = await axios.post(`/admin/support/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // =============================================================================
  // Notes (Internal)
  // =============================================================================

  /**
   * Get ticket notes
   */
  async getNotes(ticketId: string): Promise<ApiResponse<TicketNote[]>> {
    const client = getApiClient();
    return client.get<TicketNote[]>(`/admin/support/tickets/${ticketId}/notes`);
  },

  /**
   * Add note
   */
  async addNote(ticketId: string, content: string): Promise<ApiResponse<TicketNote>> {
    const client = getApiClient();
    return client.post<TicketNote>(`/admin/support/tickets/${ticketId}/notes`, { content });
  },

  /**
   * Delete note
   */
  async deleteNote(ticketId: string, noteId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/admin/support/tickets/${ticketId}/notes/${noteId}`);
  },

  // =============================================================================
  // Canned Responses
  // =============================================================================

  /**
   * List canned responses
   */
  async getCannedResponses(params?: {
    category?: TicketCategory;
    search?: string;
  }): Promise<ApiResponse<CannedResponse[]>> {
    const client = getApiClient();
    return client.get<CannedResponse[]>('/admin/support/canned-responses', { params });
  },

  /**
   * Create canned response
   */
  async createCannedResponse(
    data: Omit<CannedResponse, 'id' | 'usageCount' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<CannedResponse>> {
    const client = getApiClient();
    return client.post<CannedResponse>('/admin/support/canned-responses', data);
  },

  /**
   * Update canned response
   */
  async updateCannedResponse(
    id: string,
    data: Partial<CannedResponse>
  ): Promise<ApiResponse<CannedResponse>> {
    const client = getApiClient();
    return client.patch<CannedResponse>(`/admin/support/canned-responses/${id}`, data);
  },

  /**
   * Delete canned response
   */
  async deleteCannedResponse(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/admin/support/canned-responses/${id}`);
  },

  /**
   * Use canned response (increments usage count)
   */
  async useCannedResponse(
    id: string,
    ticketId: string,
    variables?: Record<string, string>
  ): Promise<ApiResponse<{ content: string }>> {
    const client = getApiClient();
    return client.post<{ content: string }>(`/admin/support/canned-responses/${id}/use`, {
      ticketId,
      variables,
    });
  },

  // =============================================================================
  // Statistics
  // =============================================================================

  /**
   * Get support statistics
   */
  async getStats(params?: {
    startDate?: string;
    endDate?: string;
    team?: string;
  }): Promise<ApiResponse<SupportStats>> {
    const client = getApiClient();
    return client.get<SupportStats>('/admin/support/stats', { params });
  },

  /**
   * Get agent performance
   */
  async getAgentPerformance(
    agentId: string,
    params?: { startDate?: string; endDate?: string }
  ): Promise<
    ApiResponse<{
      ticketsAssigned: number;
      ticketsResolved: number;
      averageResponseTime: number;
      averageResolutionTime: number;
      satisfactionScore: number;
      byCategory: Record<TicketCategory, number>;
      byPriority: Record<TicketPriority, number>;
      daily: Array<{
        date: string;
        assigned: number;
        resolved: number;
        responseTime: number;
      }>;
    }>
  > {
    const client = getApiClient();
    return client.get(`/admin/support/agents/${agentId}/performance`, { params });
  },

  // =============================================================================
  // Bulk Operations
  // =============================================================================

  /**
   * Bulk assign tickets
   */
  async bulkAssign(
    ticketIds: string[],
    agentId: string
  ): Promise<ApiResponse<{ assigned: number }>> {
    const client = getApiClient();
    return client.post<{ assigned: number }>('/admin/support/tickets/bulk-assign', {
      ticketIds,
      agentId,
    });
  },

  /**
   * Bulk close tickets
   */
  async bulkClose(
    ticketIds: string[],
    resolution?: string
  ): Promise<ApiResponse<{ closed: number }>> {
    const client = getApiClient();
    return client.post<{ closed: number }>('/admin/support/tickets/bulk-close', {
      ticketIds,
      resolution,
    });
  },

  /**
   * Bulk update priority
   */
  async bulkUpdatePriority(
    ticketIds: string[],
    priority: TicketPriority
  ): Promise<ApiResponse<{ updated: number }>> {
    const client = getApiClient();
    return client.post<{ updated: number }>('/admin/support/tickets/bulk-priority', {
      ticketIds,
      priority,
    });
  },

  // =============================================================================
  // Export
  // =============================================================================

  /**
   * Export tickets
   */
  async exportTickets(filters: TicketFilters & { format: 'csv' | 'xlsx' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/support/tickets/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default supportService;
