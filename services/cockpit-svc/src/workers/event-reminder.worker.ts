/**
 * @module @skillancer/cockpit-svc/workers/event-reminder
 * Event Reminder Worker
 *
 * Background worker for sending calendar event reminders
 */

import { createLogger } from '@skillancer/logger';
import { Worker, Queue, type Job } from 'bullmq';

import { CalendarEventRepository } from '../repositories/calendar-event.repository.js';

import type { EventReminderJob } from '../types/calendar.types.js';
import type { PrismaClient } from '@skillancer/database';

const logger = createLogger({ name: 'event-reminder-worker' });

export interface EventReminderResult {
  success: boolean;
  eventId: string;
  reminderType: 'email' | 'notification';
  error?: string;
}

export interface EventReminderWorkerConfig {
  redisConnection: {
    host: string;
    port: number;
    password?: string;
  };
  queueName?: string;
  concurrency?: number;
  notificationService?: NotificationServiceInterface;
  pushNotificationService?: PushNotificationServiceInterface;
}

interface NotificationServiceInterface {
  sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

interface PushNotificationServiceInterface {
  sendPush(params: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void>;
}

export class EventReminderWorker {
  private readonly queue: Queue<EventReminderJob>;
  private readonly worker: Worker<EventReminderJob, EventReminderResult>;
  private readonly eventRepo: CalendarEventRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: EventReminderWorkerConfig
  ) {
    const queueName = config.queueName ?? 'event-reminders';

    this.eventRepo = new CalendarEventRepository(prisma);

    // Create queue
    this.queue = new Queue<EventReminderJob>(queueName, {
      connection: config.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });

    // Create worker
    this.worker = new Worker<EventReminderJob, EventReminderResult>(
      queueName,
      async (job) => this.processJob(job),
      {
        connection: config.redisConnection,
        concurrency: config.concurrency ?? 10,
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result) => {
      logger.info(
        {
          jobId: job.id,
          eventId: result.eventId,
          reminderType: result.reminderType,
        },
        'Event reminder sent'
      );
    });

    this.worker.on('failed', (job, error) => {
      logger.error(
        {
          jobId: job?.id,
          eventId: job?.data.eventId,
          error: error.message,
        },
        'Event reminder failed'
      );
    });

    this.worker.on('error', (error) => {
      logger.error({ error: error.message }, 'Worker error');
    });
  }

  /**
   * Process a reminder job
   */
  private async processJob(job: Job<EventReminderJob>): Promise<EventReminderResult> {
    const { eventId, method, userId } = job.data;
    // Map method to reminder type
    const reminderType: 'email' | 'notification' = method === 'email' ? 'email' : 'notification';

    logger.info(
      {
        jobId: job.id,
        eventId,
        reminderType,
        userId,
      },
      'Processing event reminder'
    );

    try {
      const event = await this.eventRepo.findByIdWithDetails(eventId);

      if (!event) {
        return {
          success: false,
          eventId,
          reminderType,
          error: 'Event not found',
        };
      }

      // Check if event is still valid
      if (event.status === 'CANCELLED') {
        return {
          success: false,
          eventId,
          reminderType,
          error: 'Event is cancelled',
        };
      }

      // Check if event hasn't passed
      if (new Date(event.startTime) < new Date()) {
        return {
          success: false,
          eventId,
          reminderType,
          error: 'Event has already started',
        };
      }

      // Send reminder based on type
      if (reminderType === 'email') {
        await this.sendEmailReminder(event, userId);
      } else {
        await this.sendPushReminder(event, userId);
      }

      return {
        success: true,
        eventId,
        reminderType,
      };
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          eventId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Reminder processing error'
      );

      return {
        success: false,
        eventId,
        reminderType,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send email reminder
   */
  private async sendEmailReminder(
    event: Awaited<ReturnType<typeof this.eventRepo.findByIdWithDetails>>,
    _userId: string
  ): Promise<void> {
    if (!event || !this.config.notificationService) return;

    // Get user email - would need to join with user table
    // For now, this is a placeholder
    const userEmail = ''; // Would come from event.user.email

    if (!userEmail) return;

    // Calculate minutes until event
    const minutesUntil = Math.round((new Date(event.startTime).getTime() - Date.now()) / 60000);
    const timeLabel = formatMinutesLabel(minutesUntil);

    await this.config.notificationService.sendEmail({
      to: userEmail,
      subject: `Reminder: ${event.title} in ${timeLabel}`,
      template: 'event-reminder',
      data: {
        eventTitle: event.title,
        eventDescription: event.description,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        location: event.location,
        meetingUrl: event.meetingUrl,
        projectName: event.project?.name,
        clientName: event.client
          ? `${event.client.firstName} ${event.client.lastName}`.trim()
          : null,
        timeLabel,
      },
    });
  }

  /**
   * Send push notification reminder
   */
  private async sendPushReminder(
    event: Awaited<ReturnType<typeof this.eventRepo.findByIdWithDetails>>,
    userId: string
  ): Promise<void> {
    if (!event || !this.config.pushNotificationService) return;

    // Calculate minutes until event
    const minutesUntil = Math.round((new Date(event.startTime).getTime() - Date.now()) / 60000);
    const timeLabel = formatMinutesLabel(minutesUntil);

    await this.config.pushNotificationService.sendPush({
      userId: userId,
      title: `${event.title} in ${timeLabel}`,
      body: event.location ?? event.meetingUrl ?? 'Tap for details',
      data: {
        type: 'event_reminder',
        eventId: event.id,
        meetingUrl: event.meetingUrl,
      },
    });
  }

  /**
   * Schedule a reminder for an event
   */
  async scheduleReminder(
    eventId: string,
    reminderType: 'email' | 'notification',
    scheduledFor: Date,
    userId: string
  ): Promise<string> {
    const delay = scheduledFor.getTime() - Date.now();

    if (delay <= 0) {
      logger.warn(
        {
          eventId,
          reminderType,
          scheduledFor,
        },
        'Reminder time has passed, skipping'
      );
      return '';
    }

    const job = await this.queue.add(
      'reminder',
      {
        eventId,
        method: reminderType,
        userId,
      },
      {
        delay,
        jobId: `event-reminder-${eventId}-${reminderType}-${userId}`,
      }
    );

    logger.info(
      {
        jobId: job.id,
        eventId,
        reminderType,
        userId,
        scheduledFor,
      },
      'Scheduled event reminder'
    );

    return job.id ?? '';
  }

  /**
   * Schedule all reminders for an event based on its reminder settings
   */
  async scheduleEventReminders(
    eventId: string,
    userId: string,
    startTime: Date,
    reminders: Array<{ type: 'email' | 'notification'; minutesBefore: number }>
  ): Promise<void> {
    for (const reminder of reminders) {
      const reminderTime = new Date(startTime.getTime() - reminder.minutesBefore * 60 * 1000);

      await this.scheduleReminder(eventId, reminder.type, reminderTime, userId);
    }
  }

  /**
   * Cancel all reminders for an event
   */
  async cancelEventReminders(eventId: string): Promise<void> {
    const jobs = await this.queue.getJobs(['delayed', 'waiting']);

    for (const job of jobs) {
      if (job.data.eventId === eventId) {
        await job.remove();
        logger.info(
          {
            jobId: job.id,
            eventId,
          },
          'Cancelled event reminder'
        );
      }
    }
  }

  /**
   * Update reminders when event time changes
   */
  async updateEventReminders(
    eventId: string,
    userId: string,
    newStartTime: Date,
    reminders: Array<{ type: 'email' | 'notification'; minutesBefore: number }>
  ): Promise<void> {
    await this.cancelEventReminders(eventId);
    await this.scheduleEventReminders(eventId, userId, newStartTime, reminders);
  }

  /**
   * Start the worker
   */
  start(): void {
    logger.info('Event reminder worker started');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    logger.info('Event reminder worker stopped');
  }

  /**
   * Get queue for external access
   */
  getQueue(): Queue<EventReminderJob> {
    return this.queue;
  }
}

/**
 * Format minutes to human-readable label
 */
function formatMinutesLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    if (remainingMinutes === 0) {
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    }
    return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'} ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;
}

export default EventReminderWorker;
