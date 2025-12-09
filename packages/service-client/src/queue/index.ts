/**
 * @module @skillancer/service-client/queue
 * Queue barrel exports
 */

export {
  QueueManager,
  queueManager,
  QueueNames,
  type QueueName,
  type JobEnvelope,
  type JobProcessor,
  type BullJob,
  Queue,
  Worker,
  QueueEvents,
} from './manager.js';

export {
  JobNames,
  type JobName,
  type QueueJobMap,
  // Job data types
  type CreateJobData,
  type UpdateJobStatusData,
  type JobMatchingData,
  type NewBidNotificationData,
  type BidAcceptedData,
  type BidRejectedData,
  type CreateContractData,
  type ContractStatusChangeData,
  type MilestoneCompletedData,
  type ProvisionPodData,
  type CleanupPodData,
  type SessionStartData,
  type SessionEndData,
  type ProcessPaymentData,
  type RefundPaymentData,
  type PaymentWebhookData,
  type CreateEscrowData,
  type ReleaseEscrowData,
  type DisputeEscrowData,
  type GenerateInvoiceData,
  type SendInvoiceReminderData,
  type ProcessPayoutData,
  type PayoutBatchData,
  type SendEmailData,
  type BulkEmailData,
  type SendPushData,
  type BulkPushData,
  type SendSmsData,
  type TrackEventData,
  type AggregateMetricsData,
  type GenerateReportData,
  type UserOnboardingData,
  type ProfileVerificationData,
} from './jobs.js';
