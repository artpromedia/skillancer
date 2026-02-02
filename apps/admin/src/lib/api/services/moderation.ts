/**
 * Moderation Service
 *
 * Type-safe API methods for content moderation in the admin panel.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type ModerationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged'
  | 'escalated'
  | 'auto_removed';
export type ContentType =
  | 'profile'
  | 'project'
  | 'proposal'
  | 'message'
  | 'review'
  | 'portfolio'
  | 'comment'
  | 'file';
export type ModerationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ModerationItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  status: ModerationStatus;
  priority: ModerationPriority;
  content: {
    title?: string;
    body?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  };
  flags: Array<{
    reason: string;
    reportedBy?: string;
    reportedAt: string;
  }>;
  autoModeration?: {
    score: number;
    reasons: string[];
    model: string;
    processedAt: string;
  };
  assignedTo?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  moderationNotes?: string;
  appealStatus?: 'none' | 'pending' | 'approved' | 'denied';
  appealReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationFilters {
  page?: number;
  limit?: number;
  contentType?: ContentType | ContentType[];
  status?: ModerationStatus | ModerationStatus[];
  priority?: ModerationPriority | ModerationPriority[];
  userId?: string;
  assignedTo?: string;
  hasAppeal?: boolean;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: 'createdAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ModerationAction {
  action: 'approve' | 'reject' | 'flag' | 'escalate' | 'remove';
  reason?: string;
  notes?: string;
  notifyUser?: boolean;
  applyPenalty?: boolean;
  penaltyType?: 'warning' | 'mute' | 'suspend' | 'ban';
  penaltyDuration?: number;
}

export interface ModerationRule {
  id: string;
  name: string;
  description: string;
  contentTypes: ContentType[];
  conditions: Array<{
    field: string;
    operator: 'contains' | 'matches' | 'equals' | 'gt' | 'lt';
    value: string | number;
  }>;
  action: 'flag' | 'auto_remove' | 'escalate';
  priority: ModerationPriority;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationStats {
  pending: number;
  approved: number;
  rejected: number;
  escalated: number;
  autoRemoved: number;
  byContentType: Record<ContentType, number>;
  byPriority: Record<ModerationPriority, number>;
  averageProcessingTime: number;
  processedToday: number;
  processedThisWeek: number;
  topReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface ModerationQueue {
  id: string;
  name: string;
  contentTypes: ContentType[];
  assignedModerators: string[];
  pendingCount: number;
  averageWaitTime: number;
  isActive: boolean;
}

// =============================================================================
// Moderation API Service
// =============================================================================

export const moderationService = {
  // =============================================================================
  // Moderation Items
  // =============================================================================

  /**
   * List moderation items
   */
  async list(filters: ModerationFilters = {}): Promise<PaginatedResponse<ModerationItem>> {
    const client = getApiClient();
    const { page = 1, limit = 20, contentType, status, priority, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (contentType) {
      params.contentType = Array.isArray(contentType) ? contentType.join(',') : contentType;
    }
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }
    if (priority) {
      params.priority = Array.isArray(priority) ? priority.join(',') : priority;
    }

    return client.get<ModerationItem[]>('/admin/moderation', { params }) as Promise<
      PaginatedResponse<ModerationItem>
    >;
  },

  /**
   * Get a single moderation item
   */
  async getById(id: string): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.get<ModerationItem>(`/admin/moderation/${id}`);
  },

  /**
   * Get next item in queue
   */
  async getNextInQueue(queueId?: string): Promise<ApiResponse<ModerationItem | null>> {
    const client = getApiClient();
    return client.get<ModerationItem | null>('/admin/moderation/next', {
      params: queueId ? { queueId } : undefined,
    });
  },

  // =============================================================================
  // Moderation Actions
  // =============================================================================

  /**
   * Take action on a moderation item
   */
  async takeAction(id: string, action: ModerationAction): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.post<ModerationItem, ModerationAction>(`/admin/moderation/${id}/action`, action);
  },

  /**
   * Approve content
   */
  async approve(id: string, notes?: string): Promise<ApiResponse<ModerationItem>> {
    return moderationService.takeAction(id, { action: 'approve', notes });
  },

  /**
   * Reject content
   */
  async reject(
    id: string,
    reason: string,
    notifyUser?: boolean
  ): Promise<ApiResponse<ModerationItem>> {
    return moderationService.takeAction(id, { action: 'reject', reason, notifyUser });
  },

  /**
   * Flag content for review
   */
  async flag(
    id: string,
    reason: string,
    priority?: ModerationPriority
  ): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.post<ModerationItem>(`/admin/moderation/${id}/flag`, { reason, priority });
  },

  /**
   * Escalate to senior moderator
   */
  async escalate(id: string, reason: string): Promise<ApiResponse<ModerationItem>> {
    return moderationService.takeAction(id, { action: 'escalate', reason });
  },

  /**
   * Remove content
   */
  async remove(
    id: string,
    reason: string,
    options?: {
      notifyUser?: boolean;
      applyPenalty?: boolean;
      penaltyType?: string;
      penaltyDuration?: number;
    }
  ): Promise<ApiResponse<ModerationItem>> {
    return moderationService.takeAction(id, {
      action: 'remove',
      reason,
      ...options,
    });
  },

  /**
   * Assign to moderator
   */
  async assign(id: string, moderatorId: string): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.post<ModerationItem>(`/admin/moderation/${id}/assign`, { moderatorId });
  },

  /**
   * Unassign from moderator
   */
  async unassign(id: string): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.post<ModerationItem>(`/admin/moderation/${id}/unassign`);
  },

  // =============================================================================
  // Appeals
  // =============================================================================

  /**
   * Get appeals
   */
  async getAppeals(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'denied';
  }): Promise<PaginatedResponse<ModerationItem>> {
    const client = getApiClient();
    return client.get<ModerationItem[]>('/admin/moderation/appeals', { params }) as Promise<
      PaginatedResponse<ModerationItem>
    >;
  },

  /**
   * Approve appeal
   */
  async approveAppeal(id: string, notes?: string): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.post<ModerationItem>(`/admin/moderation/${id}/appeal/approve`, { notes });
  },

  /**
   * Deny appeal
   */
  async denyAppeal(id: string, reason: string): Promise<ApiResponse<ModerationItem>> {
    const client = getApiClient();
    return client.post<ModerationItem>(`/admin/moderation/${id}/appeal/deny`, { reason });
  },

  // =============================================================================
  // Rules
  // =============================================================================

  /**
   * List moderation rules
   */
  async getRules(): Promise<ApiResponse<ModerationRule[]>> {
    const client = getApiClient();
    return client.get<ModerationRule[]>('/admin/moderation/rules');
  },

  /**
   * Create moderation rule
   */
  async createRule(
    data: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<ModerationRule>> {
    const client = getApiClient();
    return client.post<ModerationRule>('/admin/moderation/rules', data);
  },

  /**
   * Update moderation rule
   */
  async updateRule(
    id: string,
    data: Partial<ModerationRule>
  ): Promise<ApiResponse<ModerationRule>> {
    const client = getApiClient();
    return client.patch<ModerationRule>(`/admin/moderation/rules/${id}`, data);
  },

  /**
   * Delete moderation rule
   */
  async deleteRule(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/admin/moderation/rules/${id}`);
  },

  /**
   * Toggle rule active status
   */
  async toggleRule(id: string): Promise<ApiResponse<ModerationRule>> {
    const client = getApiClient();
    return client.post<ModerationRule>(`/admin/moderation/rules/${id}/toggle`);
  },

  // =============================================================================
  // Queues
  // =============================================================================

  /**
   * List moderation queues
   */
  async getQueues(): Promise<ApiResponse<ModerationQueue[]>> {
    const client = getApiClient();
    return client.get<ModerationQueue[]>('/admin/moderation/queues');
  },

  /**
   * Get queue stats
   */
  async getQueueStats(queueId: string): Promise<
    ApiResponse<{
      pending: number;
      inProgress: number;
      processedToday: number;
      averageWaitTime: number;
      moderatorStats: Array<{
        moderatorId: string;
        moderatorName: string;
        processed: number;
        averageTime: number;
      }>;
    }>
  > {
    const client = getApiClient();
    return client.get(`/admin/moderation/queues/${queueId}/stats`);
  },

  // =============================================================================
  // Statistics
  // =============================================================================

  /**
   * Get moderation statistics
   */
  async getStats(): Promise<ApiResponse<ModerationStats>> {
    const client = getApiClient();
    return client.get<ModerationStats>('/admin/moderation/stats');
  },

  // =============================================================================
  // Bulk Operations
  // =============================================================================

  /**
   * Bulk approve items
   */
  async bulkApprove(ids: string[], notes?: string): Promise<ApiResponse<{ approved: number }>> {
    const client = getApiClient();
    return client.post<{ approved: number }>('/admin/moderation/bulk-approve', { ids, notes });
  },

  /**
   * Bulk reject items
   */
  async bulkReject(ids: string[], reason: string): Promise<ApiResponse<{ rejected: number }>> {
    const client = getApiClient();
    return client.post<{ rejected: number }>('/admin/moderation/bulk-reject', { ids, reason });
  },

  /**
   * Bulk assign items
   */
  async bulkAssign(ids: string[], moderatorId: string): Promise<ApiResponse<{ assigned: number }>> {
    const client = getApiClient();
    return client.post<{ assigned: number }>('/admin/moderation/bulk-assign', { ids, moderatorId });
  },
};

export default moderationService;
