/**
 * Handler exports for Notification Service
 */

export {
  registerWebhookRoutes,
  handleWebhook,
  createTestWebhookEvent,
  createTestWebhookBatch,
  type WebhookConfig,
} from './sendgrid-webhook.handler.js';

export {
  EmailEventTrigger,
  getEmailEventTrigger,
  initializeEmailEventTrigger,
  type EventPayload,
  type EventType,
  type UserRegisteredData,
  type ProposalCreatedData,
  type ProposalAcceptedData,
  type MessageReceivedData,
  type PaymentCompletedData,
  type ContractMilestoneData,
} from './email-event-trigger.handler.js';
