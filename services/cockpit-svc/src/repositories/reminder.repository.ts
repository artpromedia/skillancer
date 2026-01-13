/**
 * @module @skillancer/cockpit-svc/repositories/reminder
 * Client Reminder data access layer
 */

import type { ReminderSearchParams } from '../types/crm.types.js';
import type { PrismaClient, ReminderType, ReminderStatus } from '../types/prisma-shim.js';

export class ReminderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new reminder
   */
  async create(data: {
    clientId: string;
    freelancerUserId: string;
    title: string;
    description?: string | null;
    reminderType: ReminderType;
    dueAt: Date;
    isRecurring?: boolean;
    recurrenceRule?: string | null;
    notifyBefore?: number | null;
  }) {
    return this.prisma.clientReminder.create({
      data: {
        clientId: data.clientId,
        freelancerUserId: data.freelancerUserId,
        title: data.title,
        description: data.description ?? null,
        reminderType: data.reminderType,
        dueAt: data.dueAt,
        isRecurring: data.isRecurring ?? false,
        recurrenceRule: data.recurrenceRule ?? null,
        notifyBefore: data.notifyBefore ?? null,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Find a reminder by ID
   */
  async findById(id: string) {
    return this.prisma.clientReminder.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Find upcoming reminders for a client
   */
  async findUpcoming(clientId: string, limit: number = 5) {
    return this.prisma.clientReminder.findMany({
      where: {
        clientId,
        status: 'PENDING',
        dueAt: { gte: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Find reminders by freelancer
   */
  async findByFreelancer(freelancerUserId: string, params?: ReminderSearchParams) {
    const {
      clientId,
      status,
      reminderType,
      dueBefore,
      dueAfter,
      page = 1,
      limit = 20,
    } = params || {};

    const where = {
      freelancerUserId,
      ...(clientId && { clientId }),
      ...(status && status.length > 0 && { status: { in: status } }),
      ...(reminderType && reminderType.length > 0 && { reminderType: { in: reminderType } }),
      ...(dueBefore && { dueAt: { lte: dueBefore } }),
      ...(dueAfter && { dueAt: { gte: dueAfter } }),
    };

    const [reminders, total] = await Promise.all([
      this.prisma.clientReminder.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clientReminder.count({ where }),
    ]);

    return { reminders, total };
  }

  /**
   * Find reminders due for notification
   */
  async findDueForNotification() {
    const now = new Date();

    return this.prisma.clientReminder.findMany({
      where: {
        status: 'PENDING',
        notificationSent: false,
        OR: [
          // Reminders with notifyBefore - check if notification time has passed
          {
            notifyBefore: { not: null },
            dueAt: {
              lte: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Within next 24 hours
            },
          },
          // Reminders without notifyBefore - notify when due
          {
            notifyBefore: null,
            dueAt: { lte: now },
          },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Find overdue reminders
   */
  async findOverdue(freelancerUserId: string) {
    return this.prisma.clientReminder.findMany({
      where: {
        freelancerUserId,
        status: 'PENDING',
        dueAt: { lt: new Date() },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  /**
   * Update a reminder
   */
  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      reminderType: ReminderType;
      dueAt: Date;
      isRecurring: boolean;
      recurrenceRule: string | null;
      status: ReminderStatus;
      completedAt: Date | null;
      snoozedUntil: Date | null;
      notifyBefore: number | null;
      notificationSent: boolean;
    }>
  ) {
    return this.prisma.clientReminder.update({
      where: { id },
      data,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Delete a reminder
   */
  async delete(id: string) {
    return this.prisma.clientReminder.delete({
      where: { id },
    });
  }
}
