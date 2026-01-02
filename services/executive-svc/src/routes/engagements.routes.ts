/**
 * Executive Engagements Routes
 *
 * API endpoints for managing executive engagements, workspaces, and time tracking.
 */

import type { FastifyPluginAsync } from 'fastify';
import { engagementService } from '../services/engagement.service.js';
import { workspaceService, WidgetPosition, PinnedDocument } from '../services/workspace.service.js';
import { timeTrackingService } from '../services/time-tracking.service.js';
import { ExecutiveTimeCategory } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
const CreateEngagementSchema = z.object({
  clientTenantId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  role: z.enum([
    'FRACTIONAL_CTO',
    'FRACTIONAL_CFO',
    'FRACTIONAL_CMO',
    'FRACTIONAL_COO',
    'FRACTIONAL_CHRO',
    'FRACTIONAL_CPO',
    'FRACTIONAL_CRO',
    'FRACTIONAL_CISO',
    'FRACTIONAL_CLO',
    'FRACTIONAL_CDO',
    'BOARD_ADVISOR',
    'INTERIM_EXECUTIVE',
  ]),
  hoursPerWeek: z.number().min(1).max(80),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  billingModel: z.enum(['RETAINER', 'HOURLY', 'HYBRID', 'PROJECT']).default('RETAINER'),
  hourlyRate: z.number().min(0).optional(),
  retainerAmount: z.number().min(0).optional(),
  retainerHoursIncluded: z.number().min(0).optional(),
  overageRate: z.number().min(0).optional(),
});

const UpdateEngagementSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  hoursPerWeek: z.number().min(1).max(80).optional(),
  endDate: z.string().datetime().optional(),
  objectives: z.array(z.string()).optional(),
  successMetrics: z.array(z.object({ name: z.string(), target: z.string() })).optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum([
    'PROPOSAL',
    'NEGOTIATING',
    'CONTRACT_SENT',
    'ACTIVE',
    'PAUSED',
    'RENEWAL',
    'COMPLETED',
    'TERMINATED',
  ]),
  reason: z.string().max(500).optional(),
});

const CreateTimeEntrySchema = z.object({
  date: z.string().datetime(),
  hours: z.number().min(0.25).max(24),
  description: z.string().min(5).max(1000),
  category: z
    .enum([
      'ADVISORY',
      'STRATEGY',
      'EXECUTION',
      'MEETINGS',
      'DOCUMENTATION',
      'REVIEW',
      'TRAINING',
      'ADMIN',
    ])
    .default('ADVISORY'),
  billable: z.boolean().default(true),
});

const UpdateLayoutSchema = z.object({
  layout: z.array(
    z.object({
      widgetId: z.string(),
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().min(1),
      height: z.number().min(1),
    })
  ),
});

const PinDocumentSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  type: z.enum(['pdf', 'doc', 'spreadsheet', 'presentation', 'image', 'other']),
});

export const engagementRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth to all routes
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.requireAuth(request, reply);
  });

  // ==========================================
  // ENGAGEMENT ROUTES
  // ==========================================

  /**
   * Create a new engagement
   */
  fastify.post('/engagements', async (request, reply) => {
    const body = CreateEngagementSchema.parse(request.body);
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const engagement = await engagementService.createEngagement({
      executiveId,
      clientTenantId: body.clientTenantId,
      clientContactId: 'placeholder', // Will be resolved from tenant
      title: body.title,
      role: body.role as any,
      description: body.description,
      hoursPerWeek: body.hoursPerWeek,
      billingModel: body.billingModel as any,
      hourlyRate: body.hourlyRate,
      monthlyRetainer: body.retainerAmount,
    });

    return reply.status(201).send(engagement);
  });

  /**
   * Get my engagements
   */
  fastify.get('/engagements', async (request, reply) => {
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const query = request.query as { status?: string };
    const engagements = await engagementService.getEngagementsByExecutive(
      executiveId,
      query.status ? { status: query.status.split(',') as any[] } : undefined
    );

    return reply.send(engagements);
  });

  /**
   * Get engagement details
   */
  fastify.get('/engagements/:engagementId', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const engagement = await engagementService.getEngagementDetails(engagementId, executiveId);

    return reply.send(engagement);
  });

  /**
   * Update engagement
   */
  fastify.patch('/engagements/:engagementId', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const executiveId = request.user!.executiveId;
    const body = UpdateEngagementSchema.parse(request.body);

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    // Verify ownership
    const engagement = await engagementService.getEngagementDetails(engagementId, executiveId);

    const updated = await engagementService.updateEngagement(engagementId, {
      ...body,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });

    return reply.send(updated);
  });

  /**
   * Update engagement status
   */
  fastify.patch('/engagements/:engagementId/status', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const executiveId = request.user!.executiveId;
    const body = UpdateStatusSchema.parse(request.body);

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const updated = await engagementService.updateEngagementStatus(
      engagementId,
      body.status as any,
      executiveId
    );

    return reply.send(updated);
  });

  /**
   * Get executive capacity
   */
  fastify.get('/capacity', async (request, reply) => {
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const capacity = await engagementService.checkExecutiveCapacity(executiveId);
    return reply.send(capacity);
  });

  /**
   * Get utilization report
   */
  fastify.get('/utilization', async (request, reply) => {
    const executiveId = request.user!.executiveId;
    const query = request.query as { startDate?: string; endDate?: string };

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const utilization = await engagementService.getExecutiveUtilization(
      executiveId,
      startDate,
      endDate
    );

    return reply.send(utilization);
  });

  // ==========================================
  // WORKSPACE ROUTES
  // ==========================================

  /**
   * Get engagement workspace
   */
  fastify.get('/engagements/:engagementId/workspace', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const workspace = await workspaceService.getWorkspace(engagementId, executiveId);

    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    return reply.send(workspace);
  });

  /**
   * Update workspace layout
   */
  fastify.put('/workspaces/:workspaceId/layout', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = UpdateLayoutSchema.parse(request.body);

    const workspace = await workspaceService.updateWorkspaceLayout(
      workspaceId,
      body.layout as unknown as WidgetPosition[]
    );

    return reply.send(workspace);
  });

  /**
   * Update widget config
   */
  fastify.put('/workspaces/:workspaceId/widgets/:widgetId/config', async (request, reply) => {
    const { workspaceId, widgetId } = request.params as {
      workspaceId: string;
      widgetId: string;
    };
    const config = request.body as Record<string, any>;

    const workspace = await workspaceService.updateWidgetConfig(workspaceId, widgetId, config);

    return reply.send(workspace);
  });

  /**
   * Enable widget
   */
  fastify.post('/workspaces/:workspaceId/widgets/:widgetId/enable', async (request, reply) => {
    const { workspaceId, widgetId } = request.params as {
      workspaceId: string;
      widgetId: string;
    };

    const workspace = await workspaceService.enableWidget(workspaceId, widgetId);
    return reply.send(workspace);
  });

  /**
   * Disable widget
   */
  fastify.post('/workspaces/:workspaceId/widgets/:widgetId/disable', async (request, reply) => {
    const { workspaceId, widgetId } = request.params as {
      workspaceId: string;
      widgetId: string;
    };

    const workspace = await workspaceService.disableWidget(workspaceId, widgetId);
    return reply.send(workspace);
  });

  /**
   * Pin document
   */
  fastify.post('/workspaces/:workspaceId/pins/documents', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = PinDocumentSchema.parse(request.body);

    const workspace = await workspaceService.pinDocument(
      workspaceId,
      body as unknown as Omit<PinnedDocument, 'id' | 'pinnedAt'>
    );
    return reply.status(201).send(workspace);
  });

  /**
   * Unpin document
   */
  fastify.delete('/workspaces/:workspaceId/pins/documents/:documentId', async (request, reply) => {
    const { workspaceId, documentId } = request.params as {
      workspaceId: string;
      documentId: string;
    };

    const workspace = await workspaceService.unpinDocument(workspaceId, documentId);
    return reply.send(workspace);
  });

  /**
   * Update executive notes
   */
  fastify.put('/workspaces/:workspaceId/notes', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const { notes } = request.body as { notes: string };

    const workspace = await workspaceService.updateExecutiveNotes(workspaceId, notes);
    return reply.send(workspace);
  });

  /**
   * Launch SkillPod
   */
  fastify.post('/workspaces/:workspaceId/skillpod/launch', async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const session = await workspaceService.launchSkillPod(workspaceId, executiveId);
    return reply.send(session);
  });

  // ==========================================
  // TIME TRACKING ROUTES
  // ==========================================

  /**
   * Create time entry
   */
  fastify.post('/engagements/:engagementId/time', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const executiveId = request.user!.executiveId;
    const body = CreateTimeEntrySchema.parse(request.body);

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const entry = await timeTrackingService.createTimeEntry({
      engagementId,
      executiveId,
      date: new Date(body.date),
      hours: body.hours,
      description: body.description,
      category: body.category as unknown as ExecutiveTimeCategory,
      billable: body.billable,
    });

    return reply.status(201).send(entry);
  });

  /**
   * Get time entries for engagement
   */
  fastify.get('/engagements/:engagementId/time', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      status?: string;
    };

    const entries = await timeTrackingService.getTimeEntriesByEngagement(engagementId, {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      status: query.status as any,
    });

    return reply.send(entries);
  });

  /**
   * Update time entry
   */
  fastify.patch('/time/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const executiveId = request.user!.executiveId;
    const body = request.body as any;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const entry = await timeTrackingService.updateTimeEntry(entryId, executiveId, {
      date: body.date ? new Date(body.date) : undefined,
      hours: body.hours,
      description: body.description,
      category: body.category,
      billable: body.billable,
    });

    return reply.send(entry);
  });

  /**
   * Delete time entry
   */
  fastify.delete('/time/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const executiveId = request.user!.executiveId;

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    await timeTrackingService.deleteTimeEntry(entryId, executiveId);
    return reply.status(204).send();
  });

  /**
   * Submit timesheet
   */
  fastify.post('/engagements/:engagementId/time/submit', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const executiveId = request.user!.executiveId;
    const { entryIds } = request.body as { entryIds: string[] };

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const entries = await timeTrackingService.submitTimesheet(engagementId, executiveId, entryIds);

    return reply.send(entries);
  });

  /**
   * Get time summary
   */
  fastify.get('/engagements/:engagementId/time/summary', async (request, reply) => {
    const { engagementId } = request.params as { engagementId: string };
    const query = request.query as { startDate?: string; endDate?: string };

    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const summary = await timeTrackingService.getTimeSummary(engagementId, startDate, endDate);

    return reply.send(summary);
  });

  /**
   * Get executive weekly timesheet
   */
  fastify.get('/timesheet', async (request, reply) => {
    const executiveId = request.user!.executiveId;
    const query = request.query as { weekOf?: string };

    if (!executiveId) {
      return reply.status(403).send({ error: 'Not registered as an executive' });
    }

    const weekOf = query.weekOf ? new Date(query.weekOf) : new Date();
    const timesheet = await timeTrackingService.getExecutiveTimesheet(executiveId, weekOf);

    return reply.send(timesheet);
  });
};
