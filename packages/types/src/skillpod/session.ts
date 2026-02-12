/**
 * @skillancer/types - SkillPod: Session Types
 * VDI session tracking and activity monitoring schemas
 */

import { z } from 'zod';

import { uuidSchema, dateSchema, timestampsSchema } from '../common/base';

// =============================================================================
// Pod Session Enums
// =============================================================================

/**
 * Pod session status
 */
export const podSessionStatusSchema = z.enum([
  'CONNECTING',
  'ACTIVE',
  'IDLE',
  'DISCONNECTED',
  'ENDED',
  'TIMED_OUT',
  'ERROR',
]);
export type PodSessionStatus = z.infer<typeof podSessionStatusSchema>;

/**
 * Connection protocol
 */
export const connectionProtocolSchema = z.enum(['WEBRTC', 'RDP', 'VNC', 'SSH', 'SPICE']);
export type ConnectionProtocol = z.infer<typeof connectionProtocolSchema>;

/**
 * Activity level categories
 */
export const activityLevelSchema = z.enum([
  'HIGH', // 80-100%
  'MEDIUM', // 50-79%
  'LOW', // 20-49%
  'IDLE', // <20%
  'AWAY', // No activity detected
]);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

// =============================================================================
// Session Sub-schemas
// =============================================================================

/**
 * Session connection info
 */
export const sessionConnectionSchema = z.object({
  protocol: connectionProtocolSchema,
  clientIp: z.string().ip().optional(),
  clientUserAgent: z.string().optional(),
  clientDevice: z.enum(['DESKTOP', 'TABLET', 'MOBILE', 'UNKNOWN']).default('UNKNOWN'),
  clientOs: z.string().optional(),
  clientBrowser: z.string().optional(),

  // Connection quality
  latencyMs: z.number().int().nonnegative().optional(),
  bandwidthMbps: z.number().nonnegative().optional(),
  packetLossPercent: z.number().min(0).max(100).optional(),
  resolution: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  fps: z.number().int().positive().optional(),
});
export type SessionConnection = z.infer<typeof sessionConnectionSchema>;

/**
 * Activity snapshot (periodic capture)
 */
export const activitySnapshotSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  timestamp: dateSchema,

  // Activity metrics
  keystrokes: z.number().int().nonnegative().default(0),
  mouseClicks: z.number().int().nonnegative().default(0),
  mouseMovements: z.number().int().nonnegative().default(0),
  scrollEvents: z.number().int().nonnegative().default(0),

  // Activity score (0-100)
  activityScore: z.number().int().min(0).max(100),
  activityLevel: activityLevelSchema,

  // Screenshot (if enabled)
  screenshotUrl: z.string().url().optional(),
  screenshotThumbnailUrl: z.string().url().optional(),
  screenshotBlurredUrl: z.string().url().optional(), // Privacy option

  // Active applications (if tracking enabled)
  activeWindow: z.string().optional(),
  activeApplication: z.string().optional(),

  // System metrics
  cpuUsagePercent: z.number().min(0).max(100).optional(),
  memoryUsagePercent: z.number().min(0).max(100).optional(),
  networkUsageMbps: z.number().nonnegative().optional(),
});
export type ActivitySnapshot = z.infer<typeof activitySnapshotSchema>;

/**
 * Session time entry for billing
 */
export const sessionTimeEntrySchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  startTime: dateSchema,
  endTime: dateSchema,
  durationMinutes: z.number().int().positive(),

  // Activity summary
  averageActivityScore: z.number().int().min(0).max(100),
  activityLevel: activityLevelSchema,

  // Billing
  hourlyRate: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  approved: z.boolean().default(false),
  approvedAt: dateSchema.optional(),
  approvedByUserId: uuidSchema.optional(),
});
export type SessionTimeEntry = z.infer<typeof sessionTimeEntrySchema>;

// =============================================================================
// Main Pod Session Schema
// =============================================================================

/**
 * Complete pod session schema
 */
export const podSessionSchema = z.object({
  id: uuidSchema,

  // Context
  podId: uuidSchema,
  userId: uuidSchema,
  tenantId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),

  // Status
  status: podSessionStatusSchema,
  statusMessage: z.string().max(500).optional(),

  // Connection
  connection: sessionConnectionSchema,

  // Timing
  startedAt: dateSchema,
  endedAt: dateSchema.optional(),
  lastActivityAt: dateSchema.optional(),
  lastHeartbeatAt: dateSchema.optional(),

  // Duration
  totalDurationMinutes: z.number().int().nonnegative().default(0),
  activeDurationMinutes: z.number().int().nonnegative().default(0),
  idleDurationMinutes: z.number().int().nonnegative().default(0),

  // Activity summary
  averageActivityScore: z.number().int().min(0).max(100).optional(),
  activityLevel: activityLevelSchema.optional(),
  totalSnapshots: z.number().int().nonnegative().default(0),

  // Aggregated metrics
  totalKeystrokes: z.number().int().nonnegative().default(0),
  totalMouseClicks: z.number().int().nonnegative().default(0),

  // Time entries (for billing)
  timeEntries: z.array(sessionTimeEntrySchema).optional(),

  // Billing
  hourlyRate: z.number().nonnegative().optional(),
  totalCost: z.number().nonnegative().default(0),
  billableMinutes: z.number().int().nonnegative().default(0),

  // End reason
  endReason: z
    .enum([
      'USER_ENDED',
      'IDLE_TIMEOUT',
      'MAX_DURATION',
      'POD_STOPPED',
      'CONNECTION_LOST',
      'ERROR',
      'ADMIN_TERMINATED',
    ])
    .optional(),

  ...timestampsSchema.shape,
});
export type PodSession = z.infer<typeof podSessionSchema>;

// =============================================================================
// Pod Session CRUD Schemas
// =============================================================================

/**
 * Start pod session input
 */
export const startPodSessionSchema = z.object({
  podId: uuidSchema,
  contractId: uuidSchema.optional(),
  protocol: connectionProtocolSchema.default('WEBRTC'),
  resolution: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
});
export type StartPodSession = z.infer<typeof startPodSessionSchema>;

/**
 * Pod session heartbeat input
 */
export const podSessionHeartbeatSchema = z.object({
  sessionId: uuidSchema,
  activityScore: z.number().int().min(0).max(100),
  latencyMs: z.number().int().nonnegative().optional(),
  cpuUsagePercent: z.number().min(0).max(100).optional(),
  memoryUsagePercent: z.number().min(0).max(100).optional(),
});
export type PodSessionHeartbeat = z.infer<typeof podSessionHeartbeatSchema>;

/**
 * End pod session input
 */
export const endPodSessionSchema = z.object({
  sessionId: uuidSchema,
  reason: z.enum(['USER_ENDED', 'IDLE_TIMEOUT', 'MAX_DURATION', 'ERROR']).optional(),
});
export type EndPodSession = z.infer<typeof endPodSessionSchema>;

/**
 * Pod session filter parameters
 */
export const podSessionFilterSchema = z.object({
  podId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  status: z.array(podSessionStatusSchema).optional(),
  startDateFrom: dateSchema.optional(),
  startDateTo: dateSchema.optional(),
  minDurationMinutes: z.number().int().nonnegative().optional(),
  maxDurationMinutes: z.number().int().nonnegative().optional(),
  activityLevel: z.array(activityLevelSchema).optional(),
});
export type PodSessionFilter = z.infer<typeof podSessionFilterSchema>;

// =============================================================================
// Pod Session Statistics Schema
// =============================================================================

/**
 * Aggregated pod session statistics
 */
export const podSessionStatsSchema = z.object({
  userId: uuidSchema.optional(),
  podId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),

  // Period
  periodStart: dateSchema,
  periodEnd: dateSchema,

  // Session counts
  totalSessions: z.number().int().nonnegative(),
  completedSessions: z.number().int().nonnegative(),

  // Time totals
  totalMinutes: z.number().int().nonnegative(),
  activeMinutes: z.number().int().nonnegative(),
  idleMinutes: z.number().int().nonnegative(),
  billableMinutes: z.number().int().nonnegative(),

  // Activity
  averageActivityScore: z.number().int().min(0).max(100),
  activityDistribution: z.object({
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    idle: z.number().int().nonnegative(),
  }),

  // Cost
  totalCost: z.number().nonnegative(),
});
export type PodSessionStats = z.infer<typeof podSessionStatsSchema>;
