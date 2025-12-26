/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

/**
 * Recordings API Client
 *
 * API client for session recordings:
 * - List recordings
 * - Get recording details
 * - Stream recordings
 * - Download recordings
 * - Manage recording lifecycle
 */

import { apiClient } from '@skillancer/api-client';

// ============================================================================
// TYPES
// ============================================================================

export interface RecordingDetails {
  id: string;
  name: string;
  sessionId: string;
  podId: string;
  podName: string;
  userId: string;
  userName: string;
  status: 'recording' | 'processing' | 'ready' | 'expired' | 'deleted';
  processingProgress?: number;
  recordedAt: string;
  duration: number;
  resolution: string;
  fileSize: number;
  streamUrl: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  chapters?: RecordingChapter[];
  auditLog?: AuditLogEntry[];
  expiresAt?: string;
}

export interface RecordingChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  thumbnailUrl?: string;
}

export interface AuditLogEntry {
  timestamp: number;
  action: string;
  details?: string;
}

export interface RecordingListParams {
  userId?: string;
  podId?: string;
  sessionId?: string;
  status?: RecordingDetails['status'];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'recordedAt' | 'duration' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface RecordingListResponse {
  recordings: RecordingDetails[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface RecordingDownloadOptions {
  quality?: 'original' | 'high' | 'medium' | 'low';
  format?: 'mp4' | 'webm';
  includeAudio?: boolean;
}

export interface RecordingShareOptions {
  expiresIn?: number; // hours
  password?: string;
  allowDownload?: boolean;
}

export interface RecordingShareLink {
  url: string;
  expiresAt: string;
  password?: string;
}

// ============================================================================
// API CLIENT
// ============================================================================

const API_BASE = '/api/v1';

export const recordingsApi = {
  // ==========================================================================
  // RECORDING MANAGEMENT
  // ==========================================================================

  /**
   * List recordings with filters
   */
  async listRecordings(params: RecordingListParams = {}): Promise<RecordingListResponse> {
    const response = await apiClient.get<RecordingListResponse>(`${API_BASE}/recordings`, {
      params,
    });
    return response.data;
  },

  /**
   * Get recording details
   */
  async getRecordingDetails(recordingId: string): Promise<RecordingDetails> {
    const response = await apiClient.get<RecordingDetails>(`${API_BASE}/recordings/${recordingId}`);
    return response.data;
  },

  /**
   * Get recording stream URL
   */
  async getStreamUrl(recordingId: string): Promise<string> {
    const response = await apiClient.get<{ streamUrl: string }>(
      `${API_BASE}/recordings/${recordingId}/stream`
    );
    return response.data.streamUrl;
  },

  /**
   * Get download URL with options
   */
  async getDownloadUrl(
    recordingId: string,
    options: RecordingDownloadOptions = {}
  ): Promise<string> {
    const response = await apiClient.post<{ downloadUrl: string }>(
      `${API_BASE}/recordings/${recordingId}/download`,
      options
    );
    return response.data.downloadUrl;
  },

  /**
   * Start download (triggers browser download)
   */
  async download(recordingId: string, options: RecordingDownloadOptions = {}): Promise<void> {
    const downloadUrl = await this.getDownloadUrl(recordingId, options);
    window.open(downloadUrl, '_blank');
  },

  // ==========================================================================
  // RECORDING LIFECYCLE
  // ==========================================================================

  /**
   * Rename recording
   */
  async renameRecording(recordingId: string, name: string): Promise<RecordingDetails> {
    const response = await apiClient.patch<RecordingDetails>(
      `${API_BASE}/recordings/${recordingId}`,
      { name }
    );
    return response.data;
  },

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/recordings/${recordingId}`);
  },

  /**
   * Extend recording expiration
   */
  async extendExpiration(recordingId: string, days: number): Promise<RecordingDetails> {
    const response = await apiClient.post<RecordingDetails>(
      `${API_BASE}/recordings/${recordingId}/extend`,
      { days }
    );
    return response.data;
  },

  // ==========================================================================
  // CHAPTERS
  // ==========================================================================

  /**
   * Get recording chapters
   */
  async getChapters(recordingId: string): Promise<RecordingChapter[]> {
    const response = await apiClient.get<{ chapters: RecordingChapter[] }>(
      `${API_BASE}/recordings/${recordingId}/chapters`
    );
    return response.data.chapters;
  },

  /**
   * Add chapter marker
   */
  async addChapter(
    recordingId: string,
    chapter: Omit<RecordingChapter, 'id'>
  ): Promise<RecordingChapter> {
    const response = await apiClient.post<RecordingChapter>(
      `${API_BASE}/recordings/${recordingId}/chapters`,
      chapter
    );
    return response.data;
  },

  /**
   * Update chapter
   */
  async updateChapter(
    recordingId: string,
    chapterId: string,
    updates: Partial<Omit<RecordingChapter, 'id'>>
  ): Promise<RecordingChapter> {
    const response = await apiClient.patch<RecordingChapter>(
      `${API_BASE}/recordings/${recordingId}/chapters/${chapterId}`,
      updates
    );
    return response.data;
  },

  /**
   * Delete chapter
   */
  async deleteChapter(recordingId: string, chapterId: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/recordings/${recordingId}/chapters/${chapterId}`);
  },

  // ==========================================================================
  // SHARING
  // ==========================================================================

  /**
   * Create shareable link
   */
  async createShareLink(
    recordingId: string,
    options: RecordingShareOptions = {}
  ): Promise<RecordingShareLink> {
    const response = await apiClient.post<RecordingShareLink>(
      `${API_BASE}/recordings/${recordingId}/share`,
      options
    );
    return response.data;
  },

  /**
   * Revoke share link
   */
  async revokeShareLink(recordingId: string): Promise<void> {
    await apiClient.delete(`${API_BASE}/recordings/${recordingId}/share`);
  },

  // ==========================================================================
  // AUDIT LOG
  // ==========================================================================

  /**
   * Get recording audit log
   */
  async getAuditLog(recordingId: string): Promise<AuditLogEntry[]> {
    const response = await apiClient.get<{ auditLog: AuditLogEntry[] }>(
      `${API_BASE}/recordings/${recordingId}/audit`
    );
    return response.data.auditLog;
  },

  // ==========================================================================
  // THUMBNAIL
  // ==========================================================================

  /**
   * Get thumbnail at specific timestamp
   */
  async getThumbnail(recordingId: string, timestamp: number): Promise<string> {
    const response = await apiClient.get<{ thumbnailUrl: string }>(
      `${API_BASE}/recordings/${recordingId}/thumbnail`,
      { params: { timestamp } }
    );
    return response.data.thumbnailUrl;
  },

  /**
   * Generate thumbnails for scrubber
   */
  async generateThumbnails(
    recordingId: string,
    count: number = 10
  ): Promise<{ timestamp: number; url: string }[]> {
    const response = await apiClient.post<{ thumbnails: { timestamp: number; url: string }[] }>(
      `${API_BASE}/recordings/${recordingId}/thumbnails`,
      { count }
    );
    return response.data.thumbnails;
  },

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  /**
   * Export recording with specific settings
   */
  async exportRecording(
    recordingId: string,
    options: {
      startTime?: number;
      endTime?: number;
      quality?: 'original' | 'high' | 'medium' | 'low';
      format?: 'mp4' | 'webm' | 'gif';
      includeAudio?: boolean;
    }
  ): Promise<{ exportId: string; estimatedTime: number }> {
    const response = await apiClient.post<{ exportId: string; estimatedTime: number }>(
      `${API_BASE}/recordings/${recordingId}/export`,
      options
    );
    return response.data;
  },

  /**
   * Get export status
   */
  async getExportStatus(
    recordingId: string,
    exportId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'ready' | 'failed';
    progress: number;
    downloadUrl?: string;
    error?: string;
  }> {
    const response = await apiClient.get(
      `${API_BASE}/recordings/${recordingId}/export/${exportId}`
    );
    return response.data;
  },
};
