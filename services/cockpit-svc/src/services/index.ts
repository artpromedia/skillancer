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
