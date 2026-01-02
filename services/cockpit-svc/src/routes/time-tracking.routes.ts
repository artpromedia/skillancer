// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/routes/time-tracking
 * Time Tracking API Routes
 *
 * Provides endpoints for:
 * - Timer operations (start, pause, resume, stop, discard)
 * - Time entry CRUD
 * - Timesheet management
 * - Reports and analytics
 * - Settings management
 * - Category management
 * - Export functionality
 */

import { z } from 'zod';

import { TimeTrackingError } from '../errors/time-tracking.errors.js';
import { TimeTrackingService } from '../services/time-tracking.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ==========================================
// Request Schemas
// ==========================================

const StartTimerSchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  isBillable: z.boolean().optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

const StopTimerSchema = z.object({
  description: z.string().max(500).optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  isBillable: z.boolean().optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  applyRounding: z.boolean().optional(),
});

const UpdateTimerSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isBillable: z.boolean().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
});

const CreateTimeEntrySchema = z.object({
  date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  durationMinutes: z.number().int().min(1).max(1440),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  marketContractId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isBillable: z.boolean().optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  hourlyRate: z.number().positive().optional(),
});

const UpdateTimeEntrySchema = z.object({
  date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  isBillable: z.boolean().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
  hourlyRate: z.number().positive().nullable().optional(),
});

const TimeEntryFiltersSchema = z.object({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isBillable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isInvoiced: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  category: z.string().max(100).optional(),
  tags: z
    .string()
    .transform((v) => v.split(','))
    .optional(),
  source: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .optional(),
  limit: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .optional(),
});

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  updates: z.object({
    projectId: z.string().uuid().nullable().optional(),
    isBillable: z.boolean().optional(),
    category: z.string().max(100).nullable().optional(),
  }),
});

const DuplicateEntrySchema = z.object({
  date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
});

const TimesheetQuerySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const TimeReportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(['day', 'week', 'project', 'client', 'category']).optional(),
  projectIds: z
    .string()
    .transform((v) => v.split(','))
    .optional(),
  clientIds: z
    .string()
    .transform((v) => v.split(','))
    .optional(),
});

const UpdateSettingsSchema = z.object({
  defaultHourlyRate: z.number().positive().nullable().optional(),
  defaultCurrency: z.string().length(3).optional(),
  roundingMethod: z.enum(['NONE', 'ROUND_UP', 'ROUND_DOWN', 'ROUND_NEAREST']).optional(),
  roundingIncrement: z.number().int().min(1).max(60).optional(),
  autoStartTimer: z.boolean().optional(),
  autoStopOnIdle: z.boolean().optional(),
  idleTimeoutMinutes: z.number().int().min(1).max(120).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  dailyTargetHours: z.number().positive().max(24).nullable().optional(),
  weeklyTargetHours: z.number().positive().max(168).nullable().optional(),
  defaultWorkDayStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  defaultWorkDayEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
});

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
});

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(50).nullable().optional(),
});

const ExportSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['csv', 'json']),
  projectIds: z
    .string()
    .transform((v) => v.split(','))
    .optional(),
  clientIds: z
    .string()
    .transform((v) => v.split(','))
    .optional(),
});

// ==========================================
// Route Plugin
// ==========================================

// eslint-disable-next-line @typescript-eslint/require-await
export async function timeTrackingRoutes(
  app: FastifyInstance,
  options: { prisma: PrismaClient }
): Promise<void> {
  const { prisma } = options;
  const service = new TimeTrackingService(prisma);

  // Error handler
  const handleError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof TimeTrackingError) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    throw error;
  };

  // Get user ID from request (assumes auth middleware has set this)
  const getUserId = (request: FastifyRequest): string => {
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  };

  // ==========================================
  // Timer Endpoints
  // ==========================================

  // GET /time/timer - Get active timer
  app.get('/time/timer', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const timer = await service.getActiveTimer(userId);
      return await reply.send({ timer });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timer/start - Start timer
  app.post('/time/timer/start', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = StartTimerSchema.parse(request.body);
      const timer = await service.startTimer({ userId, ...body });
      return await reply.status(201).send({ timer });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timer/pause - Pause timer
  app.post('/time/timer/pause', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const timer = await service.pauseTimer(userId);
      return await reply.send({ timer });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timer/resume - Resume timer
  app.post('/time/timer/resume', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const timer = await service.resumeTimer(userId);
      return await reply.send({ timer });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timer/stop - Stop timer and create entry
  app.post('/time/timer/stop', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = StopTimerSchema.parse(request.body);
      const entry = await service.stopTimer({ userId, ...body });
      return await reply.status(201).send({ entry });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timer/discard - Discard timer
  app.post('/time/timer/discard', async (request, reply) => {
    try {
      const userId = getUserId(request);
      await service.discardTimer(userId);
      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /time/timer - Update active timer
  app.patch('/time/timer', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = UpdateTimerSchema.parse(request.body);
      const timer = await service.updateActiveTimer(userId, {
        projectId: body.projectId ?? undefined,
        taskId: body.taskId ?? undefined,
        description: body.description ?? undefined,
        isBillable: body.isBillable,
      });
      return await reply.send({ timer });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================
  // Time Entry Endpoints
  // ==========================================

  // GET /time/entries - List time entries
  app.get('/time/entries', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = TimeEntryFiltersSchema.parse(request.query);
      const result = await service.getTimeEntries({
        freelancerUserId: userId,
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });
      return await reply.send(result);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/entries - Create time entry
  app.post('/time/entries', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = CreateTimeEntrySchema.parse(request.body);
      const entry = await service.createTimeEntry({
        freelancerUserId: userId,
        projectId: body.projectId,
        taskId: body.taskId,
        clientId: body.clientId,
        date: new Date(body.date),
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        durationMinutes: body.durationMinutes,
        description: body.description ?? '',
        category: body.category,
        tags: body.tags,
        isBillable: body.isBillable,
        hourlyRate: body.hourlyRate,
      });
      return await reply.status(201).send({ entry });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /time/entries/:id - Get single entry
  app.get('/time/entries/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const entry = await service.getTimeEntry(id, userId);
      return await reply.send({ entry });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /time/entries/:id - Update entry
  app.patch('/time/entries/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const body = UpdateTimeEntrySchema.parse(request.body);
      const entry = await service.updateTimeEntry(id, userId, {
        projectId: body.projectId ?? undefined,
        taskId: body.taskId ?? undefined,
        clientId: body.clientId ?? undefined,
        date: body.date ? new Date(body.date) : undefined,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        durationMinutes: body.durationMinutes,
        description: body.description ?? undefined,
        category: body.category ?? undefined,
        tags: body.tags,
        isBillable: body.isBillable,
        hourlyRate: body.hourlyRate ?? undefined,
      });
      return await reply.send({ entry });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /time/entries/:id - Delete entry
  app.delete('/time/entries/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      await service.deleteTimeEntry(id, userId);
      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/entries/:id/duplicate - Duplicate entry
  app.post('/time/entries/:id/duplicate', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const body = DuplicateEntrySchema.parse(request.body ?? {});
      const entry = await service.duplicateTimeEntry(
        id,
        userId,
        body.date ? new Date(body.date) : undefined
      );
      return await reply.status(201).send({ entry });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/entries/bulk - Bulk update entries
  app.post('/time/entries/bulk', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = BulkUpdateSchema.parse(request.body);
      const count = await service.bulkUpdateTimeEntries(userId, {
        entryIds: body.ids,
        updates: {
          projectId: body.updates.projectId ?? undefined,
          isBillable: body.updates.isBillable,
          category: body.updates.category ?? undefined,
        },
      });
      return await reply.send({ updated: count });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================
  // Timesheet Endpoints
  // ==========================================

  // GET /time/timesheet - Get weekly timesheet
  app.get('/time/timesheet', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = TimesheetQuerySchema.parse(request.query);
      const timesheet = await service.getTimesheet(userId, new Date(query.weekStart));
      return await reply.send(timesheet);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timesheet/submit - Submit timesheet
  app.post('/time/timesheet/submit', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = TimesheetQuerySchema.parse(request.query);
      const timesheet = await service.submitTimesheet(userId, new Date(query.weekStart));
      return await reply.send({ timesheet });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/timesheet/lock - Lock timesheet
  app.post('/time/timesheet/lock', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = TimesheetQuerySchema.parse(request.query);
      const timesheet = await service.lockTimesheet(userId, new Date(query.weekStart));
      return await reply.send({ timesheet });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================
  // Report Endpoints
  // ==========================================

  // GET /time/reports - Get time report
  app.get('/time/reports', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = TimeReportSchema.parse(request.query);
      const report = await service.getTimeReport({
        freelancerUserId: userId,
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        groupBy: query.groupBy ?? 'day',
        projectIds: query.projectIds,
        clientIds: query.clientIds,
      });
      return await reply.send(report);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /time/insights - Get productivity insights
  app.get('/time/insights', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = z
        .object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(request.query);
      const insights = await service.getProductivityInsights(
        userId,
        new Date(query.startDate),
        new Date(query.endDate)
      );
      return await reply.send(insights);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================
  // Settings Endpoints
  // ==========================================

  // GET /time/settings - Get settings
  app.get('/time/settings', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const settings = await service.getSettings(userId);
      return await reply.send({ settings });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /time/settings - Update settings
  app.patch('/time/settings', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = UpdateSettingsSchema.parse(request.body);
      const settings = await service.updateSettings(userId, {
        defaultHourlyRate: body.defaultHourlyRate ?? undefined,
        defaultCurrency: body.defaultCurrency,
        reminderEnabled: body.reminderEnabled,
        reminderTime: body.reminderTime ?? undefined,
        roundingMethod: body.roundingMethod as 'NONE' | 'UP' | 'DOWN' | 'NEAREST' | undefined,
        roundingMinutes: body.roundingIncrement,
        targetHoursPerDay: body.dailyTargetHours ?? undefined,
        targetHoursPerWeek: body.weeklyTargetHours ?? undefined,
        workdayStartTime: body.defaultWorkDayStart ?? undefined,
        workdayEndTime: body.defaultWorkDayEnd ?? undefined,
        weekStartDay: body.weekStartsOn,
        idleDetectionMinutes: body.idleTimeoutMinutes,
        autoStopAfterMinutes: body.autoStopOnIdle ? body.idleTimeoutMinutes : undefined,
      });
      return await reply.send({ settings });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================
  // Category Endpoints
  // ==========================================

  // GET /time/categories - List categories
  app.get('/time/categories', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const categories = await service.getCategories(userId);
      return await reply.send({ categories });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /time/categories - Create category
  app.post('/time/categories', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = CreateCategorySchema.parse(request.body);
      const category = await service.createCategory(userId, body);
      return await reply.status(201).send({ category });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /time/categories/:id - Update category
  app.patch('/time/categories/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      const body = UpdateCategorySchema.parse(request.body);
      const category = await service.updateCategory(userId, id, {
        name: body.name,
        color: body.color,
        icon: body.icon ?? undefined,
      });
      return await reply.send({ category });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /time/categories/:id - Delete category
  app.delete('/time/categories/:id', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };
      await service.deleteCategory(userId, id);
      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================
  // Export Endpoints
  // ==========================================

  // GET /time/export - Export time entries
  app.get('/time/export', async (request, reply) => {
    try {
      const userId = getUserId(request);
      const query = ExportSchema.parse(request.query);
      const result = await service.exportTimeEntries({
        freelancerUserId: userId,
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        format: query.format as 'csv' | 'xlsx' | 'pdf',
        projectIds: query.projectIds,
        clientIds: query.clientIds,
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.data);
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

