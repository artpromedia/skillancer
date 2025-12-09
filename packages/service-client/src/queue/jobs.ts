/**
 * @module @skillancer/service-client/queue
 * Job type definitions for async messaging
 */

import type { JobEnvelope, QueueName } from './manager.js';

// ============================================================================
// Job Processing Queue Jobs
// ============================================================================

export interface CreateJobData {
  jobId: string;
  clientId: string;
  title: string;
  description: string;
  budget: {
    type: 'fixed' | 'hourly';
    min?: number;
    max?: number;
    rate?: number;
  };
  skills: string[];
}

export interface UpdateJobStatusData {
  jobId: string;
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  reason?: string;
}

export interface JobMatchingData {
  jobId: string;
  skills: string[];
  budget: number;
  location?: string;
}

// ============================================================================
// Bid Notification Queue Jobs
// ============================================================================

export interface NewBidNotificationData {
  bidId: string;
  jobId: string;
  freelancerId: string;
  clientId: string;
  amount: number;
  currency: string;
}

export interface BidAcceptedData {
  bidId: string;
  jobId: string;
  freelancerId: string;
  clientId: string;
}

export interface BidRejectedData {
  bidId: string;
  jobId: string;
  freelancerId: string;
  reason?: string;
}

// ============================================================================
// Contract Lifecycle Queue Jobs
// ============================================================================

export interface CreateContractData {
  contractId: string;
  jobId: string;
  bidId: string;
  clientId: string;
  freelancerId: string;
  terms: {
    startDate: string;
    endDate?: string;
    budget: number;
    milestones?: Array<{
      title: string;
      amount: number;
      dueDate: string;
    }>;
  };
}

export interface ContractStatusChangeData {
  contractId: string;
  oldStatus: string;
  newStatus: string;
  triggeredBy: string;
  reason?: string;
}

export interface MilestoneCompletedData {
  contractId: string;
  milestoneId: string;
  freelancerId: string;
  clientId: string;
  amount: number;
}

// ============================================================================
// SkillPod Queue Jobs
// ============================================================================

export interface ProvisionPodData {
  podId: string;
  userId: string;
  templateId: string;
  config: {
    cpu?: number;
    memory?: number;
    storage?: number;
    environment?: Record<string, string>;
  };
}

export interface CleanupPodData {
  podId: string;
  userId: string;
  reason: 'timeout' | 'manual' | 'error' | 'completed';
  preserveData?: boolean;
}

export interface SessionStartData {
  sessionId: string;
  podId: string;
  userId: string;
  duration?: number;
}

export interface SessionEndData {
  sessionId: string;
  podId: string;
  userId: string;
  duration: number;
  reason: 'completed' | 'timeout' | 'error' | 'manual';
}

// ============================================================================
// Payment Processing Queue Jobs
// ============================================================================

export interface ProcessPaymentData {
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'card' | 'bank' | 'wallet';
  metadata?: Record<string, string>;
}

export interface RefundPaymentData {
  paymentId: string;
  originalPaymentId: string;
  amount: number;
  reason: string;
}

export interface PaymentWebhookData {
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string;
}

// ============================================================================
// Escrow Management Queue Jobs
// ============================================================================

export interface CreateEscrowData {
  escrowId: string;
  contractId: string;
  clientId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  milestoneId?: string;
}

export interface ReleaseEscrowData {
  escrowId: string;
  contractId: string;
  freelancerId: string;
  amount: number;
  releasedBy: string;
}

export interface DisputeEscrowData {
  escrowId: string;
  contractId: string;
  disputedBy: string;
  reason: string;
  evidence?: string[];
}

// ============================================================================
// Invoice Generation Queue Jobs
// ============================================================================

export interface GenerateInvoiceData {
  invoiceId: string;
  contractId: string;
  clientId: string;
  freelancerId: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  dueDate: string;
}

export interface SendInvoiceReminderData {
  invoiceId: string;
  clientId: string;
  daysOverdue: number;
  reminderCount: number;
}

// ============================================================================
// Payout Processing Queue Jobs
// ============================================================================

export interface ProcessPayoutData {
  payoutId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  method: 'bank' | 'paypal' | 'wise';
  destination: Record<string, string>;
}

export interface PayoutBatchData {
  batchId: string;
  payouts: Array<{
    freelancerId: string;
    amount: number;
    currency: string;
  }>;
  scheduledAt?: string;
}

// ============================================================================
// Email Queue Jobs
// ============================================================================

export interface SendEmailData {
  to: string | string[];
  templateId: string;
  variables: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
  scheduledAt?: string;
}

export interface BulkEmailData {
  campaignId: string;
  recipients: Array<{
    email: string;
    variables: Record<string, unknown>;
  }>;
  templateId: string;
  batchSize?: number;
}

// ============================================================================
// Push Notification Queue Jobs
// ============================================================================

export interface SendPushData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export interface BulkPushData {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ============================================================================
// SMS Queue Jobs
// ============================================================================

export interface SendSmsData {
  to: string;
  message: string;
  priority?: 'high' | 'normal';
}

// ============================================================================
// Analytics Queue Jobs
// ============================================================================

export interface TrackEventData {
  eventName: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, unknown>;
  timestamp?: number;
}

export interface AggregateMetricsData {
  metricType: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
}

// ============================================================================
// Report Generation Queue Jobs
// ============================================================================

export interface GenerateReportData {
  reportId: string;
  type: string;
  userId: string;
  parameters: Record<string, unknown>;
  format: 'pdf' | 'csv' | 'excel';
}

// ============================================================================
// User Lifecycle Queue Jobs
// ============================================================================

export interface UserOnboardingData {
  userId: string;
  email: string;
  userType: 'freelancer' | 'client';
  step: 'welcome' | 'profile' | 'verification' | 'complete';
}

export interface ProfileVerificationData {
  userId: string;
  verificationType: 'identity' | 'portfolio' | 'skills' | 'background';
  documents?: string[];
}

// ============================================================================
// Job Name Constants
// ============================================================================

export const JobNames = {
  // Job processing
  CREATE_JOB: 'create-job',
  UPDATE_JOB_STATUS: 'update-job-status',
  MATCH_FREELANCERS: 'match-freelancers',

  // Bids
  NEW_BID_NOTIFICATION: 'new-bid-notification',
  BID_ACCEPTED: 'bid-accepted',
  BID_REJECTED: 'bid-rejected',

  // Contracts
  CREATE_CONTRACT: 'create-contract',
  CONTRACT_STATUS_CHANGE: 'contract-status-change',
  MILESTONE_COMPLETED: 'milestone-completed',

  // SkillPod
  PROVISION_POD: 'provision-pod',
  CLEANUP_POD: 'cleanup-pod',
  START_SESSION: 'start-session',
  END_SESSION: 'end-session',

  // Payments
  PROCESS_PAYMENT: 'process-payment',
  REFUND_PAYMENT: 'refund-payment',
  PAYMENT_WEBHOOK: 'payment-webhook',

  // Escrow
  CREATE_ESCROW: 'create-escrow',
  RELEASE_ESCROW: 'release-escrow',
  DISPUTE_ESCROW: 'dispute-escrow',

  // Invoices
  GENERATE_INVOICE: 'generate-invoice',
  SEND_INVOICE_REMINDER: 'send-invoice-reminder',

  // Payouts
  PROCESS_PAYOUT: 'process-payout',
  PAYOUT_BATCH: 'payout-batch',

  // Notifications
  SEND_EMAIL: 'send-email',
  BULK_EMAIL: 'bulk-email',
  SEND_PUSH: 'send-push',
  BULK_PUSH: 'bulk-push',
  SEND_SMS: 'send-sms',

  // Analytics
  TRACK_EVENT: 'track-event',
  AGGREGATE_METRICS: 'aggregate-metrics',

  // Reports
  GENERATE_REPORT: 'generate-report',

  // User lifecycle
  USER_ONBOARDING: 'user-onboarding',
  PROFILE_VERIFICATION: 'profile-verification',
} as const;

export type JobName = (typeof JobNames)[keyof typeof JobNames];

// ============================================================================
// Type-safe job dispatch helpers
// ============================================================================

/**
 * Type mapping for queue names to their job data types
 */
export interface QueueJobMap {
  'job-processing': CreateJobData | UpdateJobStatusData | JobMatchingData;
  'bid-notifications': NewBidNotificationData | BidAcceptedData | BidRejectedData;
  'contract-lifecycle': CreateContractData | ContractStatusChangeData | MilestoneCompletedData;
  'pod-provisioning': ProvisionPodData;
  'pod-cleanup': CleanupPodData;
  'session-management': SessionStartData | SessionEndData;
  'payment-processing': ProcessPaymentData | RefundPaymentData | PaymentWebhookData;
  'escrow-management': CreateEscrowData | ReleaseEscrowData | DisputeEscrowData;
  'invoice-generation': GenerateInvoiceData | SendInvoiceReminderData;
  'payout-processing': ProcessPayoutData | PayoutBatchData;
  'email-queue': SendEmailData | BulkEmailData;
  'push-queue': SendPushData | BulkPushData;
  'sms-queue': SendSmsData;
  'analytics-events': TrackEventData | AggregateMetricsData;
  'report-generation': GenerateReportData;
  'user-onboarding': UserOnboardingData;
  'profile-verification': ProfileVerificationData;
}

export type { JobEnvelope, QueueName };
