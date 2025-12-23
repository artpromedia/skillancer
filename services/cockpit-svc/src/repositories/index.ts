/**
 * @module @skillancer/cockpit-svc/repositories
 * Repository exports for cockpit-svc
 */

// CRM Repositories
export { ClientRepository } from './client.repository.js';
export { ContactRepository } from './contact.repository.js';
export { InteractionRepository } from './interaction.repository.js';
export { OpportunityRepository } from './opportunity.repository.js';
export { OpportunityActivityRepository } from './opportunity-activity.repository.js';
export { ReminderRepository } from './reminder.repository.js';
export { DocumentRepository } from './document.repository.js';
export { CustomFieldRepository } from './custom-field.repository.js';

// Project Management Repositories
export { ProjectRepository } from './project.repository.js';
export { TaskRepository } from './task.repository.js';
export { MilestoneRepository } from './milestone.repository.js';
export { TimeEntryRepository } from './time-entry.repository.js';
export { ActivityRepository } from './activity.repository.js';
export { TemplateRepository } from './template.repository.js';
export { FileRepository } from './file.repository.js';

// Time Tracking Repositories
export { ComprehensiveTimeEntryRepository } from './comprehensive-time-entry.repository.js';
export { TimerRepository } from './timer.repository.js';
export { TimeSettingsRepository } from './time-settings.repository.js';
export { TimesheetRepository } from './timesheet.repository.js';
export { TimeCategoryRepository } from './time-category.repository.js';

// Calendar Integration Repositories
export { CalendarConnectionRepository } from './calendar-connection.repository.js';
export { ExternalCalendarRepository } from './external-calendar.repository.js';
export { CalendarEventRepository } from './calendar-event.repository.js';
export { AvailabilityScheduleRepository } from './availability-schedule.repository.js';
export { BookingLinkRepository } from './booking-link.repository.js';
export { BookingRepository } from './booking.repository.js';

// Financial Tracking Repositories
export { FinancialAccountRepository } from './financial-account.repository.js';
export { FinancialTransactionRepository } from './financial-transaction.repository.js';
export { TransactionCategoryRepository } from './transaction-category.repository.js';
export { RecurringTransactionRepository } from './recurring-transaction.repository.js';
export { FinancialGoalRepository } from './financial-goal.repository.js';
export { MileageLogRepository } from './mileage-log.repository.js';
export { TaxProfileRepository } from './tax-profile.repository.js';

// Invoice Repositories (CP-3.2: Professional Invoicing)
export { InvoiceRepository } from './invoice.repository.js';
export { InvoicePaymentRepository } from './invoice-payment.repository.js';
export { InvoiceTemplateRepository } from './invoice-template.repository.js';
export { RecurringInvoiceRepository } from './recurring-invoice.repository.js';
export { InvoiceActivityRepository } from './invoice-activity.repository.js';
export { InvoiceSettingsRepository } from './invoice-settings.repository.js';

// Integration Platform Repositories (CP-4.1: Integration Platform Architecture)
export { IntegrationRepository } from './integration.repository.js';
export { IntegrationMappingRepository } from './integration-mapping.repository.js';
export { IntegrationSyncLogRepository } from './integration-sync-log.repository.js';
export { WebhookEventRepository } from './webhook-event.repository.js';
export { IntegrationTemplateRepository } from './integration-template.repository.js';

// Market Contract Integration Repositories
export { MarketContractLinkRepository } from './market-contract-link.repository.js';
export { MarketMilestoneLinkRepository } from './market-milestone-link.repository.js';
export { MarketTimeLinkRepository } from './market-time-link.repository.js';
export { MarketPaymentLinkRepository } from './market-payment-link.repository.js';
export { MarketClientCacheRepository } from './market-client-cache.repository.js';

// Unified Financial Reporting Repositories
export { UnifiedTransactionRepository } from './unified-transaction.repository.js';
export { FinancialSummaryRepository } from './financial-summary.repository.js';
export { ClientProfitabilityRepository } from './client-profitability.repository.js';
export { PlatformPerformanceRepository } from './platform-performance.repository.js';
export { TaxSummaryRepository } from './tax-summary.repository.js';
export { SavedFinancialReportRepository } from './saved-financial-report.repository.js';

// Learning Time Tracking Repositories
export { LearningTimeEntryRepository } from './learning-time-entry.repository.js';
export { LearningGoalRepository } from './learning-goal.repository.js';
export { SkillLearningProgressRepository } from './skill-learning-progress.repository.js';

// Skill-Based Pricing Recommendation Repositories
export { SkillRateRepository } from './skill-rate.repository.js';
export { MarketRateBenchmarkRepository } from './market-benchmark.repository.js';
export { PricingRecommendationRepository } from './pricing-recommendation.repository.js';
export { RateHistoryRepository } from './rate-history.repository.js';
export { RevenueProjectionRepository } from './revenue-projection.repository.js';
