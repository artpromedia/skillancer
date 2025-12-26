/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

/**
 * Pods API Client
 *
 * API client for SkillPod management:
 * - List pods
 * - Pod details
 * - Session creation
 * - Pod lifecycle management
 */

import { apiClient } from '@skillancer/api-client';

// ============================================================================
// TYPES
// ============================================================================

export interface PodDetails {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'starting' | 'stopped' | 'error';
  image: string;
  imageVersion: string;
  containmentLevel: 'standard' | 'high' | 'maximum';
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  activeSessionId?: string;
  createdAt: string;
  lastAccessedAt?: string;
  ownerId: string;
  ownerName: string;
  recentSessions?: RecentSession[];
  hasRecordings: boolean;
  tags?: string[];
}

export interface RecentSession {
  id: string;
  startTime: string;
  endTime?: string;
  duration: number;
  status: 'active' | 'ended' | 'terminated';
}

export interface PodListParams {
  status?: PodDetails['status'];
  ownerId?: string;
  containmentLevel?: PodDetails['containmentLevel'];
  search?: string;
  page?: number;
  limit?: number;
}

export interface PodListResponse {
  pods: PodDetails[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateSessionRequest {
  podId: string;
  resolution?: string;
  quality?: 'auto' | 'high' | 'medium' | 'low';
  recordingEnabled?: boolean;
}

export interface SessionCreatedResponse {
  sessionId: string;
  viewerUrl: string;
  expiresAt: string;
}

// ============================================================================
// API CLIENT
// ============================================================================

const API_BASE = '/api/v1';

export const podsApi = {
  /**
   * List pods with filters
   */
  async listPods(params: PodListParams = {}): Promise<PodListResponse> {
    const response = await apiClient.get<PodListResponse>(`${API_BASE}/pods`, { params });
    return response.data;
  },

  /**
   * Get pod details
   */
  async getPodDetails(podId: string): Promise<PodDetails> {
    const response = await apiClient.get<PodDetails>(`${API_BASE}/pods/${podId}`);
    return response.data;
  },

  /**
   * Start a pod
   */
  async startPod(podId: string): Promise<PodDetails> {
    const response = await apiClient.post<PodDetails>(`${API_BASE}/pods/${podId}/start`);
    return response.data;
  },

  /**
   * Stop a pod
   */
  async stopPod(podId: string): Promise<PodDetails> {
    const response = await apiClient.post<PodDetails>(`${API_BASE}/pods/${podId}/stop`);
    return response.data;
  },

  /**
   * Restart a pod
   */
  async restartPod(podId: string): Promise<PodDetails> {
    const response = await apiClient.post<PodDetails>(`${API_BASE}/pods/${podId}/restart`);
    return response.data;
  },

  /**
   * Create a new session
   */
  async createSession(request: CreateSessionRequest): Promise<SessionCreatedResponse> {
    const response = await apiClient.post<SessionCreatedResponse>(
      `${API_BASE}/pods/${request.podId}/sessions`,
      request
    );
    return response.data;
  },

  /**
   * Get active session for pod
   */
  async getActiveSession(podId: string): Promise<RecentSession | null> {
    try {
      const response = await apiClient.get<RecentSession>(
        `${API_BASE}/pods/${podId}/sessions/active`
      );
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Terminate active session
   */
  async terminateSession(podId: string, sessionId: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/pods/${podId}/sessions/${sessionId}`);
  },
};
