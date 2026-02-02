/**
 * Disputes Service
 *
 * Type-safe API methods for dispute resolution in the admin panel.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'awaiting_response'
  | 'mediation'
  | 'resolved'
  | 'escalated'
  | 'closed';
export type DisputeType =
  | 'payment'
  | 'delivery'
  | 'quality'
  | 'communication'
  | 'scope'
  | 'refund'
  | 'other';
export type ResolutionType =
  | 'full_refund'
  | 'partial_refund'
  | 'milestone_release'
  | 'no_action'
  | 'mutual_agreement'
  | 'admin_decision';

export interface DisputeParty {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role: 'freelancer' | 'client';
  lastResponseAt?: string;
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  senderId: string;
  senderType: 'user' | 'admin' | 'system';
  content: string;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  isInternal: boolean;
  createdAt: string;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  uploadedBy: string;
  type: 'document' | 'screenshot' | 'communication' | 'contract' | 'other';
  name: string;
  description?: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Resolution {
  id: string;
  disputeId: string;
  type: ResolutionType;
  description: string;
  amount?: number;
  percentage?: number;
  resolvedBy: string;
  acceptedByFreelancer: boolean;
  acceptedByClient: boolean;
  acceptedAt?: string;
  implementedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  caseNumber: string;
  projectId: string;
  projectName: string;
  milestoneId?: string;
  milestoneName?: string;
  type: DisputeType;
  status: DisputeStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  initiatedBy: string;
  freelancer: DisputeParty;
  client: DisputeParty;
  subject: string;
  description: string;
  amount: number;
  currency: string;
  evidence: DisputeEvidence[];
  resolution?: Resolution;
  assignedTo?: string;
  assignedToName?: string;
  escalatedAt?: string;
  escalationReason?: string;
  deadline?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface DisputeFilters {
  page?: number;
  limit?: number;
  type?: DisputeType | DisputeType[];
  status?: DisputeStatus | DisputeStatus[];
  priority?: string | string[];
  assignedTo?: string;
  freelancerId?: string;
  clientId?: string;
  projectId?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  hasResolution?: boolean;
  sortBy?: 'createdAt' | 'priority' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface DisputeStats {
  total: number;
  open: number;
  underReview: number;
  resolved: number;
  escalated: number;
  averageResolutionTime: number;
  byType: Record<DisputeType, number>;
  byResolution: Record<ResolutionType, number>;
  totalDisputedAmount: number;
  totalRefundedAmount: number;
  resolutionRate: number;
}

export interface ResolutionProposal {
  type: ResolutionType;
  description: string;
  amount?: number;
  percentage?: number;
  notifyParties?: boolean;
  deadline?: string;
}

// =============================================================================
// Disputes API Service
// =============================================================================

export const disputesService = {
  // =============================================================================
  // Disputes CRUD
  // =============================================================================

  /**
   * List disputes
   */
  async list(filters: DisputeFilters = {}): Promise<PaginatedResponse<Dispute>> {
    const client = getApiClient();
    const { page = 1, limit = 20, type, status, priority, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (type) {
      params.type = Array.isArray(type) ? type.join(',') : type;
    }
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }
    if (priority) {
      params.priority = Array.isArray(priority) ? priority.join(',') : priority;
    }

    return client.get<Dispute[]>('/admin/disputes', { params }) as Promise<
      PaginatedResponse<Dispute>
    >;
  },

  /**
   * Get a single dispute
   */
  async getById(id: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.get<Dispute>(`/admin/disputes/${id}`);
  },

  /**
   * Get dispute by case number
   */
  async getByCaseNumber(caseNumber: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.get<Dispute>(`/admin/disputes/case/${caseNumber}`);
  },

  /**
   * Update dispute
   */
  async update(
    id: string,
    data: {
      status?: DisputeStatus;
      priority?: string;
      tags?: string[];
      assignedTo?: string;
      deadline?: string;
    }
  ): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.patch<Dispute>(`/admin/disputes/${id}`, data);
  },

  // =============================================================================
  // Dispute Actions
  // =============================================================================

  /**
   * Assign dispute to admin
   */
  async assign(id: string, adminId: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.post<Dispute>(`/admin/disputes/${id}/assign`, { adminId });
  },

  /**
   * Unassign dispute
   */
  async unassign(id: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.post<Dispute>(`/admin/disputes/${id}/unassign`);
  },

  /**
   * Escalate dispute
   */
  async escalate(id: string, reason: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.post<Dispute>(`/admin/disputes/${id}/escalate`, { reason });
  },

  /**
   * Close dispute
   */
  async close(id: string, reason: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.post<Dispute>(`/admin/disputes/${id}/close`, { reason });
  },

  /**
   * Reopen dispute
   */
  async reopen(id: string, reason: string): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.post<Dispute>(`/admin/disputes/${id}/reopen`, { reason });
  },

  /**
   * Request response from party
   */
  async requestResponse(
    id: string,
    party: 'freelancer' | 'client',
    deadline: string
  ): Promise<ApiResponse<Dispute>> {
    const client = getApiClient();
    return client.post<Dispute>(`/admin/disputes/${id}/request-response`, { party, deadline });
  },

  // =============================================================================
  // Messages
  // =============================================================================

  /**
   * Get dispute messages
   */
  async getMessages(
    id: string,
    params?: { page?: number; limit?: number; includeInternal?: boolean }
  ): Promise<PaginatedResponse<DisputeMessage>> {
    const client = getApiClient();
    return client.get<DisputeMessage[]>(`/admin/disputes/${id}/messages`, { params }) as Promise<
      PaginatedResponse<DisputeMessage>
    >;
  },

  /**
   * Send message
   */
  async sendMessage(
    id: string,
    data: { content: string; attachmentIds?: string[]; isInternal?: boolean }
  ): Promise<ApiResponse<DisputeMessage>> {
    const client = getApiClient();
    return client.post<DisputeMessage>(`/admin/disputes/${id}/messages`, data);
  },

  // =============================================================================
  // Evidence
  // =============================================================================

  /**
   * Get dispute evidence
   */
  async getEvidence(id: string): Promise<ApiResponse<DisputeEvidence[]>> {
    const client = getApiClient();
    return client.get<DisputeEvidence[]>(`/admin/disputes/${id}/evidence`);
  },

  /**
   * Upload evidence
   */
  async uploadEvidence(
    id: string,
    file: File,
    data: { type: DisputeEvidence['type']; description?: string }
  ): Promise<ApiResponse<DisputeEvidence>> {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', data.type);
    if (data.description) {
      formData.append('description', data.description);
    }

    const axios = client.getAxiosInstance();
    const response = await axios.post(`/admin/disputes/${id}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete evidence
   */
  async deleteEvidence(disputeId: string, evidenceId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/admin/disputes/${disputeId}/evidence/${evidenceId}`);
  },

  // =============================================================================
  // Resolution
  // =============================================================================

  /**
   * Propose resolution
   */
  async proposeResolution(
    id: string,
    proposal: ResolutionProposal
  ): Promise<ApiResponse<Resolution>> {
    const client = getApiClient();
    return client.post<Resolution, ResolutionProposal>(
      `/admin/disputes/${id}/resolution/propose`,
      proposal
    );
  },

  /**
   * Implement resolution (admin decision)
   */
  async implementResolution(
    id: string,
    proposal: ResolutionProposal
  ): Promise<ApiResponse<Resolution>> {
    const client = getApiClient();
    return client.post<Resolution, ResolutionProposal>(
      `/admin/disputes/${id}/resolution/implement`,
      proposal
    );
  },

  /**
   * Get resolution history
   */
  async getResolutionHistory(id: string): Promise<ApiResponse<Resolution[]>> {
    const client = getApiClient();
    return client.get<Resolution[]>(`/admin/disputes/${id}/resolution/history`);
  },

  // =============================================================================
  // Related Data
  // =============================================================================

  /**
   * Get project details
   */
  async getProjectDetails(disputeId: string): Promise<
    ApiResponse<{
      id: string;
      name: string;
      description: string;
      budget: number;
      milestones: Array<{ id: string; name: string; amount: number; status: string }>;
      payments: Array<{ id: string; amount: number; status: string; date: string }>;
      timeline: Array<{ event: string; date: string }>;
    }>
  > {
    const client = getApiClient();
    return client.get(`/admin/disputes/${disputeId}/project`);
  },

  /**
   * Get communication history
   */
  async getCommunicationHistory(
    disputeId: string,
    params?: { page?: number; limit?: number }
  ): Promise<
    PaginatedResponse<{
      id: string;
      type: 'message' | 'email' | 'call';
      from: string;
      to: string;
      content: string;
      timestamp: string;
    }>
  > {
    const client = getApiClient();
    return client.get(`/admin/disputes/${disputeId}/communications`, { params }) as Promise<
      PaginatedResponse<{
        id: string;
        type: 'message' | 'email' | 'call';
        from: string;
        to: string;
        content: string;
        timestamp: string;
      }>
    >;
  },

  // =============================================================================
  // Statistics
  // =============================================================================

  /**
   * Get dispute statistics
   */
  async getStats(): Promise<ApiResponse<DisputeStats>> {
    const client = getApiClient();
    return client.get<DisputeStats>('/admin/disputes/stats');
  },

  /**
   * Get resolution statistics
   */
  async getResolutionStats(params?: { startDate?: string; endDate?: string }): Promise<
    ApiResponse<{
      totalResolved: number;
      averageTime: number;
      byType: Record<ResolutionType, { count: number; totalAmount: number }>;
      satisfactionRate: number;
      appealRate: number;
    }>
  > {
    const client = getApiClient();
    return client.get('/admin/disputes/stats/resolutions', { params });
  },

  // =============================================================================
  // Export
  // =============================================================================

  /**
   * Export disputes
   */
  async export(filters: DisputeFilters & { format: 'csv' | 'xlsx' | 'pdf' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/disputes/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default disputesService;
