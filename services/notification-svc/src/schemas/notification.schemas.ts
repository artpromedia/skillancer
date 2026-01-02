/**
 * Zod Validation Schemas for Notification Service
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const NotificationChannelSchema = z.enum(['EMAIL', 'PUSH', 'SMS', 'IN_APP']);

export const NotificationPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const NotificationStatusSchema = z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED']);

export const EmailTypeSchema = z.enum([
  'WELCOME',
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'CONTRACT_INVITATION',
  'CONTRACT_ACCEPTED',
  'CONTRACT_COMPLETED',
  'PAYMENT_RECEIVED',
  'PAYMENT_SENT',
  'MILESTONE_COMPLETED',
  'MESSAGE_RECEIVED',
  'PROPOSAL_RECEIVED',
  'PROPOSAL_ACCEPTED',
  'PROPOSAL_REJECTED',
  'PROFILE_VIEWED',
  'WEEKLY_DIGEST',
  'SECURITY_ALERT',
  'ACCOUNT_SUSPENDED',
  'INVOICE_CREATED',
  'INVOICE_PAID',
  'EXECUTIVE_ENGAGEMENT_INVITE',
  'WARM_INTRODUCTION',
  'CERTIFICATION_PASSED',
  'CERTIFICATION_EXPIRING',
]);

export const PushTypeSchema = z.enum([
  'NEW_MESSAGE',
  'NEW_PROPOSAL',
  'CONTRACT_UPDATE',
  'PAYMENT_UPDATE',
  'MILESTONE_UPDATE',
  'PROFILE_UPDATE',
  'SYSTEM_ALERT',
  'REMINDER',
]);

export const DevicePlatformSchema = z.enum(['IOS', 'ANDROID', 'WEB']);

// =============================================================================
// EMAIL SCHEMAS
// =============================================================================

export const EmailAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1), // Base64 encoded
  contentType: z.string().min(1).max(100),
});

export const SendEmailSchema = z.object({
  emailType: EmailTypeSchema,
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  templateId: z.string().optional(),
  templateData: z.record(z.unknown()).optional(),
  htmlContent: z.string().max(100000).optional(),
  textContent: z.string().max(50000).optional(),
  attachments: z.array(EmailAttachmentSchema).max(10).optional(),
  replyTo: z.string().email().optional(),
  cc: z.array(z.string().email()).max(10).optional(),
  bcc: z.array(z.string().email()).max(10).optional(),
  priority: NotificationPrioritySchema.optional().default('NORMAL'),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const SendTemplatedEmailSchema = z.object({
  to: z.string().email(),
  emailType: EmailTypeSchema,
  templateData: z.record(z.unknown()),
  subject: z.string().min(1).max(500).optional(),
});

// =============================================================================
// PUSH NOTIFICATION SCHEMAS
// =============================================================================

export const SendPushSchema = z.object({
  pushType: PushTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  icon: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  clickAction: z.string().url().optional(),
  data: z.record(z.string()).optional(),
  deviceTokens: z.array(z.string()).max(500).optional(),
  topic: z.string().min(1).max(100).optional(),
  condition: z.string().max(500).optional(),
  priority: NotificationPrioritySchema.optional().default('NORMAL'),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// MULTI-CHANNEL SCHEMAS
// =============================================================================

export const SendMultiChannelSchema = z.object({
  channels: z.array(NotificationChannelSchema).min(1).max(4),
  email: SendEmailSchema.omit({ priority: true, scheduledAt: true, metadata: true }).optional(),
  push: SendPushSchema.omit({ priority: true, scheduledAt: true, metadata: true }).optional(),
  priority: NotificationPrioritySchema.optional().default('NORMAL'),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => {
    // At least one channel content must be provided
    if (data.channels.includes('EMAIL') && !data.email) return false;
    if (data.channels.includes('PUSH') && !data.push) return false;
    return true;
  },
  { message: 'Content must be provided for all specified channels' }
);

// =============================================================================
// DEVICE TOKEN SCHEMAS
// =============================================================================

export const RegisterDeviceSchema = z.object({
  token: z.string().min(10).max(500),
  platform: DevicePlatformSchema,
  deviceId: z.string().min(1).max(100),
});

export const DeactivateDeviceSchema = z.object({
  deviceId: z.string().min(1).max(100),
});

// =============================================================================
// PREFERENCE SCHEMAS
// =============================================================================

export const EmailPreferencesSchema = z.object({
  enabled: z.boolean(),
  marketing: z.boolean(),
  contractUpdates: z.boolean(),
  messages: z.boolean(),
  payments: z.boolean(),
  weeklyDigest: z.boolean(),
  securityAlerts: z.boolean(),
});

export const PushPreferencesSchema = z.object({
  enabled: z.boolean(),
  messages: z.boolean(),
  contractUpdates: z.boolean(),
  payments: z.boolean(),
  reminders: z.boolean(),
});

export const SmsPreferencesSchema = z.object({
  enabled: z.boolean(),
  securityAlerts: z.boolean(),
  payments: z.boolean(),
});

export const QuietHoursSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  timezone: z.string().min(1).max(50),
});

export const UpdatePreferencesSchema = z.object({
  email: EmailPreferencesSchema.partial().optional(),
  push: PushPreferencesSchema.partial().optional(),
  sms: SmsPreferencesSchema.partial().optional(),
  quietHours: QuietHoursSchema.partial().optional(),
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

export const GetHistoryQuerySchema = z.object({
  channel: NotificationChannelSchema.optional(),
  status: NotificationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const GetStatsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// =============================================================================
// WEBHOOK SCHEMAS
// =============================================================================

export const SendGridWebhookEventSchema = z.object({
  email: z.string().email(),
  timestamp: z.number(),
  event: z.string(),
  sg_message_id: z.string(),
  reason: z.string().optional(),
  category: z.array(z.string()).optional(),
});

export const SendGridWebhookSchema = z.array(SendGridWebhookEventSchema);

export const FirebaseWebhookSchema = z.object({
  messageId: z.string(),
  eventType: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
export type SendPushInput = z.infer<typeof SendPushSchema>;
export type SendMultiChannelInput = z.infer<typeof SendMultiChannelSchema>;
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
export type GetHistoryQuery = z.infer<typeof GetHistoryQuerySchema>;
export type GetStatsQuery = z.infer<typeof GetStatsQuerySchema>;
