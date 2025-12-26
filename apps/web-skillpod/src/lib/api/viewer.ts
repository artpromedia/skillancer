/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

/**
 * Viewer API Client
 *
 * API client for VDI session management:
 * - Session lifecycle (create, connect, extend, terminate)
 * - Containment policy management
 * - Clipboard and file transfer
 * - Activity reporting
 */

import { apiClient } from '@skillancer/api-client';

// ============================================================================
// TYPES
// ============================================================================

export interface SessionDetails {
  id: string;
  userId: string;
  podId: string;
  podName: string;
  status: 'creating' | 'ready' | 'connecting' | 'connected' | 'disconnected' | 'terminated';
  createdAt: string;
  connectedAt?: string;
  expiresAt: string;
  kasmUrl?: string;
  resolution?: string;
  containmentLevel: 'standard' | 'high' | 'maximum';
}

export interface SessionToken {
  token: string;
  apiUrl: string;
  expiresAt: Date;
  refreshToken?: string;
}

export interface ContainmentPolicy {
  id: string;
  name: string;
  level: 'standard' | 'high' | 'maximum';
  clipboardEnabled: boolean;
  clipboardDirection: 'bidirectional' | 'inbound' | 'outbound' | 'disabled';
  fileTransferEnabled: boolean;
  fileTransferDirection: 'bidirectional' | 'upload' | 'download' | 'disabled';
  maxFileSize?: number;
  allowedFileTypes?: string[];
  screenshotProtection: boolean;
  watermarkEnabled: boolean;
  watermarkConfig?: {
    pattern: string;
    opacity: number;
    showUserId: boolean;
    showTimestamp: boolean;
  };
  printEnabled: boolean;
  usbEnabled: boolean;
  recordingEnabled: boolean;
}

export interface ClipboardCheckRequest {
  content: string;
  direction: 'inbound' | 'outbound';
}

export interface FileTransferRequest {
  id: string;
  filename: string;
  size: number;
  type: string;
  status: 'pending' | 'scanning' | 'approved' | 'blocked' | 'transferring' | 'completed' | 'failed';
  uploadUrl?: string;
  downloadUrl?: string;
  scanResult?: {
    safe: boolean;
    threats?: string[];
  };
  createdAt: string;
}

export interface FileUploadRequest {
  filename: string;
  size: number;
  type: string;
}

export interface FileDownloadRequest {
  fileId: string;
  filename: string;
}

export interface ContainmentViolation {
  type: string;
  details?: string;
  timestamp: string;
}

export interface ActivityReport {
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface SessionMetrics {
  latency: number;
  frameRate: number;
  bandwidth: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  cpuUsage?: number;
  memoryUsage?: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

const API_BASE = '/api/v1';

export const viewerApi = {
  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Get session connection details
   */
  async getConnectionDetails(sessionId: string): Promise<SessionDetails> {
    const response = await apiClient.get<SessionDetails>(`${API_BASE}/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get session token for Kasm connection
   */
  async getSessionToken(sessionId: string): Promise<SessionToken> {
    const response = await apiClient.get<SessionToken>(`${API_BASE}/sessions/${sessionId}/token`);
    return {
      ...response.data,
      expiresAt: new Date(response.data.expiresAt),
    };
  },

  /**
   * Extend session duration
   */
  async extendSession(sessionId: string, durationMinutes: number = 60): Promise<SessionDetails> {
    const response = await apiClient.post<SessionDetails>(
      `${API_BASE}/sessions/${sessionId}/extend`,
      { durationMinutes }
    );
    return response.data;
  },

  /**
   * Terminate session
   */
  async terminateSession(sessionId: string, reason?: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/sessions/${sessionId}`, {
      data: { reason },
    });
  },

  /**
   * Report session activity
   */
  async reportActivity(sessionId: string, activity: ActivityReport): Promise<void> {
    await apiClient.post(`${API_BASE}/sessions/${sessionId}/activity`, activity);
  },

  /**
   * Report session metrics
   */
  async reportMetrics(sessionId: string, metrics: SessionMetrics): Promise<void> {
    await apiClient.post(`${API_BASE}/sessions/${sessionId}/metrics`, metrics);
  },

  // ==========================================================================
  // CONTAINMENT POLICY
  // ==========================================================================

  /**
   * Get containment policy for session
   */
  async getContainmentPolicy(sessionId: string): Promise<ContainmentPolicy> {
    const response = await apiClient.get<ContainmentPolicy>(
      `${API_BASE}/sessions/${sessionId}/containment/policy`
    );
    return response.data;
  },

  /**
   * Report containment violation
   */
  async reportContainmentViolation(
    sessionId: string,
    violation: ContainmentViolation
  ): Promise<void> {
    await apiClient.post(`${API_BASE}/sessions/${sessionId}/containment/violations`, violation);
  },

  // ==========================================================================
  // CLIPBOARD
  // ==========================================================================

  /**
   * Check clipboard content against DLP policy
   */
  async checkClipboardContent(sessionId: string, request: ClipboardCheckRequest): Promise<boolean> {
    const response = await apiClient.post<{ allowed: boolean }>(
      `${API_BASE}/sessions/${sessionId}/clipboard/check`,
      request
    );
    return response.data.allowed;
  },

  /**
   * Get remote clipboard content
   */
  async getRemoteClipboard(sessionId: string): Promise<string> {
    const response = await apiClient.get<{ content: string }>(
      `${API_BASE}/sessions/${sessionId}/clipboard`
    );
    return response.data.content;
  },

  /**
   * Set remote clipboard content
   */
  async setRemoteClipboard(sessionId: string, content: string): Promise<void> {
    await apiClient.post(`${API_BASE}/sessions/${sessionId}/clipboard`, { content });
  },

  // ==========================================================================
  // FILE TRANSFER
  // ==========================================================================

  /**
   * Request file upload
   */
  async requestFileUpload(
    sessionId: string,
    request: FileUploadRequest
  ): Promise<FileTransferRequest> {
    const response = await apiClient.post<FileTransferRequest>(
      `${API_BASE}/sessions/${sessionId}/files/upload`,
      request
    );
    return response.data;
  },

  /**
   * Request file download
   */
  async requestFileDownload(
    sessionId: string,
    request: FileDownloadRequest
  ): Promise<FileTransferRequest> {
    const response = await apiClient.post<FileTransferRequest>(
      `${API_BASE}/sessions/${sessionId}/files/download`,
      request
    );
    return response.data;
  },

  /**
   * Get file transfer status
   */
  async getFileTransferStatus(sessionId: string, transferId: string): Promise<FileTransferRequest> {
    const response = await apiClient.get<FileTransferRequest>(
      `${API_BASE}/sessions/${sessionId}/files/${transferId}`
    );
    return response.data;
  },

  /**
   * Cancel file transfer
   */
  async cancelFileTransfer(sessionId: string, transferId: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/sessions/${sessionId}/files/${transferId}`);
  },

  /**
   * List pending file transfers
   */
  async listFileTransfers(
    sessionId: string
  ): Promise<{ uploads: FileTransferRequest[]; downloads: FileTransferRequest[] }> {
    const response = await apiClient.get<{
      uploads: FileTransferRequest[];
      downloads: FileTransferRequest[];
    }>(`${API_BASE}/sessions/${sessionId}/files`);
    return response.data;
  },
};
