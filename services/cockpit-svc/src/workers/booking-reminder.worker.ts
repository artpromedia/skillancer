// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/workers/booking-reminder
 * Booking Reminder Worker
 *
 * Background worker for sending booking reminders
 */

import { createLogger } from '@skillancer/logger';
import { Worker, Queue, type Job } from 'bullmq';

import { BookingRepository } from '../repositories/booking.repository.js';

import type { BookingReminderJob } from '../types/calendar.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';

const logger = createLogger({ name: 'booking-reminder-worker' });

export interface ReminderResult {
  success: boolean;
  bookingId: string;
  reminderType: 'host' | 'guest';
  error?: string;
}

export interface BookingReminderWorkerConfig {
  redisConnection: {
    host: string;
    port: number;
    password?: string;
  };
  queueName?: string;
  concurrency?: number;
  notificationService?: NotificationServiceInterface;
}

interface NotificationServiceInterface {
  sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export class BookingReminderWorker {
  private readonly queue: Queue<BookingReminderJob>;
  private readonly worker: Worker<BookingReminderJob, ReminderResult>;
  private readonly bookingRepo: BookingRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: BookingReminderWorkerConfig
  ) {
    const queueName = config.queueName ?? 'booking-reminders';

    this.bookingRepo = new BookingRepository(prisma);

    // Create queue
    this.queue = new Queue<BookingReminderJob>(queueName, {
      connection: config.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });

    // Create worker
    this.worker = new Worker<BookingReminderJob, ReminderResult>(
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
          bookingId: result.bookingId,
          reminderType: result.reminderType,
        },
        'Booking reminder sent'
      );
    });

    this.worker.on('failed', (job, error) => {
      logger.error(
        {
          jobId: job?.id,
          bookingId: job?.data.bookingId,
          error: error.message,
        },
        'Booking reminder failed'
      );
    });

    this.worker.on('error', (error) => {
      logger.error({ error: error.message }, 'Worker error');
    });
  }

  /**
   * Process a reminder job
   */
  private async processJob(job: Job<BookingReminderJob>): Promise<ReminderResult> {
    const { bookingId, type: reminderType, minutes } = job.data;
    const hoursBeforeStart = Math.round(minutes / 60);

    logger.info(
      {
        jobId: job.id,
        bookingId,
        reminderType,
        hoursBeforeStart,
      },
      'Processing booking reminder'
    );

    try {
      const booking = await this.bookingRepo.findByIdWithDetails(bookingId);

      if (!booking) {
        return {
          success: false,
          bookingId,
          reminderType,
          error: 'Booking not found',
        };
      }

      // Check if booking is still valid
      if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
        return {
          success: false,
          bookingId,
          reminderType,
          error: `Booking status is ${booking.status}`,
        };
      }

      // Check if booking hasn't passed
      if (new Date(booking.startTime) < new Date()) {
        return {
          success: false,
          bookingId,
          reminderType,
          error: 'Booking has already started',
        };
      }

      // Send reminder based on type
      if (reminderType === 'host') {
        await this.sendHostReminder(booking, hoursBeforeStart);
      } else {
        await this.sendGuestReminder(booking, hoursBeforeStart);
      }

      // Mark reminder as sent
      await this.bookingRepo.markReminderSent(bookingId);

      return {
        success: true,
        bookingId,
        reminderType,
      };
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          bookingId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Reminder processing error'
      );

      return {
        success: false,
        bookingId,
        reminderType,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send reminder to host
   */
  private async sendHostReminder(
    booking: Awaited<ReturnType<typeof this.bookingRepo.findByIdWithDetails>>,
    hoursBeforeStart: number
  ): Promise<void> {
    if (!booking || !this.config.notificationService) return;

    const hostEmail = booking.user?.email;
    if (!hostEmail) return;

    await this.config.notificationService.sendEmail({
      to: hostEmail,
      subject: `Reminder: ${booking.bookingLink?.name ?? 'Meeting'} with ${booking.bookerName} in ${hoursBeforeStart} hours`,
      template: 'booking-reminder-host',
      data: {
        hostName: `${booking.user?.firstName ?? ''} ${booking.user?.lastName ?? ''}`.trim(),
        guestName: booking.bookerName,
        guestEmail: booking.bookerEmail,
        eventName: booking.bookingLink?.name ?? 'Meeting',
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        meetingUrl: booking.meetingUrl,
        location: booking.bookingLink?.locationDetails,
        hoursBeforeStart,
      },
    });
  }

  /**
   * Send reminder to guest
   */
  private async sendGuestReminder(
    booking: Awaited<ReturnType<typeof this.bookingRepo.findByIdWithDetails>>,
    hoursBeforeStart: number
  ): Promise<void> {
    if (!booking || !this.config.notificationService) return;

    const hostName = `${booking.user?.firstName ?? ''} ${booking.user?.lastName ?? ''}`.trim();

    await this.config.notificationService.sendEmail({
      to: booking.bookerEmail,
      subject: `Reminder: ${booking.bookingLink?.name ?? 'Meeting'} with ${hostName} in ${hoursBeforeStart} hours`,
      template: 'booking-reminder-guest',
      data: {
        guestName: booking.bookerName,
        hostName,
        eventName: booking.bookingLink?.name ?? 'Meeting',
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        meetingUrl: booking.meetingUrl,
        location: booking.bookingLink?.locationDetails,
        cancelUrl: `${process.env.BASE_URL}/book/cancel/${booking.id}`,
        hoursBeforeStart,
      },
    });
  }

  /**
   * Schedule a reminder for a booking
   */
  async scheduleReminder(
    bookingId: string,
    reminderType: 'host' | 'guest',
    scheduledFor: Date,
    hoursBeforeStart: number
  ): Promise<string> {
    const delay = scheduledFor.getTime() - Date.now();

    if (delay <= 0) {
      logger.warn(
        {
          bookingId,
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
        bookingId,
        type: reminderType,
        minutes: hoursBeforeStart * 60,
      },
      {
        delay,
        jobId: `reminder-${bookingId}-${reminderType}-${hoursBeforeStart}h`,
      }
    );

    logger.info(
      {
        jobId: job.id,
        bookingId,
        reminderType,
        hoursBeforeStart,
        scheduledFor,
      },
      'Scheduled booking reminder'
    );

    return job.id ?? '';
  }

  /**
   * Schedule all reminders for a booking based on booking link settings
   */
  async scheduleBookingReminders(
    bookingId: string,
    startTime: Date,
    reminderHours: number[],
    sendReminders: boolean
  ): Promise<void> {
    if (!sendReminders) return;

    for (const hours of reminderHours) {
      const reminderTime = new Date(startTime.getTime() - hours * 60 * 60 * 1000);

      // Schedule host reminder
      await this.scheduleReminder(bookingId, 'host', reminderTime, hours);

      // Schedule guest reminder
      await this.scheduleReminder(bookingId, 'guest', reminderTime, hours);
    }
  }

  /**
   * Cancel all reminders for a booking
   */
  async cancelBookingReminders(bookingId: string): Promise<void> {
    // Get all jobs for this booking and remove them
    const jobs = await this.queue.getJobs(['delayed', 'waiting']);

    for (const job of jobs) {
      if (job.data.bookingId === bookingId) {
        await job.remove();
        logger.info(
          {
            jobId: job.id,
            bookingId,
          },
          'Cancelled reminder'
        );
      }
    }
  }

  /**
   * Start the worker
   */
  start(): void {
    logger.info('Booking reminder worker started');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    logger.info('Booking reminder worker stopped');
  }

  /**
   * Get queue for external access
   */
  getQueue(): Queue<BookingReminderJob> {
    return this.queue;
  }
}

export default BookingReminderWorker;

