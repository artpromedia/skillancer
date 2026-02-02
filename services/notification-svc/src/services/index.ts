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
