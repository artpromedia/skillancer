/**
 * Notification Types for Skillancer Notification Service
 */

// Notification channels
export type NotificationChannel = 'EMAIL' | 'PUSH' | 'SMS' | 'IN_APP';

// Notification priority levels
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

// Notification status
export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';

// Email notification types
export type EmailType =
  | 'WELCOME'
  | 'EMAIL_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'CONTRACT_INVITATION'
  | 'CONTRACT_ACCEPTED'
  | 'CONTRACT_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_SENT'
  | 'MILESTONE_COMPLETED'
  | 'MESSAGE_RECEIVED'
  | 'PROPOSAL_RECEIVED'
  | 'PROPOSAL_ACCEPTED'
  | 'PROPOSAL_REJECTED'
  | 'PROFILE_VIEWED'
  | 'WEEKLY_DIGEST'
  | 'SECURITY_ALERT'
  | 'ACCOUNT_SUSPENDED'
  | 'INVOICE_CREATED'
  | 'INVOICE_PAID'
  | 'EXECUTIVE_ENGAGEMENT_INVITE'
  | 'WARM_INTRODUCTION'
  | 'CERTIFICATION_PASSED'
  | 'CERTIFICATION_EXPIRING';

// Push notification types
export type PushType =
  | 'NEW_MESSAGE'
  | 'NEW_PROPOSAL'
  | 'CONTRACT_UPDATE'
  | 'PAYMENT_UPDATE'
  | 'MILESTONE_UPDATE'
  | 'PROFILE_UPDATE'
  | 'SYSTEM_ALERT'
  | 'REMINDER';

// Base notification input
export interface NotificationInput {
  userId: string;
  tenantId?: string;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

// Email notification input
export interface EmailNotificationInput extends NotificationInput {
  emailType: EmailType;
  to: string;
  subject: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  contentType: string;
}

// Push notification input
export interface PushNotificationInput extends NotificationInput {
  pushType: PushType;
  title: string;
  body: string;
  icon?: string;
  imageUrl?: string;
  clickAction?: string;
  data?: Record<string, string>;
  deviceTokens?: string[];
  topic?: string;
  condition?: string;
}

// Bulk notification input
export interface BulkNotificationInput {
  notifications: (EmailNotificationInput | PushNotificationInput)[];
  batchId?: string;
}

// Notification result
export interface NotificationResult {
  id: string;
  status: NotificationStatus;
  channel: NotificationChannel;
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  externalId?: string;
}

// Email send result
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Push send result
export interface PushSendResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  messageIds?: string[];
  errors?: Array<{
    token: string;
    error: string;
  }>;
}

// User notification preferences
export interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    marketing: boolean;
    contractUpdates: boolean;
    messages: boolean;
    payments: boolean;
    weeklyDigest: boolean;
    securityAlerts: boolean;
  };
  push: {
    enabled: boolean;
    messages: boolean;
    contractUpdates: boolean;
    payments: boolean;
    reminders: boolean;
  };
  sms: {
    enabled: boolean;
    securityAlerts: boolean;
    payments: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;
    timezone: string;
  };
}

// Device token for push notifications
export interface DeviceToken {
  userId: string;
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  deviceId: string;
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

// Notification template
export interface NotificationTemplate {
  id: string;
  name: string;
  type: EmailType | PushType;
  channel: NotificationChannel;
  subject?: string;
  htmlTemplate?: string;
  textTemplate?: string;
  pushTitle?: string;
  pushBody?: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification log entry
export interface NotificationLog {
  id: string;
  userId: string;
  tenantId?: string;
  channel: NotificationChannel;
  type: string;
  status: NotificationStatus;
  recipient: string;
  subject?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  externalId?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
}

// Notification stats
export interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byChannel: Record<
    NotificationChannel,
    {
      sent: number;
      delivered: number;
      failed: number;
    }
  >;
  byType: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
    }
  >;
}

// Webhook event for delivery tracking
export interface DeliveryWebhookEvent {
  provider: 'SENDGRID' | 'FIREBASE';
  eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'unsubscribed';
  messageId: string;
  email?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
