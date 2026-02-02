/**
 * Service exports for Notification Service
 */

export { EmailService } from './email.service.js';
export { PushService } from './push.service.js';
export { NotificationService } from './notification.service.js';

// Email Queue Service
export {
  EmailQueueService,
  getEmailQueueService,
  initializeEmailQueue,
  closeEmailQueue,
  type EmailJobData,
  type EmailJobResult,
  type QueueStats,
  type EmailJobPriority,
} from './email-queue.service.js';

// Email Logging Service
export {
  EmailLoggingService,
  getEmailLoggingService,
  type EmailEventType,
  type EmailLogEntry,
  type SendGridWebhookEvent,
  type EmailStats,
} from './email-logging.service.js';

// Email Digest Service
export {
  EmailDigestService,
  getEmailDigestService,
  initializeEmailDigestService,
  setupDigestCronJobs,
  type DigestConfig,
  type DigestNotification,
  type DigestSummary,
  type DigestResult,
  type DigestJobResult,
} from './email-digest.service.js';

// Push Notification Service
export {
  PushNotificationService,
  type PushNotificationInput,
  type BroadcastNotificationInput,
  type NotificationType,
  type PushSendResult,
} from './push-notification.service.js';

// Push Triggers Service
export {
  PushTriggersService,
  getPushTriggersService,
  type TriggerContext,
  type MessageTriggerData,
  type ProposalTriggerData,
  type PaymentTriggerData,
  type ContractTriggerData,
  type MilestoneTriggerData,
  type ReviewTriggerData,
  type SecurityTriggerData,
  type InviteTriggerData,
  type TriggerResult,
} from './push-triggers.service.js';
