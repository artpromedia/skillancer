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
