/**
 * @module @skillancer/cockpit-svc/services/reminder
 * Reminder Service - Manages client reminders and follow-ups
 */

import { CrmError, CrmErrorCode } from '../errors/crm.errors.js';
import { ReminderRepository, ClientRepository } from '../repositories/index.js';

import type {
  CreateReminderParams,
  UpdateReminderParams,
  ReminderSearchParams,
  ClientReminderSummary,
} from '../types/crm.types.js';
import type { PrismaClient, ReminderType, ReminderStatus } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Cache TTLs
const UPCOMING_REMINDERS_TTL = 60; // 1 minute
const OVERDUE_REMINDERS_TTL = 60; // 1 minute

export class ReminderService {
  private readonly reminderRepository: ReminderRepository;
  private readonly clientRepository: ClientRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.reminderRepository = new ReminderRepository(prisma);
    this.clientRepository = new ClientRepository(prisma);
  }

  /**
   * Create a reminder
   */
  async createReminder(params: CreateReminderParams) {
    // Validate client belongs to freelancer
    const client = await this.clientRepository.findById(params.clientId);
    if (!client || client.freelancerUserId !== params.freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    const reminder = await this.reminderRepository.create({
      freelancerUserId: params.freelancerUserId,
      clientId: params.clientId,
      title: params.title,
      description: params.description,
      reminderType: params.reminderType,
      dueAt: params.dueAt,
      isRecurring: params.isRecurring || false,
      recurrenceRule: params.recurrenceRule,
      notifyBefore: params.notifyBefore,
    });

    // Invalidate reminder caches
    await this.invalidateReminderCaches(params.freelancerUserId);

    this.logger.info(
      {
        reminderId: reminder.id,
        freelancerUserId: params.freelancerUserId,
        clientId: params.clientId,
        dueAt: reminder.dueAt,
      },
      'Reminder created'
    );

    return reminder;
  }

  /**
   * Get a reminder by ID
   */
  async getReminder(reminderId: string, freelancerUserId: string) {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      throw new CrmError(CrmErrorCode.REMINDER_NOT_FOUND);
    }

    if (reminder.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    return this.formatReminderSummary(reminder);
  }

  /**
   * Update a reminder
   */
  async updateReminder(
    reminderId: string,
    freelancerUserId: string,
    updates: UpdateReminderParams
  ) {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      throw new CrmError(CrmErrorCode.REMINDER_NOT_FOUND);
    }

    if (reminder.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    const updatedReminder = await this.reminderRepository.update(reminderId, {
      ...(updates.title && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.reminderType && { reminderType: updates.reminderType }),
      ...(updates.dueAt && { dueAt: updates.dueAt }),
      ...(updates.isRecurring !== undefined && { isRecurring: updates.isRecurring }),
      ...(updates.recurrenceRule !== undefined && { recurrenceRule: updates.recurrenceRule }),
      ...(updates.status && { status: updates.status }),
      ...(updates.completedAt !== undefined && { completedAt: updates.completedAt }),
      ...(updates.snoozedUntil !== undefined && { snoozedUntil: updates.snoozedUntil }),
      ...(updates.notifyBefore !== undefined && { notifyBefore: updates.notifyBefore }),
    });

    // Invalidate reminder caches
    await this.invalidateReminderCaches(freelancerUserId);

    this.logger.info({ reminderId }, 'Reminder updated');

    return updatedReminder;
  }

  /**
   * Mark a reminder as complete
   */
  async completeReminder(reminderId: string, freelancerUserId: string, _notes?: string) {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      throw new CrmError(CrmErrorCode.REMINDER_NOT_FOUND);
    }

    if (reminder.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    if (reminder.status === 'COMPLETED') {
      throw new CrmError(CrmErrorCode.REMINDER_COMPLETED);
    }

    const updatedReminder = await this.reminderRepository.update(reminderId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    // If recurring, create next reminder
    if (reminder.isRecurring && reminder.recurrenceRule) {
      await this.createNextRecurringReminder(reminder);
    }

    // Invalidate reminder caches
    await this.invalidateReminderCaches(freelancerUserId);

    this.logger.info({ reminderId, isRecurring: reminder.isRecurring }, 'Reminder completed');

    return updatedReminder;
  }

  /**
   * Snooze a reminder
   */
  async snoozeReminder(reminderId: string, freelancerUserId: string, snoozeUntil: Date) {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      throw new CrmError(CrmErrorCode.REMINDER_NOT_FOUND);
    }

    if (reminder.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    const updatedReminder = await this.reminderRepository.update(reminderId, {
      status: 'SNOOZED',
      snoozedUntil: snoozeUntil,
    });

    // Invalidate reminder caches
    await this.invalidateReminderCaches(freelancerUserId);

    this.logger.info({ reminderId, snoozedUntil: snoozeUntil }, 'Reminder snoozed');

    return updatedReminder;
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(reminderId: string, freelancerUserId: string) {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      throw new CrmError(CrmErrorCode.REMINDER_NOT_FOUND);
    }

    if (reminder.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    const updatedReminder = await this.reminderRepository.update(reminderId, {
      status: 'CANCELLED',
    });

    // Invalidate reminder caches
    await this.invalidateReminderCaches(freelancerUserId);

    this.logger.info({ reminderId }, 'Reminder cancelled');

    return updatedReminder;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(reminderId: string, freelancerUserId: string): Promise<void> {
    const reminder = await this.reminderRepository.findById(reminderId);
    if (!reminder) {
      throw new CrmError(CrmErrorCode.REMINDER_NOT_FOUND);
    }

    if (reminder.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.ACCESS_DENIED);
    }

    await this.reminderRepository.delete(reminderId);

    // Invalidate reminder caches
    await this.invalidateReminderCaches(freelancerUserId);

    this.logger.info({ reminderId }, 'Reminder deleted');
  }

  /**
   * Search reminders
   */
  async searchReminders(params: ReminderSearchParams): Promise<{
    reminders: ClientReminderSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { reminders, total } = await this.reminderRepository.findByFreelancer(
      params.freelancerUserId,
      params
    );

    return {
      reminders: reminders.map((r) => this.formatReminderSummary(r)),
      total,
      page: params.page || 1,
      limit: params.limit || 20,
    };
  }

  /**
   * Get upcoming reminders
   */
  async getUpcomingReminders(
    freelancerUserId: string,
    days: number = 7
  ): Promise<ClientReminderSummary[]> {
    // Try cache first
    const cacheKey = `reminders:upcoming:${freelancerUserId}:${days}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ClientReminderSummary[];
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const { reminders } = await this.reminderRepository.findByFreelancer(freelancerUserId, {
      freelancerUserId,
      dueBefore: endDate,
      status: ['PENDING'],
    });

    const result = reminders.map((r) => this.formatReminderSummary(r));

    // Cache the result
    await this.redis.setex(cacheKey, UPCOMING_REMINDERS_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * Get overdue reminders
   */
  async getOverdueReminders(freelancerUserId: string): Promise<ClientReminderSummary[]> {
    // Try cache first
    const cacheKey = `reminders:overdue:${freelancerUserId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ClientReminderSummary[];
    }

    const reminders = await this.reminderRepository.findOverdue(freelancerUserId);
    const result = reminders.map((r) => this.formatReminderSummary(r));

    // Cache the result
    await this.redis.setex(cacheKey, OVERDUE_REMINDERS_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * Get reminders for a specific client
   */
  async getClientReminders(
    clientId: string,
    freelancerUserId: string,
    options?: { status?: ReminderStatus[]; limit?: number }
  ): Promise<ClientReminderSummary[]> {
    // Validate client belongs to freelancer
    const client = await this.clientRepository.findById(clientId);
    if (!client || client.freelancerUserId !== freelancerUserId) {
      throw new CrmError(CrmErrorCode.CLIENT_NOT_FOUND);
    }

    const reminders = await this.reminderRepository.findUpcoming(clientId, options?.limit || 10);

    return reminders.map((r) => this.formatReminderSummary(r));
  }

  /**
   * Get reminders due today
   */
  async getDueToday(freelancerUserId: string): Promise<ClientReminderSummary[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { reminders } = await this.reminderRepository.findByFreelancer(freelancerUserId, {
      freelancerUserId,
      dueBefore: tomorrow,
      dueAfter: today,
      status: ['PENDING'],
    });

    return reminders.map((r) => this.formatReminderSummary(r));
  }

  /**
   * Create next recurring reminder
   */
  private async createNextRecurringReminder(currentReminder: {
    freelancerUserId: string;
    clientId: string;
    title: string;
    description: string | null;
    reminderType: ReminderType;
    dueAt: Date;
    recurrenceRule: string | null;
    notifyBefore: number | null;
  }): Promise<void> {
    if (!currentReminder.recurrenceRule) return;

    let pattern: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval?: number;
      endDate?: string;
    };

    try {
      pattern = JSON.parse(currentReminder.recurrenceRule);
    } catch {
      this.logger.warn({ rule: currentReminder.recurrenceRule }, 'Invalid recurrence rule');
      return;
    }

    const nextDueAt = this.calculateNextDueDate(
      currentReminder.dueAt,
      pattern.frequency,
      pattern.interval || 1
    );

    // Check if we should stop recurring
    if (pattern.endDate && nextDueAt > new Date(pattern.endDate)) {
      this.logger.info({ endDate: pattern.endDate }, 'Recurring reminder series ended');
      return;
    }

    await this.reminderRepository.create({
      freelancerUserId: currentReminder.freelancerUserId,
      clientId: currentReminder.clientId,
      title: currentReminder.title,
      description: currentReminder.description,
      reminderType: currentReminder.reminderType,
      dueAt: nextDueAt,
      isRecurring: true,
      recurrenceRule: currentReminder.recurrenceRule,
      notifyBefore: currentReminder.notifyBefore,
    });

    this.logger.info({ nextDueAt }, 'Created next recurring reminder');
  }

  /**
   * Calculate next due date based on recurrence pattern
   */
  private calculateNextDueDate(
    currentDueDate: Date,
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number
  ): Date {
    const nextDate = new Date(currentDueDate);

    switch (frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + interval);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + interval * 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
    }

    return nextDate;
  }

  /**
   * Format reminder summary
   */
  private formatReminderSummary(reminder: {
    id: string;
    title: string;
    description: string | null;
    reminderType: ReminderType;
    status: ReminderStatus;
    dueAt: Date;
    isRecurring: boolean;
    completedAt: Date | null;
    snoozedUntil: Date | null;
    client?: {
      id: string;
      companyName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  }): ClientReminderSummary {
    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.description,
      reminderType: reminder.reminderType,
      status: reminder.status,
      dueAt: reminder.dueAt,
      isRecurring: reminder.isRecurring,
      completedAt: reminder.completedAt,
      snoozedUntil: reminder.snoozedUntil,
      client: reminder.client
        ? {
            id: reminder.client.id,
            displayName: this.getClientDisplayName(reminder.client),
          }
        : undefined,
    };
  }

  /**
   * Get client display name
   */
  private getClientDisplayName(client: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (client.companyName) {
      return client.companyName;
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Client';
  }

  /**
   * Invalidate reminder caches
   */
  private async invalidateReminderCaches(freelancerUserId: string): Promise<void> {
    const keys = await this.redis.keys(`reminders:*:${freelancerUserId}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
