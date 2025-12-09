/**
 * @module @skillancer/service-client/clients/notification-client
 * Notification service client for push notifications, emails, and in-app messages
 */

import { BaseServiceClient, type ServiceClientConfig, type Pagination } from '../base-client.js';

// ============================================================================
// Types
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  status: NotificationStatus;
  sentAt?: string;
  readAt?: string;
  clickedAt?: string;
  createdAt: string;
}

export type NotificationType =
  | 'job_posted'
  | 'bid_received'
  | 'bid_accepted'
  | 'bid_rejected'
  | 'contract_created'
  | 'contract_completed'
  | 'payment_received'
  | 'payment_sent'
  | 'message_received'
  | 'milestone_approved'
  | 'milestone_rejected'
  | 'review_received'
  | 'account_update'
  | 'system';

export type NotificationChannel = 'push' | 'email' | 'in_app' | 'sms';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface NotificationPreferences {
  userId: string;
  email: ChannelPreferences;
  push: ChannelPreferences;
  inApp: ChannelPreferences;
  sms: ChannelPreferences;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string; // HH:mm
    timezone: string;
  };
  updatedAt: string;
}

export interface ChannelPreferences {
  enabled: boolean;
  types: Record<NotificationType, boolean>;
}

export interface PushSubscription {
  id: string;
  userId: string;
  platform: 'web' | 'ios' | 'android';
  token: string;
  deviceId?: string;
  deviceName?: string;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  type: NotificationType;
  active: boolean;
}

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
  scheduledFor?: string;
}

export interface SendBulkNotificationInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
}

export interface SendEmailInput {
  to: string;
  templateId?: string;
  subject?: string;
  html?: string;
  text?: string;
  data?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: string; // Base64
    contentType: string;
  }>;
}

// ============================================================================
// Notification Service Client
// ============================================================================

export class NotificationServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['NOTIFICATION_SERVICE_URL'] ?? 'http://notification-svc:3006',
      serviceName: 'notification-svc',
      timeout: 15000,
      retries: 3,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        resetTimeout: 30000,
      },
      ...config,
    });
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  /**
   * Send notification to user
   */
  async sendNotification(data: SendNotificationInput): Promise<Notification> {
    return this.post<Notification>('notifications', data);
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotification(
    data: SendBulkNotificationInput
  ): Promise<{ sent: number; failed: number; notifications: Notification[] }> {
    return this.post('notifications/bulk', data);
  }

  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<Notification> {
    return this.get<Notification>(`notifications/${notificationId}`);
  }

  /**
   * List notifications for user
   */
  async listNotifications(
    userId: string,
    params?: {
      type?: NotificationType;
      channel?: NotificationChannel;
      status?: NotificationStatus;
      unreadOnly?: boolean;
      pagination?: Pagination;
    }
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.type) searchParams['type'] = params.type;
    if (params?.channel) searchParams['channel'] = params.channel;
    if (params?.status) searchParams['status'] = params.status;
    if (params?.unreadOnly) searchParams['unreadOnly'] = 'true';
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ notifications: Notification[]; total: number; unreadCount: number }>(
      `users/${userId}/notifications`,
      { searchParams }
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    return this.post<Notification>(`notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    return this.post<{ updated: number }>(`users/${userId}/notifications/read-all`);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.delete(`notifications/${notificationId}`);
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    return this.get<{ count: number }>(`users/${userId}/notifications/unread-count`);
  }

  // ==========================================================================
  // Preferences
  // ==========================================================================

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.get<NotificationPreferences>(`users/${userId}/preferences`);
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    data: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
  ): Promise<NotificationPreferences> {
    return this.patch<NotificationPreferences>(`users/${userId}/preferences`, data);
  }

  /**
   * Reset preferences to default
   */
  async resetPreferences(userId: string): Promise<NotificationPreferences> {
    return this.post<NotificationPreferences>(`users/${userId}/preferences/reset`);
  }

  // ==========================================================================
  // Push Subscriptions
  // ==========================================================================

  /**
   * Register push subscription
   */
  async registerPushSubscription(
    userId: string,
    data: {
      platform: PushSubscription['platform'];
      token: string;
      deviceId?: string;
      deviceName?: string;
    }
  ): Promise<PushSubscription> {
    return this.post<PushSubscription>(`users/${userId}/push-subscriptions`, data);
  }

  /**
   * List push subscriptions
   */
  async listPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.get<PushSubscription[]>(`users/${userId}/push-subscriptions`);
  }

  /**
   * Unregister push subscription
   */
  async unregisterPushSubscription(userId: string, subscriptionId: string): Promise<void> {
    await this.delete(`users/${userId}/push-subscriptions/${subscriptionId}`);
  }

  /**
   * Unregister all push subscriptions for device
   */
  async unregisterDevice(userId: string, deviceId: string): Promise<{ removed: number }> {
    return this.delete(`users/${userId}/devices/${deviceId}`);
  }

  // ==========================================================================
  // Email
  // ==========================================================================

  /**
   * Send email directly
   */
  async sendEmail(data: SendEmailInput): Promise<{ messageId: string; status: string }> {
    return this.post('emails', data);
  }

  /**
   * Send templated email
   */
  async sendTemplatedEmail(
    templateId: string,
    data: {
      to: string;
      variables: Record<string, unknown>;
      attachments?: SendEmailInput['attachments'];
    }
  ): Promise<{ messageId: string; status: string }> {
    return this.post(`emails/templates/${templateId}/send`, data);
  }

  /**
   * List email templates
   */
  async listEmailTemplates(): Promise<EmailTemplate[]> {
    return this.get<EmailTemplate[]>('emails/templates');
  }

  /**
   * Get email template
   */
  async getEmailTemplate(templateId: string): Promise<EmailTemplate> {
    return this.get<EmailTemplate>(`emails/templates/${templateId}`);
  }

  // ==========================================================================
  // Activity Feed
  // ==========================================================================

  /**
   * Get activity feed for user
   */
  async getActivityFeed(
    userId: string,
    pagination?: Pagination
  ): Promise<{ activities: Notification[]; total: number }> {
    const searchParams = this.buildPaginationParams(pagination);
    return this.get<{ activities: Notification[]; total: number }>(`users/${userId}/activity`, {
      searchParams,
    });
  }

  // ==========================================================================
  // Admin Operations
  // ==========================================================================

  /**
   * Broadcast notification to all users
   */
  async broadcast(data: {
    type: NotificationType;
    title: string;
    message: string;
    channels?: NotificationChannel[];
    data?: Record<string, unknown>;
    filters?: {
      roles?: string[];
      tenantId?: string;
    };
  }): Promise<{ queued: number }> {
    return this.post('notifications/broadcast', data);
  }

  /**
   * Get notification stats
   */
  async getStats(params?: {
    startDate?: string;
    endDate?: string;
    type?: NotificationType;
    channel?: NotificationChannel;
  }): Promise<{
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    byChannel: Record<NotificationChannel, number>;
    byType: Record<NotificationType, number>;
  }> {
    const searchParams: Record<string, string> = {};

    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;
    if (params?.type) searchParams['type'] = params.type;
    if (params?.channel) searchParams['channel'] = params.channel;

    return this.get('notifications/stats', { searchParams });
  }
}

// Export singleton instance
export const notificationClient = new NotificationServiceClient();
