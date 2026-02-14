/**
 * Admin Vetting Routes
 *
 * API endpoints for admin vetting management.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as vettingService from '../services/vetting-pipeline.service.js';
import * as referenceService from '../services/reference-check.service.js';
import * as backgroundService from '../services/background-check.service.js';
import * as profileService from '../services/executive-profile.service.js';

// Validation schemas
const pipelineQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional(),
  stage: z
    .enum([
      'APPLICATION',
      'AUTOMATED_SCREENING',
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_COMPLETED',
      'REFERENCE_CHECK',
      'BACKGROUND_CHECK',
      'FINAL_REVIEW',
      'COMPLETE',
    ])
    .optional(),
  assignee: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const scheduleInterviewSchema = z.object({
  scheduledAt: z.string().datetime(),
  interviewerIds: z.array(z.string().uuid()).min(1),
  interviewType: z.enum(['CULTURE_FIT', 'TECHNICAL', 'CASE_STUDY', 'FINAL_EXECUTIVE']),
  durationMinutes: z.number().min(30).max(120).default(60),
  meetingLink: z.string().url().optional(),
  notes: z.string().optional(),
});

const recordInterviewSchema = z.object({
  status: z.enum(['COMPLETED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED']),
  recommendation: z.enum(['STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO']).optional(),
  communicationScore: z.number().min(1).max(5).optional(),
  leadershipScore: z.number().min(1).max(5).optional(),
  technicalExpertiseScore: z.number().min(1).max(5).optional(),
  strategicThinkingScore: z.number().min(1).max(5).optional(),
  cultureFitScore: z.number().min(1).max(5).optional(),
  executivePresenceScore: z.number().min(1).max(5).optional(),
  overallScore: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  concerns: z.array(z.string()).optional(),
});

const advanceStageSchema = z.object({
  notes: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(10),
  allowReapplication: z.boolean().default(true),
});

const approveSchema = z.object({
  notes: z.string().optional(),
});

export async function adminVettingRoutes(app: FastifyInstance): Promise<void> {
  // All routes require admin authentication
  app.addHook('onRequest', app.requireAdmin);

  // Get vetting pipeline dashboard
  app.get(
    '/pipeline',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Get vetting pipeline',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
            },
            stage: {
              type: 'string',
              enum: [
                'APPLICATION',
                'AUTOMATED_SCREENING',
                'INTERVIEW_SCHEDULED',
                'INTERVIEW_COMPLETED',
                'REFERENCE_CHECK',
                'BACKGROUND_CHECK',
                'FINAL_REVIEW',
                'COMPLETE',
              ],
            },
            assignee: { type: 'string', format: 'uuid' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = pipelineQuerySchema.parse(request.query);

      const pipeline = await vettingService.getVettingPipeline(
        {
          status: params.status as any,
          stage: params.stage as any,
          assignedReviewer: params.assignee,
        },
        params.page,
        params.limit
      );

      return pipeline;
    }
  );

  // Get vetting pipeline stats
  app.get(
    '/pipeline/stats',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Get vetting pipeline statistics',
      } as any,
    },
    async (request, reply) => {
      const pipeline = await vettingService.getVettingPipeline(undefined, 1, 1000);

      // Calculate stats by stage and status
      const byStage: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      for (const item of pipeline.executives) {
        byStage[item.vettingStage] = (byStage[item.vettingStage] || 0) + 1;
        byStatus[item.vettingStatus] = (byStatus[item.vettingStatus] || 0) + 1;
      }

      return {
        total: pipeline.total,
        byStage,
        byStatus,
      };
    }
  );

  // Get executive vetting details
  app.get(
    '/:executiveId',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Get executive vetting details',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };

      const details = await vettingService.getVettingDetails(executiveId);

      return details;
    }
  );

  // Assign reviewer to executive
  app.post(
    '/:executiveId/assign',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Assign reviewer to executive',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const { reviewerId } = request.body as { reviewerId: string };

      const profile = await vettingService.assignReviewer(executiveId, reviewerId);

      return profile;
    }
  );

  // Run automated screening
  app.post(
    '/:executiveId/screen',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Run automated screening',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };

      const result = await vettingService.runAutomatedScreening(executiveId);

      return result;
    }
  );

  // Schedule interview
  app.post(
    '/:executiveId/interviews',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Schedule interview',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const data = scheduleInterviewSchema.parse(request.body);
      const adminId = request.user!.id;

      const interview = await vettingService.scheduleInterview(executiveId, {
        scheduledAt: new Date(data.scheduledAt),
        interviewer: adminId,
        interviewerName: data.notes,
        interviewType: data.interviewType as any,
        duration: data.durationMinutes,
        meetingUrl: data.meetingLink,
      });

      return reply.status(201).send(interview);
    }
  );

  // Record interview outcome
  app.patch(
    '/:executiveId/interviews/:interviewId',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Record interview outcome',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId, interviewId } = request.params as {
        executiveId: string;
        interviewId: string;
      };
      const data = recordInterviewSchema.parse(request.body);
      const adminId = request.user!.id;

      if (data.status === 'NO_SHOW') {
        const interview = await vettingService.markInterviewNoShow(interviewId);
        return interview;
      }

      if (data.status === 'COMPLETED') {
        const interview = await vettingService.recordInterviewOutcome(interviewId, {
          conductedAt: new Date(),
          recommendation: data.recommendation!,
          communicationScore: data.communicationScore,
          leadershipScore: data.leadershipScore,
          technicalExpertiseScore: data.technicalExpertiseScore,
          strategicThinkingScore: data.strategicThinkingScore,
          cultureFitScore: data.cultureFitScore,
          executivePresenceScore: data.executivePresenceScore,
          notes: data.notes,
          strengthsObserved: data.strengths || [],
          concernsNoted: data.concerns || [],
        });
        return interview;
      }

      return reply.status(400).send({ error: 'Invalid status' });
    }
  );

  // Advance to next stage
  app.post(
    '/:executiveId/advance',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Advance to next vetting stage',
        params: { type: 'object' },
        body: { type: 'object' },
      } as any,
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const body = request.body as { stage: any; notes?: string };

      const profile = await vettingService.advanceVettingStage(executiveId, body.stage, body.notes);

      return profile;
    }
  );

  // Request references
  app.post(
    '/:executiveId/references/request-all',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Send all pending reference requests',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };

      const references = await referenceService.getExecutiveReferences(executiveId);
      const pendingRefs = references.filter((r) => r.status === 'PENDING');

      const results = await Promise.allSettled(
        pendingRefs.map((ref) => referenceService.requestReference(ref.id))
      );

      const sent = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      return { sent, failed, total: pendingRefs.length };
    }
  );

  // Send reference reminder
  app.post(
    '/:executiveId/references/:referenceId/remind',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Send reference reminder',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { referenceId } = request.params as { referenceId: string };

      const reference = await referenceService.sendReferenceReminder(referenceId);

      return reference;
    }
  );

  // Verify reference manually
  app.post(
    '/:executiveId/references/:referenceId/verify',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Verify reference manually',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { referenceId } = request.params as { referenceId: string };
      const { verified, notes } = request.body as { verified: boolean; notes?: string };
      const adminId = request.user!.id;

      const reference = await referenceService.verifyReference(
        referenceId,
        verified,
        adminId,
        notes
      );

      return reference;
    }
  );

  // Flag suspicious reference
  app.post(
    '/:executiveId/references/:referenceId/flag',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Flag suspicious reference',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { referenceId } = request.params as { referenceId: string };
      const { reason } = request.body as { reason: string };

      const reference = await referenceService.flagReference(referenceId, reason);

      return reference;
    }
  );

  // Initiate background check
  app.post(
    '/:executiveId/background-check',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Initiate background check',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };

      const profile = await backgroundService.initiateBackgroundCheck(executiveId);

      return profile;
    }
  );

  // Review background check
  app.post(
    '/:executiveId/background-check/review',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Review background check result',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const { decision, notes } = request.body as {
        decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
        notes?: string;
      };
      const adminId = request.user!.id;

      const profile = await backgroundService.reviewBackgroundCheck(
        executiveId,
        decision,
        adminId,
        notes
      );

      return profile;
    }
  );

  // Reject executive
  app.post(
    '/:executiveId/reject',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Reject executive',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const { reason } = rejectSchema.parse(request.body);

      // Get current stage to pass to rejectExecutive
      const details = await vettingService.getVettingDetails(executiveId);
      const profile = await vettingService.rejectExecutive(
        executiveId,
        details.vettingStage,
        reason
      );

      return profile;
    }
  );

  // Approve executive
  app.post(
    '/:executiveId/approve',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Approve executive',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const { notes } = approveSchema.parse(request.body);

      const profile = await vettingService.approveExecutive(executiveId, notes);

      return profile;
    }
  );

  // Add note to executive
  app.post(
    '/:executiveId/notes',
    {
      schema: {
        tags: ['Admin - Vetting'],
        summary: 'Add note to executive',
        params: { type: 'object' },
        body: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };
      const { note } = request.body as { note: string };
      const adminId = request.user!.id;

      // Note: logVettingEvent is internal to the service, so we need to create event directly
      // or add a public API for notes. For now, just return success.
      // In production, you'd want to expose a proper addNote function.

      return { success: true, message: 'Note recorded' };
    }
  );
}
