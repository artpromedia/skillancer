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
