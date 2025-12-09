/**
 * @module @skillancer/service-client/events
 * Domain event type definitions for event-driven architecture
 */

/**
 * Base domain event interface
 */
export interface DomainEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type identifier */
  type: string;
  /** Event payload */
  payload: T;
  /** ISO timestamp when event occurred */
  timestamp: string;
  /** Aggregate ID this event belongs to */
  aggregateId: string;
  /** Aggregate type (e.g., 'Job', 'Contract', 'User') */
  aggregateType: string;
  /** User who triggered the event */
  userId?: string | undefined;
  /** Correlation ID for distributed tracing */
  correlationId?: string | undefined;
  /** Causation ID (ID of event that caused this one) */
  causationId?: string | undefined;
  /** Event schema version */
  version: number;
  /** Additional metadata */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Event type constants organized by domain
 */
export const EventTypes = {
  // User domain events
  User: {
    CREATED: 'user.created',
    UPDATED: 'user.updated',
    DELETED: 'user.deleted',
    EMAIL_VERIFIED: 'user.email_verified',
    PASSWORD_CHANGED: 'user.password_changed',
    PROFILE_COMPLETED: 'user.profile_completed',
    SUSPENDED: 'user.suspended',
    REACTIVATED: 'user.reactivated',
  },

  // Job domain events
  Job: {
    CREATED: 'job.created',
    UPDATED: 'job.updated',
    PUBLISHED: 'job.published',
    CLOSED: 'job.closed',
    CANCELLED: 'job.cancelled',
    EXPIRED: 'job.expired',
    FEATURED: 'job.featured',
    VIEWED: 'job.viewed',
  },

  // Bid domain events
  Bid: {
    SUBMITTED: 'bid.submitted',
    UPDATED: 'bid.updated',
    ACCEPTED: 'bid.accepted',
    REJECTED: 'bid.rejected',
    WITHDRAWN: 'bid.withdrawn',
    SHORTLISTED: 'bid.shortlisted',
  },

  // Contract domain events
  Contract: {
    CREATED: 'contract.created',
    ACTIVATED: 'contract.activated',
    PAUSED: 'contract.paused',
    RESUMED: 'contract.resumed',
    COMPLETED: 'contract.completed',
    CANCELLED: 'contract.cancelled',
    DISPUTED: 'contract.disputed',
    DISPUTE_RESOLVED: 'contract.dispute_resolved',
  },

  // Milestone domain events
  Milestone: {
    CREATED: 'milestone.created',
    STARTED: 'milestone.started',
    SUBMITTED: 'milestone.submitted',
    APPROVED: 'milestone.approved',
    REJECTED: 'milestone.rejected',
    REVISION_REQUESTED: 'milestone.revision_requested',
  },

  // SkillPod domain events
  SkillPod: {
    CREATED: 'skillpod.created',
    STARTED: 'skillpod.started',
    STOPPED: 'skillpod.stopped',
    TERMINATED: 'skillpod.terminated',
    ERROR: 'skillpod.error',
    SCALED: 'skillpod.scaled',
  },

  // Session domain events
  Session: {
    STARTED: 'session.started',
    ENDED: 'session.ended',
    PAUSED: 'session.paused',
    RESUMED: 'session.resumed',
    TIMEOUT: 'session.timeout',
  },

  // Payment domain events
  Payment: {
    INITIATED: 'payment.initiated',
    PROCESSING: 'payment.processing',
    COMPLETED: 'payment.completed',
    FAILED: 'payment.failed',
    REFUNDED: 'payment.refunded',
    DISPUTED: 'payment.disputed',
  },

  // Escrow domain events
  Escrow: {
    CREATED: 'escrow.created',
    FUNDED: 'escrow.funded',
    RELEASED: 'escrow.released',
    DISPUTED: 'escrow.disputed',
    REFUNDED: 'escrow.refunded',
  },

  // Invoice domain events
  Invoice: {
    CREATED: 'invoice.created',
    SENT: 'invoice.sent',
    VIEWED: 'invoice.viewed',
    PAID: 'invoice.paid',
    OVERDUE: 'invoice.overdue',
    CANCELLED: 'invoice.cancelled',
  },

  // Payout domain events
  Payout: {
    REQUESTED: 'payout.requested',
    PROCESSING: 'payout.processing',
    COMPLETED: 'payout.completed',
    FAILED: 'payout.failed',
  },

  // Notification domain events
  Notification: {
    SENT: 'notification.sent',
    DELIVERED: 'notification.delivered',
    READ: 'notification.read',
    FAILED: 'notification.failed',
  },

  // Review domain events
  Review: {
    SUBMITTED: 'review.submitted',
    UPDATED: 'review.updated',
    PUBLISHED: 'review.published',
    FLAGGED: 'review.flagged',
    REMOVED: 'review.removed',
  },

  // Message domain events
  Message: {
    SENT: 'message.sent',
    DELIVERED: 'message.delivered',
    READ: 'message.read',
    DELETED: 'message.deleted',
  },

  // System events
  System: {
    SERVICE_STARTED: 'system.service_started',
    SERVICE_STOPPED: 'system.service_stopped',
    HEALTH_CHECK: 'system.health_check',
    ERROR: 'system.error',
    WARNING: 'system.warning',
  },
} as const;

/**
 * Extract all event types as a union type
 */
type ExtractEventTypes<T> =
  T extends Record<string, string>
    ? T[keyof T]
    : T extends Record<string, Record<string, string>>
      ? {
          [K in keyof T]: T[K][keyof T[K]];
        }[keyof T]
      : never;

export type EventType = ExtractEventTypes<typeof EventTypes>;

// ============================================================================
// Event Payload Types
// ============================================================================

// User events
export interface UserCreatedPayload {
  id: string;
  email: string;
  userType: 'freelancer' | 'client';
  createdAt: string;
}

export interface UserUpdatedPayload {
  id: string;
  changes: Record<string, unknown>;
  updatedAt: string;
}

export interface UserEmailVerifiedPayload {
  id: string;
  email: string;
  verifiedAt: string;
}

// Job events
export interface JobCreatedPayload {
  id: string;
  clientId: string;
  title: string;
  category: string;
  budget: {
    type: 'fixed' | 'hourly';
    amount: number;
    currency: string;
  };
  skills: string[];
}

export interface JobPublishedPayload {
  id: string;
  clientId: string;
  publishedAt: string;
  expiresAt: string;
}

export interface JobClosedPayload {
  id: string;
  reason: 'filled' | 'cancelled' | 'expired';
  closedAt: string;
}

// Bid events
export interface BidSubmittedPayload {
  id: string;
  jobId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  deliveryTime: number;
  proposal: string;
}

export interface BidAcceptedPayload {
  id: string;
  jobId: string;
  freelancerId: string;
  clientId: string;
  acceptedAt: string;
}

// Contract events
export interface ContractCreatedPayload {
  id: string;
  jobId: string;
  bidId: string;
  clientId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate?: string;
}

export interface ContractCompletedPayload {
  id: string;
  clientId: string;
  freelancerId: string;
  completedAt: string;
  totalPaid: number;
  rating?: number;
}

// SkillPod events
export interface SkillPodCreatedPayload {
  id: string;
  userId: string;
  templateId: string;
  config: Record<string, unknown>;
}

export interface SkillPodStartedPayload {
  id: string;
  userId: string;
  startedAt: string;
  accessUrl: string;
}

export interface SkillPodStoppedPayload {
  id: string;
  userId: string;
  stoppedAt: string;
  reason: 'manual' | 'timeout' | 'error' | 'completed';
  duration: number;
}

// Payment events
export interface PaymentCompletedPayload {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  completedAt: string;
  transactionId: string;
}

export interface PaymentFailedPayload {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
  failedAt: string;
}

// Escrow events
export interface EscrowCreatedPayload {
  id: string;
  contractId: string;
  clientId: string;
  freelancerId: string;
  amount: number;
  currency: string;
}

export interface EscrowReleasedPayload {
  id: string;
  contractId: string;
  freelancerId: string;
  amount: number;
  releasedAt: string;
}

// Notification events
export interface NotificationSentPayload {
  id: string;
  userId: string;
  type: 'email' | 'push' | 'sms' | 'in_app';
  template: string;
  sentAt: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

/**
 * Event subscription options
 */
export interface SubscriptionOptions {
  /** Queue name for load balancing (same queue = one consumer gets it) */
  queue?: string;
  /** Whether to acknowledge automatically after handler completes */
  autoAck?: boolean;
  /** Max retries on handler failure */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Channel/topic names for pub/sub
 */
export const EventChannels = {
  // Domain channels
  USERS: 'events:users',
  JOBS: 'events:jobs',
  BIDS: 'events:bids',
  CONTRACTS: 'events:contracts',
  SKILLPODS: 'events:skillpods',
  PAYMENTS: 'events:payments',
  NOTIFICATIONS: 'events:notifications',
  REVIEWS: 'events:reviews',

  // Cross-cutting channels
  ALL: 'events:*',
  SYSTEM: 'events:system',
  AUDIT: 'events:audit',
} as const;

export type EventChannel = (typeof EventChannels)[keyof typeof EventChannels];
