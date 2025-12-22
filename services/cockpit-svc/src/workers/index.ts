/**
 * @module @skillancer/cockpit-svc/workers
 * Worker exports
 */

// CRM Workers
export { HealthScoreWorker } from './health-score.worker.js';
export { ReminderWorker, type ReminderNotification } from './reminder.worker.js';
export { MarketSyncWorker } from './market-sync.worker.js';

// Project Management Workers
export { DeadlineReminderWorker, type DeadlineNotification } from './deadline-reminder.worker.js';
export { ProjectProgressWorker } from './project-progress.worker.js';

// Calendar Integration Workers
export { CalendarSyncWorker } from './calendar-sync.worker.js';
export { BookingReminderWorker } from './booking-reminder.worker.js';
export { EventReminderWorker } from './event-reminder.worker.js';

// Financial Workers (CP-3.1: Income & Expense Tracking)
export {
  RecurringTransactionWorker,
  type RecurringTransactionNotification,
} from './recurring-transaction.worker.js';

// Invoice Workers (CP-3.2: Professional Invoicing)
export { RecurringInvoiceWorker } from './recurring-invoice.worker.js';
export {
  InvoiceReminderWorker,
  type InvoiceReminderNotification,
} from './invoice-reminder.worker.js';
export { LateFeeWorker, type LateFeeNotification } from './late-fee.worker.js';

// Integration Platform Workers (CP-4.1: Integration Platform Architecture)
export {
  IntegrationSyncWorker,
  type IntegrationSyncWorkerConfig,
} from './integration-sync.worker.js';
export { WebhookProcessorWorker, type WebhookProcessorConfig } from './webhook-processor.worker.js';
