/**
 * @module @skillancer/cockpit-svc/services
 * Service exports
 */

// CRM Services
export { ClientService } from './client.service.js';
export { ClientHealthScoreService } from './client-health-score.service.js';
export { ClientSearchService } from './client-search.service.js';
export { OpportunityService } from './opportunity.service.js';
export { ReminderService } from './reminder.service.js';
export { DocumentService } from './document.service.js';

// Project Management Services
export { ProjectService } from './project.service.js';
export { TaskService } from './task.service.js';
export { MilestoneService } from './milestone.service.js';
export { TimeEntryService } from './time-entry.service.js';
export { TemplateService } from './template.service.js';
export { WorkloadService } from './workload.service.js';

// Time Tracking Services
export { TimeTrackingService } from './time-tracking.service.js';

// Calendar Integration Services
export { CalendarService, type CalendarServiceConfig } from './calendar.service.js';
export { GoogleCalendarService, type GoogleCalendarConfig } from './google-calendar.service.js';
export {
  MicrosoftCalendarService,
  type MicrosoftCalendarConfig,
} from './microsoft-calendar.service.js';

// Financial Services (CP-3.1: Income & Expense Tracking)
export { FinancialAccountService } from './financial-account.service.js';
export { FinancialTransactionService } from './financial-transaction.service.js';
export { FinancialReportsService } from './financial-reports.service.js';
export { FinancialGoalService } from './financial-goal.service.js';
export { MileageService } from './mileage.service.js';
export { PlaidService } from './plaid.service.js';

// Invoice Services (CP-3.2: Professional Invoicing)
export { InvoiceService } from './invoice.service.js';
export { InvoiceTemplateService } from './invoice-template.service.js';
export { RecurringInvoiceService } from './recurring-invoice.service.js';
export { InvoicePaymentService } from './invoice-payment.service.js';
export { InvoiceSettingsService } from './invoice-settings.service.js';
export { InvoicePdfService } from './invoice-pdf.service.js';

// Integration Platform Services (CP-4.1: Integration Platform Architecture)
export { EncryptionService } from './encryption.service.js';
export { BaseIntegrationService } from './integrations/base-integration.service.js';
export type {
  RateLimitConfig,
  RateLimitedResponse,
  RetryConfig,
} from './integrations/base-integration.service.js';
export { IntegrationPlatformService } from './integrations/integration-platform.service.js';
