// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reminder Routes
 *
 * API endpoints for CRM reminders and follow-ups
 */

import { z } from 'zod';

import { CrmError, getStatusCode } from '../errors/crm.errors.js';
import { ReminderService } from '../services/reminder.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateReminderSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  reminderType: z.enum([
    'FOLLOW_UP',
    'CHECK_IN',
    'DEADLINE',
    'MEETING',
    'BIRTHDAY',
    'ANNIVERSARY',
    'CUSTOM',
  ]),
  dueAt: z.string().transform((s) => new Date(s)),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  notifyBefore: z.number().optional(),
});

const UpdateReminderSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  reminderType: z
    .enum(['FOLLOW_UP', 'CHECK_IN', 'DEADLINE', 'MEETING', 'BIRTHDAY', 'ANNIVERSARY', 'CUSTOM'])
    .optional(),
  dueAt: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
});

const SnoozeReminderSchema = z.object({
  snoozeUntil: z.string().transform((s) => new Date(s)),
});

const SearchRemindersSchema = z.object({
  clientId: z.string().uuid().optional(),
  status: z.array(z.enum(['PENDING', 'COMPLETED', 'SNOOZED', 'CANCELLED'])).optional(),
  reminderType: z
    .array(
      z.enum(['FOLLOW_UP', 'CHECK_IN', 'DEADLINE', 'MEETING', 'BIRTHDAY', 'ANNIVERSARY', 'CUSTOM'])
    )
    .optional(),
  priority: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
  dueBefore: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  dueAfter: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  sortBy: z.enum(['dueDate', 'createdAt', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface ReminderRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerReminderRoutes(fastify: FastifyInstance, deps: ReminderRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const reminderService = new ReminderService(prisma, redis, logger);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof CrmError) {
      return reply.status(getStatusCode(error.code)).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // POST /reminders - Create a reminder
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateReminderSchema.parse(request.body);

      const reminder = await reminderService.createReminder({
        freelancerUserId: user.id,
        ...body,
      });

      logger.info({
        msg: 'Reminder created',
        reminderId: reminder.id,
        clientId: body.clientId,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: reminder,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /reminders - Search reminders
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = SearchRemindersSchema.parse(request.query);

      const result = await reminderService.searchReminders({
        freelancerUserId: user.id,
        clientId: query.clientId,
        status: query.status as any,
        reminderType: query.reminderType as any,
        dueBefore: query.dueBefore,
        dueAfter: query.dueAfter,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /reminders/upcoming - Get upcoming reminders
  fastify.get('/upcoming', async (request, reply) => {
    try {
      const user = getUser(request);
      const { days } = z
        .object({
          days: z.string().transform(Number).optional(),
        })
        .parse(request.query);

      const reminders = await reminderService.getUpcomingReminders(user.id, days || 7);

      return await reply.send({
        success: true,
        data: reminders,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /reminders/overdue - Get overdue reminders
  fastify.get('/overdue', async (request, reply) => {
    try {
      const user = getUser(request);

      const reminders = await reminderService.getOverdueReminders(user.id);

      return await reply.send({
        success: true,
        data: reminders,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /reminders/today - Get reminders due today
  fastify.get('/today', async (request, reply) => {
    try {
      const user = getUser(request);

      const reminders = await reminderService.getDueToday(user.id);

      return await reply.send({
        success: true,
        data: reminders,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /reminders/:id - Get reminder by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const reminder = await reminderService.getReminder(id, user.id);

      return await reply.send({
        success: true,
        data: reminder,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /reminders/:id - Update reminder
  fastify.patch('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateReminderSchema.parse(request.body);

      const reminder = await reminderService.updateReminder(id, user.id, body);

      logger.info({
        msg: 'Reminder updated',
        reminderId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: reminder,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /reminders/:id/complete - Mark reminder as complete
  fastify.post('/:id/complete', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const { notes } = z.object({ notes: z.string().optional() }).parse(request.body);

      const reminder = await reminderService.completeReminder(id, user.id, notes);

      logger.info({
        msg: 'Reminder completed',
        reminderId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: reminder,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /reminders/:id/snooze - Snooze reminder
  fastify.post('/:id/snooze', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = SnoozeReminderSchema.parse(request.body);

      const reminder = await reminderService.snoozeReminder(id, user.id, body.snoozeUntil);

      logger.info({
        msg: 'Reminder snoozed',
        reminderId: id,
        snoozeUntil: body.snoozeUntil,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: reminder,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /reminders/:id/cancel - Cancel reminder
  fastify.post('/:id/cancel', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const reminder = await reminderService.cancelReminder(id, user.id);

      logger.info({
        msg: 'Reminder cancelled',
        reminderId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: reminder,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /reminders/:id - Delete reminder
  fastify.delete('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await reminderService.deleteReminder(id, user.id);

      logger.info({
        msg: 'Reminder deleted',
        reminderId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

