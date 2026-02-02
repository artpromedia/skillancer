/**
 * @module @skillancer/api-client/services/messaging
 * Messaging service client for conversations and messages
 */

import type { HttpClient, ApiResponse } from '../http/base-client';

// =============================================================================
// Types
// =============================================================================

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'job' | 'contract';
  title?: string;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  metadata?: {
    jobId?: string;
    contractId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  role: 'admin' | 'member';
  isOnline: boolean;
  lastSeen?: string;
  joinedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  type: MessageType;
  content: string;
  attachments?: MessageAttachment[];
  replyTo?: {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
  };
  metadata?: Record<string, unknown>;
  status: MessageStatus;
  readBy: Array<{
    userId: string;
    readAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'file'
  | 'audio'
  | 'video'
  | 'system'
  | 'offer'
  | 'milestone-update';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  name: string;
  url: string;
  mimeType: string;
  size: number;
  thumbnail?: string;
  duration?: number; // For audio/video
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface CreateConversationRequest {
  type: 'direct' | 'group';
  participantIds: string[];
  title?: string;
  initialMessage?: string;
}

export interface SendMessageRequest {
  content: string;
  type?: MessageType;
  replyToId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMessageRequest {
  content: string;
}

export interface ConversationListParams {
  type?: 'direct' | 'group' | 'job' | 'contract';
  archived?: boolean;
  page?: number;
  limit?: number;
}

export interface MessageListParams {
  before?: string; // Message ID for pagination
  after?: string;
  limit?: number;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
}

// =============================================================================
// Messaging Service Client
// =============================================================================

export class MessagingServiceClient {
  private httpClient: HttpClient;
  private basePath: string;

  constructor(httpClient: HttpClient, basePath: string = '/messages') {
    this.httpClient = httpClient;
    this.basePath = basePath;
  }

  // ===========================================================================
  // Conversations
  // ===========================================================================

  /**
   * Get user's conversations
   */
  async getConversations(params: ConversationListParams = {}): Promise<
    ApiResponse<{
      conversations: Conversation[];
      total: number;
      hasMore: boolean;
    }>
  > {
    const queryString = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryString.append(key, String(value));
      }
    });

    return this.httpClient.get<
      ApiResponse<{
        conversations: Conversation[];
        total: number;
        hasMore: boolean;
      }>
    >(`${this.basePath}/conversations?${queryString.toString()}`);
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    return this.httpClient.get<Conversation>(`${this.basePath}/conversations/${conversationId}`);
  }

  /**
   * Create new conversation
   */
  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    return this.httpClient.post<Conversation>(`${this.basePath}/conversations`, data);
  }

  /**
   * Get or create direct conversation with user
   */
  async getOrCreateDirectConversation(userId: string): Promise<Conversation> {
    return this.httpClient.post<Conversation>(`${this.basePath}/conversations/direct`, { userId });
  }

  /**
   * Pin conversation
   */
  async pinConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/pin`
    );
  }

  /**
   * Unpin conversation
   */
  async unpinConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/pin`
    );
  }

  /**
   * Mute conversation
   */
  async muteConversation(conversationId: string, until?: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/mute`,
      { until }
    );
  }

  /**
   * Unmute conversation
   */
  async unmuteConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/mute`
    );
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/archive`
    );
  }

  /**
   * Unarchive conversation
   */
  async unarchiveConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/archive`
    );
  }

  /**
   * Leave conversation (group only)
   */
  async leaveConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/leave`
    );
  }

  /**
   * Add participants to group conversation
   */
  async addParticipants(conversationId: string, userIds: string[]): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/participants`,
      { userIds }
    );
  }

  /**
   * Remove participant from group conversation
   */
  async removeParticipant(conversationId: string, userId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/participants/${userId}`
    );
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  /**
   * Get messages in conversation
   */
  async getMessages(
    conversationId: string,
    params: MessageListParams = {}
  ): Promise<
    ApiResponse<{
      messages: Message[];
      hasMore: boolean;
    }>
  > {
    const queryString = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryString.append(key, String(value));
      }
    });

    return this.httpClient.get<
      ApiResponse<{
        messages: Message[];
        hasMore: boolean;
      }>
    >(`${this.basePath}/conversations/${conversationId}/messages?${queryString.toString()}`);
  }

  /**
   * Send message
   */
  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<Message> {
    return this.httpClient.post<Message>(
      `${this.basePath}/conversations/${conversationId}/messages`,
      data
    );
  }

  /**
   * Edit message
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    data: UpdateMessageRequest
  ): Promise<Message> {
    return this.httpClient.patch<Message>(
      `${this.basePath}/conversations/${conversationId}/messages/${messageId}`,
      data
    );
  }

  /**
   * Delete message
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/messages/${messageId}`
    );
  }

  /**
   * Mark message as read
   */
  async markAsRead(conversationId: string, messageId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/messages/${messageId}/read`
    );
  }

  /**
   * Mark all messages in conversation as read
   */
  async markAllAsRead(conversationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/conversations/${conversationId}/read`
    );
  }

  /**
   * Upload attachment
   */
  async uploadAttachment(conversationId: string, file: File): Promise<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    return this.httpClient.post<MessageAttachment>(
      `${this.basePath}/conversations/${conversationId}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search messages across all conversations
   */
  async searchMessages(
    query: string,
    conversationId?: string,
    limit?: number
  ): Promise<
    ApiResponse<{
      messages: Array<Message & { conversationTitle?: string }>;
      total: number;
    }>
  > {
    const params = new URLSearchParams({ query });
    if (conversationId) params.append('conversationId', conversationId);
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<
      ApiResponse<{
        messages: Array<Message & { conversationTitle?: string }>;
        total: number;
      }>
    >(`${this.basePath}/search?${params.toString()}`);
  }

  // ===========================================================================
  // Typing Indicators
  // ===========================================================================

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(conversationId: string, isTyping: boolean): Promise<void> {
    await this.httpClient.post<void>(`${this.basePath}/conversations/${conversationId}/typing`, {
      isTyping,
    });
  }

  // ===========================================================================
  // Unread Count
  // ===========================================================================

  /**
   * Get total unread message count
   */
  async getUnreadCount(): Promise<{ total: number; byConversation: Record<string, number> }> {
    return this.httpClient.get<{ total: number; byConversation: Record<string, number> }>(
      `${this.basePath}/unread`
    );
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createMessagingServiceClient(
  httpClient: HttpClient,
  basePath?: string
): MessagingServiceClient {
  return new MessagingServiceClient(httpClient, basePath);
}
