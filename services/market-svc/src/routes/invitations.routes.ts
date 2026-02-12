// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Invitation Routes
 *
 * Public API endpoints for project invitations
 */

import { z } from 'zod';

import { BiddingError, getStatusCode } from '../errors/bidding.errors.js';
import { InvitationService } from '../services/invitation.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const SendInvitationSchema = z.object({
  jobId: z.string().uuid(),
  freelancerId: z.string().uuid(),
  message: z.string().max(2000).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

const RespondToInvitationSchema = z.object({
  accept: z.boolean(),
  declineReason: z.string().max(500).optional(),
});

const InvitationListQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface InvitationRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerInvitationRoutes(
  fastify: FastifyInstance,
  deps: InvitationRouteDeps
): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const invitationService = new InvitationService(prisma, redis, logger);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof BiddingError) {
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

  // POST /invitations - Send an invitation
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = SendInvitationSchema.parse(request.body);

      const invitation = await invitationService.sendInvitation(user.id, body);

      logger.info({
        msg: 'Invitation sent',
        invitationId: invitation.id,
        projectId: body.jobId,
        inviterId: user.id,
        inviteeId: body.freelancerId,
      });

      return await reply.status(201).send({
        success: true,
        invitation,
        message: 'Invitation sent successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invitations/sent - Get sent invitations (client)
  fastify.get('/sent', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = InvitationListQuerySchema.parse(request.query);

      const result = await invitationService.getSentInvitations(user.id, {
        status: query.status,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invitations/received - Get received invitations (freelancer)
  fastify.get('/received', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = InvitationListQuerySchema.parse(request.query);

      const result = await invitationService.getReceivedInvitations(user.id, {
        status: query.status,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invitations/project/:projectId - Get invitations for a project
  fastify.get<{ Params: { projectId: string } }>('/project/:projectId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;
      const query = InvitationListQuerySchema.parse(request.query);

      const result = await invitationService.getProjectInvitations(projectId, user.id, {
        status: query.status,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /invitations/:invitationId - Get a specific invitation
  fastify.get<{ Params: { invitationId: string } }>('/:invitationId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { invitationId } = request.params;

      const invitation = await invitationService.getInvitation(invitationId, user.id);

      return await reply.send({
        success: true,
        invitation,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /invitations/:invitationId/respond - Respond to an invitation
  fastify.post<{ Params: { invitationId: string } }>(
    '/:invitationId/respond',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { invitationId } = request.params;
        const body = RespondToInvitationSchema.parse(request.body);

        await invitationService.respondToInvitation({ invitationId, ...body }, user.id);

        logger.info({
          msg: body.accept ? 'Invitation accepted' : 'Invitation declined',
          invitationId,
          freelancerId: user.id,
        });

        return await reply.send({
          success: true,
          message: body.accept ? 'Invitation accepted' : 'Invitation declined',
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /invitations/:invitationId/cancel - Cancel an invitation (client)
  fastify.post<{ Params: { invitationId: string } }>(
    '/:invitationId/cancel',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { invitationId } = request.params;

        await invitationService.cancelInvitation(invitationId, user.id);

        logger.info({
          msg: 'Invitation cancelled',
          invitationId,
          clientId: user.id,
        });

        return await reply.send({
          success: true,
          message: 'Invitation cancelled',
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /invitations/:invitationId/resend - Resend an invitation (client)
  fastify.post<{ Params: { invitationId: string } }>(
    '/:invitationId/resend',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { invitationId } = request.params;

        await invitationService.resendInvitation(invitationId, user.id);

        logger.info({
          msg: 'Invitation resent',
          invitationId,
          clientId: user.id,
        });

        return await reply.send({
          success: true,
          message: 'Invitation resent',
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}
