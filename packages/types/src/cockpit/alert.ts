/**
 * @skillancer/types - Cockpit: Alert Types
 * Notification and alert schemas for the dashboard
 */

import { z } from 'zod';

import { uuidSchema, dateSchema, timestampsSchema } from '../common/base';

// =============================================================================
// Alert Enums
// =============================================================================

/**
 * Alert/notification type
 */
export const alertTypeSchema = z.enum([
  // Contract related
  'CONTRACT_CREATED',
  'CONTRACT_SIGNED',
  'CONTRACT_STARTED',
  'CONTRACT_COMPLETED',
  'CONTRACT_CANCELLED',
  'CONTRACT_DISPUTED',

  // Milestone related
  'MILESTONE_FUNDED',
  'MILESTONE_SUBMITTED',
  'MILESTONE_APPROVED',
  'MILESTONE_REJECTED',
  'MILESTONE_PAID',
  'MILESTONE_DUE_SOON',
  'MILESTONE_OVERDUE',

  // Job related
  'NEW_JOB_MATCH',
  'JOB_APPLICATION_RECEIVED',
  'JOB_APPLICATION_SHORTLISTED',
  'JOB_APPLICATION_ACCEPTED',
  'JOB_APPLICATION_REJECTED',
  'JOB_INVITATION',

  // Bid related
  'BID_RECEIVED',
  'BID_SHORTLISTED',
  'BID_ACCEPTED',
  'BID_REJECTED',
  'BID_EXPIRED',

  // Review related
  'REVIEW_RECEIVED',
  'REVIEW_RESPONSE',

  // Payment related
  'PAYMENT_RECEIVED',
  'PAYMENT_SENT',
  'PAYMENT_FAILED',
  'PAYMENT_PENDING',
  'INVOICE_RECEIVED',
  'INVOICE_OVERDUE',

  // SkillPod related
  'POD_READY',
  'POD_EXPIRING',
  'POD_TERMINATED',
  'SESSION_STARTED',
  'SESSION_ENDED',
  'POLICY_VIOLATION',

  // Communication
  'NEW_MESSAGE',
  'MENTION',
  'FILE_SHARED',

  // Calendar
  'EVENT_REMINDER',
  'EVENT_INVITATION',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',

  // System
  'SYSTEM_ANNOUNCEMENT',
  'MAINTENANCE_SCHEDULED',
  'FEATURE_UPDATE',
  'SECURITY_ALERT',
  'ACCOUNT_ALERT',

  // Custom
  'CUSTOM',
]);
export type AlertType = z.infer<typeof alertTypeSchema>;

/**
 * Alert priority/severity
 */
export const alertPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type AlertPriority = z.infer<typeof alertPrioritySchema>;

/**
 * Alert category for grouping
 */
export const alertCategorySchema = z.enum([
  'CONTRACTS',
  'JOBS',
  'PAYMENTS',
  'MESSAGES',
  'CALENDAR',
  'SKILLPOD',
  'SYSTEM',
  'OTHER',
]);
export type AlertCategory = z.infer<typeof alertCategorySchema>;

/**
 * Delivery channel
 */
export const deliveryChannelSchema = z.enum(['IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WEBHOOK']);
export type DeliveryChannel = z.infer<typeof deliveryChannelSchema>;

// =============================================================================
// Alert Sub-schemas
// =============================================================================

/**
 * Alert action (CTA button)
 */
export const alertActionSchema = z.object({
  label: z.string().max(50),
  url: z.string().optional(),
  action: z.string().optional(), // Client-side action identifier
  isPrimary: z.boolean().default(false),
});
export type AlertAction = z.infer<typeof alertActionSchema>;

/**
 * Alert delivery record
 */
export const alertDeliverySchema = z.object({
  channel: deliveryChannelSchema,
  sentAt: dateSchema.optional(),
  deliveredAt: dateSchema.optional(),
  failedAt: dateSchema.optional(),
  failureReason: z.string().max(500).optional(),
  retryCount: z.number().int().nonnegative().default(0),
});
export type AlertDelivery = z.infer<typeof alertDeliverySchema>;

// =============================================================================
// Main Alert Schema
// =============================================================================

/**
 * Complete alert/notification schema
 */
export const alertSchema = z.object({
  id: uuidSchema,

  // Recipient
  userId: uuidSchema,
  tenantId: uuidSchema.optional(),

  // Classification
  type: alertTypeSchema,
  category: alertCategorySchema,
  priority: alertPrioritySchema.default('MEDIUM'),

  // Content
  title: z.string().min(1).max(200),
  message: z.string().max(1000),
  richContent: z.string().max(5000).optional(), // HTML content

  // Related entities
  relatedEntityType: z
    .enum([
      'CONTRACT',
      'JOB',
      'BID',
      'MILESTONE',
      'REVIEW',
      'PAYMENT',
      'INVOICE',
      'POD',
      'SESSION',
      'MESSAGE',
      'EVENT',
      'USER',
      'CLIENT',
    ])
    .optional(),
  relatedEntityId: uuidSchema.optional(),

  // Sender (if from another user)
  senderUserId: uuidSchema.optional(),
  senderName: z.string().max(200).optional(),
  senderAvatar: z.string().url().optional(),

  // Actions
  actions: z.array(alertActionSchema).max(3).optional(),

  // Status
  isRead: z.boolean().default(false),
  readAt: dateSchema.optional(),
  isArchived: z.boolean().default(false),
  archivedAt: dateSchema.optional(),
  isDismissed: z.boolean().default(false),
  dismissedAt: dateSchema.optional(),

  // Delivery
  channels: z.array(deliveryChannelSchema).default(['IN_APP']),
  deliveries: z.array(alertDeliverySchema).optional(),

  // Grouping
  groupId: z.string().optional(), // For grouping related alerts
  groupCount: z.number().int().positive().optional(), // Count in group

  // Expiry
  expiresAt: dateSchema.optional(),

  // Metadata
  metadata: z.record(z.unknown()).optional(),

  ...timestampsSchema.shape,
});
export type Alert = z.infer<typeof alertSchema>;

// =============================================================================
// Alert CRUD Schemas
// =============================================================================

/**
 * Create alert input (internal use)
 */
export const createAlertSchema = z.object({
  userId: uuidSchema,
  type: alertTypeSchema,
  category: alertCategorySchema,
  priority: alertPrioritySchema.default('MEDIUM'),
  title: z.string().min(1).max(200),
  message: z.string().max(1000),
  richContent: z.string().max(5000).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: uuidSchema.optional(),
  senderUserId: uuidSchema.optional(),
  actions: z.array(alertActionSchema).max(3).optional(),
  channels: z.array(deliveryChannelSchema).default(['IN_APP']),
  expiresAt: dateSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateAlert = z.infer<typeof createAlertSchema>;

/**
 * Mark alert action
 */
export const alertActionInputSchema = z.object({
  alertIds: z.array(uuidSchema),
  action: z.enum(['READ', 'UNREAD', 'ARCHIVE', 'UNARCHIVE', 'DISMISS', 'DELETE']),
});
export type AlertActionInput = z.infer<typeof alertActionInputSchema>;

/**
 * Alert filter parameters
 */
export const alertFilterSchema = z.object({
  type: z.array(alertTypeSchema).optional(),
  category: z.array(alertCategorySchema).optional(),
  priority: z.array(alertPrioritySchema).optional(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  search: z.string().optional(),
});
export type AlertFilter = z.infer<typeof alertFilterSchema>;

// =============================================================================
// Alert Notification Preferences Schema
// =============================================================================

/**
 * Per-type alert notification preference
 */
export const alertNotificationPreferenceItemSchema = z.object({
  type: alertTypeSchema,
  enabled: z.boolean().default(true),
  channels: z.array(deliveryChannelSchema).default(['IN_APP']),
});
export type AlertNotificationPreferenceItem = z.infer<typeof alertNotificationPreferenceItemSchema>;

/**
 * User alert notification preferences
 */
export const alertNotificationPreferencesSchema = z.object({
  userId: uuidSchema,

  // Global settings
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),

  // Quiet hours
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional(),
  quietHoursTimezone: z.string().optional(),

  // Digest preferences
  digestEnabled: z.boolean().default(false),
  digestFrequency: z.enum(['DAILY', 'WEEKLY']).default('DAILY'),
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default('09:00'),

  // Per-type preferences
  preferences: z.array(alertNotificationPreferenceItemSchema).optional(),

  // Categories to mute entirely
  mutedCategories: z.array(alertCategorySchema).optional(),

  ...timestampsSchema.shape,
});
export type AlertNotificationPreferences = z.infer<typeof alertNotificationPreferencesSchema>;

/**
 * Update alert notification preferences input
 */
export const updateAlertNotificationPreferencesSchema = alertNotificationPreferencesSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .partial();
export type UpdateAlertNotificationPreferences = z.infer<
  typeof updateAlertNotificationPreferencesSchema
>;
