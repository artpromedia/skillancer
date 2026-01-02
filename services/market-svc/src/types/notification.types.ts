// @ts-nocheck
/**
 * @module @skillancer/market-svc/types/notification
 * TypeScript types for the Unified Notification System
 */

import type {
  NotificationCategory,
  NotificationPriority,
  EmailFrequency,
  DigestType,
  UnsubscribeType,
} from '@skillancer/database';

// ============================================================================
// Notification Types
// ============================================================================

/** Standard notification types - extend with your own */
export const NOTIFICATION_TYPES = {
  // Messages
  NEW_MESSAGE: 'NEW_MESSAGE',
  MESSAGE_REACTION: 'MESSAGE_REACTION',
  MENTIONED_IN_MESSAGE: 'MENTIONED_IN_MESSAGE',

  // Projects
  JOB_POSTED: 'JOB_POSTED',
  JOB_INVITATION: 'JOB_INVITATION',
  JOB_APPLICATION_RECEIVED: 'JOB_APPLICATION_RECEIVED',

  // Bids
  BID_RECEIVED: 'BID_RECEIVED',
  BID_ACCEPTED: 'BID_ACCEPTED',
  BID_REJECTED: 'BID_REJECTED',
  BID_WITHDRAWN: 'BID_WITHDRAWN',
  BID_COUNTERED: 'BID_COUNTERED',

  // Contracts
  CONTRACT_CREATED: 'CONTRACT_CREATED',
  CONTRACT_STARTED: 'CONTRACT_STARTED',
  CONTRACT_COMPLETED: 'CONTRACT_COMPLETED',
  CONTRACT_CANCELLED: 'CONTRACT_CANCELLED',
  CONTRACT_AMENDED: 'CONTRACT_AMENDED',
  CONTRACT_SIGNED: 'CONTRACT_SIGNED',
  MILESTONE_COMPLETED: 'MILESTONE_COMPLETED',
  MILESTONE_DUE_SOON: 'MILESTONE_DUE_SOON',
  MILESTONE_OVERDUE: 'MILESTONE_OVERDUE',

  // Payments
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_SENT: 'PAYMENT_SENT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYOUT_INITIATED: 'PAYOUT_INITIATED',
  PAYOUT_COMPLETED: 'PAYOUT_COMPLETED',
  ESCROW_FUNDED: 'ESCROW_FUNDED',
  ESCROW_RELEASED: 'ESCROW_RELEASED',
  INVOICE_RECEIVED: 'INVOICE_RECEIVED',
  INVOICE_PAID: 'INVOICE_PAID',
  INVOICE_OVERDUE: 'INVOICE_OVERDUE',

  // Reviews
  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  REVIEW_REMINDER: 'REVIEW_REMINDER',
  REVIEW_RESPONSE: 'REVIEW_RESPONSE',

  // Account
  ACCOUNT_VERIFIED: 'ACCOUNT_VERIFIED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SECURITY_ALERT: 'SECURITY_ALERT',
  TWO_FACTOR_ENABLED: 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED',

  // Service Orders
  SERVICE_ORDER_PLACED: 'SERVICE_ORDER_PLACED',
  SERVICE_ORDER_ACCEPTED: 'SERVICE_ORDER_ACCEPTED',
  SERVICE_ORDER_DELIVERED: 'SERVICE_ORDER_DELIVERED',
  SERVICE_ORDER_COMPLETED: 'SERVICE_ORDER_COMPLETED',
  SERVICE_ORDER_REVISION_REQUESTED: 'SERVICE_ORDER_REVISION_REQUESTED',

  // Disputes
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  DISPUTE_UPDATED: 'DISPUTE_UPDATED',
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED',

  // System
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  FEATURE_UPDATE: 'FEATURE_UPDATE',

  // Marketing
  PROMOTIONAL: 'PROMOTIONAL',
  WEEKLY_DIGEST: 'WEEKLY_DIGEST',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ============================================================================
// Channel Types
// ============================================================================

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS';

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL', 'PUSH', 'SMS'];

// ============================================================================
// Send Notification Params
// ============================================================================

export interface SendNotificationParams {
  userId: string;
  type: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  groupKey?: string;
  expiresAt?: Date;
}

export interface SendBulkNotificationParams {
  userIds: string[];
  type: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
}

// ============================================================================
// Rendered Content
// ============================================================================

export interface RenderedContent {
  inAppTitle: string;
  inAppBody: string;
  emailSubject: string;
  emailHtml: string;
  emailText: string;
  pushTitle: string;
  pushBody: string;
  smsMessage: string;
  actionUrl?: string | undefined;
  actionLabel?: string | undefined;
}

// ============================================================================
// Notification Preferences
// ============================================================================

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailFrequency: EmailFrequency;
  quietHoursEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  quietHoursTimezone?: string | null;
}

export interface PreferenceUpdate {
  notificationType: string;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  smsEnabled?: boolean;
  emailFrequency?: EmailFrequency;
}

export interface QuietHoursSettings {
  enabled: boolean;
  startTime?: string | undefined;
  endTime?: string | undefined;
  timezone?: string | undefined;
}

// ============================================================================
// User Preference Response
// ============================================================================

export interface UserPreferenceResponse {
  notificationType: string;
  category: NotificationCategory;
  name: string;
  description?: string | null;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailFrequency: EmailFrequency;
}

// ============================================================================
// Notification Response
// ============================================================================

export interface NotificationResponse {
  id: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  iconUrl?: string | null;
  imageUrl?: string | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  data?: Record<string, unknown> | null;
  groupKey?: string | null;
  groupCount: number;
  isRead: boolean;
  readAt?: Date | null;
  isDismissed: boolean;
  createdAt: Date;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  total: number;
  unreadCount: number;
}

export interface UnreadCountResponse {
  total: number;
  byCategory: Record<string, number>;
}

// ============================================================================
// Notification List Options
// ============================================================================

export interface NotificationListOptions {
  category?: NotificationCategory | undefined;
  isRead?: boolean | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ============================================================================
// Template Types
// ============================================================================

export interface CreateTemplateParams {
  type: string;
  name: string;
  description?: string;
  category: NotificationCategory;
  inAppTitle: string;
  inAppBody: string;
  emailSubject?: string;
  emailHtmlTemplate?: string;
  emailTextTemplate?: string;
  pushTitle?: string;
  pushBody?: string;
  smsTemplate?: string;
  defaultPriority?: NotificationPriority;
  defaultChannels?: string[];
  isGroupable?: boolean;
  groupKeyTemplate?: string;
}

export interface UpdateTemplateParams {
  name?: string;
  description?: string;
  inAppTitle?: string;
  inAppBody?: string;
  emailSubject?: string;
  emailHtmlTemplate?: string;
  emailTextTemplate?: string;
  pushTitle?: string;
  pushBody?: string;
  smsTemplate?: string;
  defaultPriority?: NotificationPriority;
  defaultChannels?: string[];
  isGroupable?: boolean;
  groupKeyTemplate?: string;
  isActive?: boolean;
}

// ============================================================================
// Digest Types
// ============================================================================

export interface DigestSummary {
  totalCount: number;
  byCategory: Record<NotificationCategory, number>;
  highlights: Array<{
    type: string;
    title: string;
    body: string;
    count: number;
  }>;
}

export interface CreateDigestParams {
  userId: string;
  digestType: DigestType;
  periodStart: Date;
  periodEnd: Date;
  notificationIds: string[];
  summary: DigestSummary;
  scheduledFor: Date;
}

// ============================================================================
// Unsubscribe Types
// ============================================================================

export interface UnsubscribeParams {
  email: string;
  userId?: string | undefined;
  type: UnsubscribeType;
  category?: NotificationCategory | undefined;
  notificationType?: string | undefined;
  source: string;
}

export interface UnsubscribeTokenPayload {
  email: string;
  userId?: string;
  type: UnsubscribeType;
  category?: NotificationCategory;
  notificationType?: string;
}

// ============================================================================
// Email Service Types
// ============================================================================

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  category: NotificationCategory;
  notificationType: string;
  metadata?: Record<string, unknown>;
}

export interface EmailServiceConfig {
  provider: 'sendgrid' | 'ses';
  apiKey?: string | undefined;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string | undefined;
}

// ============================================================================
// Push Service Types
// ============================================================================

export interface SendPushParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'high' | 'normal';
  imageUrl?: string;
  actionUrl?: string;
}

export interface PushServiceConfig {
  provider: 'fcm';
  serviceAccountPath?: string | undefined;
  projectId?: string | undefined;
}

// ============================================================================
// SMS Service Types
// ============================================================================

export interface SendSmsParams {
  to: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SmsServiceConfig {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

// ============================================================================
// WebSocket Events
// ============================================================================

export interface NotificationNewEvent {
  notification: NotificationResponse;
}

export interface NotificationReadEvent {
  notificationId: string;
}

export interface NotificationsAllReadEvent {
  category?: NotificationCategory;
  count: number;
}

export interface UnreadCountUpdateEvent {
  total: number;
  byCategory: Record<string, number>;
}

// ============================================================================
// Error Types
// ============================================================================

export type NotificationErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'NOTIFICATION_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'INVALID_CHANNEL'
  | 'DELIVERY_FAILED'
  | 'PREFERENCE_NOT_FOUND'
  | 'INVALID_TOKEN'
  | 'RATE_LIMITED';

export class NotificationError extends Error {
  constructor(
    public code: NotificationErrorCode,
    message?: string
  ) {
    super(message || code);
    this.name = 'NotificationError';
  }
}

