// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * Credentials Routes
 *
 * API endpoints for SkillPod credential integration and skill verification
 */

import { z } from 'zod';

import { CredentialSyncService } from '../services/credential-sync.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const GetCredentialsQuerySchema = z.object({
  userId: z.string().uuid(),
  includeHidden: z.enum(['true', 'false']).optional().default('false'),
});

const GetSkillConfidencesQuerySchema = z.object({
  userId: z.string().uuid(),
  skillIds: z.string().optional(), // Comma-separated skill IDs
});

const VerifyCredentialParamsSchema = z.object({
  credentialId: z.string().uuid(),
});

const VerifyCredentialBodySchema = z.object({
  verificationCode: z.string().optional(),
});

const UpdateVisibilityParamsSchema = z.object({
  credentialId: z.string().uuid(),
});

const UpdateVisibilityBodySchema = z.object({
  isVisible: z.boolean(),
  displayOrder: z.number().int().min(0).optional(),
});

const GetLearningActivityQuerySchema = z.object({
  userId: z.string().uuid(),
});

const RequestVerificationBodySchema = z.object({
  skillId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface CredentialRouteDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerCredentialRoutes(
  fastify: FastifyInstance,
  deps: CredentialRouteDependencies
): void {
  const credentialService = new CredentialSyncService(deps.prisma, deps.redis, deps.logger);

  // ==========================================================================
  // GET /credentials - Get user credentials
  // ==========================================================================
  fastify.get(
    '/',
    {
      schema: {
        description: 'Get credentials for a user',
        tags: ['credentials'],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            includeHidden: { type: 'string', enum: ['true', 'false'] },
          },
          required: ['userId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    credentialType: { type: 'string' },
                    source: { type: 'string' },
                    issueDate: { type: 'string' },
                    expirationDate: { type: 'string' },
                    status: { type: 'string' },
                    proficiencyLevel: { type: 'string' },
                    score: { type: 'number' },
                    percentile: { type: 'number' },
                    isVisible: { type: 'boolean' },
                    displayOrder: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof GetCredentialsQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const query = GetCredentialsQuerySchema.parse(request.query);
        const includeHidden = query.includeHidden === 'true';

        // For public access, only show visible credentials
        // For authenticated owner, show all based on includeHidden flag
        const isOwner = (request as unknown as { user?: { id: string } }).user?.id === query.userId;

        let credentials;
        if (isOwner && includeHidden) {
          credentials = await credentialService.getUserCredentials(query.userId);
        } else {
          credentials = await credentialService.getVisibleCredentials(query.userId);
        }

        return await reply.code(200).send({
          success: true,
          data: credentials,
        });
      } catch (error) {
        deps.logger.error({ msg: 'Failed to get credentials', error });
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request parameters',
            details: error.errors,
          });
        }
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch credentials',
        });
      }
    }
  );

  // ==========================================================================
  // GET /credentials/skill-confidences - Get skill confidence scores
  // ==========================================================================
  fastify.get(
    '/skill-confidences',
    {
      schema: {
        description: 'Get skill confidence scores for a user',
        tags: ['credentials'],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            skillIds: { type: 'string', description: 'Comma-separated skill IDs' },
          },
          required: ['userId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    userId: { type: 'string' },
                    skillId: { type: 'string' },
                    overallConfidence: { type: 'number' },
                    assessmentScore: { type: 'number' },
                    learningScore: { type: 'number' },
                    experienceScore: { type: 'number' },
                    endorsementScore: { type: 'number' },
                    projectScore: { type: 'number' },
                    calculatedLevel: { type: 'string' },
                    claimedLevel: { type: 'string' },
                    levelMatch: { type: 'boolean' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof GetSkillConfidencesQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const query = GetSkillConfidencesQuerySchema.parse(request.query);

        let confidences = await credentialService.getUserSkillConfidences(query.userId);

        // Filter by skill IDs if provided
        if (query.skillIds) {
          const skillIdSet = new Set(query.skillIds.split(',').map((id) => id.trim()));
          confidences = confidences.filter((c) => skillIdSet.has(c.skillId as string));
        }

        return await reply.code(200).send({
          success: true,
          data: confidences,
        });
      } catch (error) {
        deps.logger.error({ msg: 'Failed to get skill confidences', error });
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request parameters',
            details: error.errors,
          });
        }
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch skill confidences',
        });
      }
    }
  );

  // ==========================================================================
  // POST /credentials/:credentialId/verify - Verify a credential
  // ==========================================================================
  fastify.post(
    '/:credentialId/verify',
    {
      schema: {
        description: 'Verify a credential',
        tags: ['credentials'],
        params: {
          type: 'object',
          properties: {
            credentialId: { type: 'string', format: 'uuid' },
          },
          required: ['credentialId'],
        },
        body: {
          type: 'object',
          properties: {
            verificationCode: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean' },
                  credentialId: { type: 'string' },
                  title: { type: 'string' },
                  issueDate: { type: 'string' },
                  expirationDate: { type: 'string' },
                  status: { type: 'string' },
                  credentialType: { type: 'string' },
                  source: { type: 'string' },
                  score: { type: 'number' },
                  proficiencyLevel: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof VerifyCredentialParamsSchema>;
        Body: z.infer<typeof VerifyCredentialBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const params = VerifyCredentialParamsSchema.parse(request.params);
        const body = VerifyCredentialBodySchema.parse(request.body ?? {});

        const result = await credentialService.verifyCredential(
          params.credentialId,
          body.verificationCode
        );

        return await reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        deps.logger.error({ msg: 'Failed to verify credential', error });
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request parameters',
            details: error.errors,
          });
        }
        return reply.code(500).send({
          success: false,
          error: 'Failed to verify credential',
        });
      }
    }
  );

  // ==========================================================================
  // PATCH /credentials/:credentialId/visibility - Update credential visibility
  // ==========================================================================
  fastify.patch(
    '/:credentialId/visibility',
    {
      schema: {
        description: 'Update credential visibility settings',
        tags: ['credentials'],
        params: {
          type: 'object',
          properties: {
            credentialId: { type: 'string', format: 'uuid' },
          },
          required: ['credentialId'],
        },
        body: {
          type: 'object',
          properties: {
            isVisible: { type: 'boolean' },
            displayOrder: { type: 'number' },
          },
          required: ['isVisible'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof UpdateVisibilityParamsSchema>;
        Body: z.infer<typeof UpdateVisibilityBodySchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const params = UpdateVisibilityParamsSchema.parse(request.params);
        const body = UpdateVisibilityBodySchema.parse(request.body);

        // Get authenticated user ID
        const userId = (request as unknown as { user?: { id: string } }).user?.id;
        if (!userId) {
          return await reply.code(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const updated = await credentialService.updateCredentialVisibility(
          params.credentialId,
          userId,
          body.isVisible,
          body.displayOrder
        );

        if (!updated) {
          return await reply.code(404).send({
            success: false,
            error: 'Credential not found or access denied',
          });
        }

        return await reply.code(200).send({
          success: true,
          data: updated,
        });
      } catch (error) {
        deps.logger.error({ msg: 'Failed to update credential visibility', error });
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request parameters',
            details: error.errors,
          });
        }
        return reply.code(500).send({
          success: false,
          error: 'Failed to update credential visibility',
        });
      }
    }
  );

  // ==========================================================================
  // GET /credentials/learning-activity - Get learning activity summary
  // ==========================================================================
  fastify.get(
    '/learning-activity',
    {
      schema: {
        description: 'Get learning activity for a user',
        tags: ['credentials'],
        querystring: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
          },
          required: ['userId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    userId: { type: 'string' },
                    skillId: { type: 'string' },
                    totalHours: { type: 'number' },
                    coursesCompleted: { type: 'number' },
                    coursesInProgress: { type: 'number' },
                    assessmentsPassed: { type: 'number' },
                    assessmentsFailed: { type: 'number' },
                    lastActivityAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof GetLearningActivityQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const query = GetLearningActivityQuerySchema.parse(request.query);

        const activity = await credentialService.getLearningActivity(query.userId);

        return await reply.code(200).send({
          success: true,
          data: activity,
        });
      } catch (error) {
        deps.logger.error({ msg: 'Failed to get learning activity', error });
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request parameters',
            details: error.errors,
          });
        }
        return reply.code(500).send({
          success: false,
          error: 'Failed to fetch learning activity',
        });
      }
    }
  );

  // ==========================================================================
  // POST /credentials/request-verification - Request skill verification
  // ==========================================================================
  fastify.post(
    '/request-verification',
    {
      schema: {
        description: 'Request verification for a skill',
        tags: ['credentials'],
        body: {
          type: 'object',
          properties: {
            skillId: { type: 'string', format: 'uuid' },
            message: { type: 'string', maxLength: 500 },
          },
          required: ['skillId'],
        },
        response: {
          202: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  requestId: { type: 'string' },
                  skillId: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof RequestVerificationBodySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const body = RequestVerificationBodySchema.parse(request.body);

        // Get authenticated user ID
        const userId = (request as unknown as { user?: { id: string } }).user?.id;
        if (!userId) {
          return await reply.code(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        // TODO: Implement skill verification request workflow
        // This would create a verification request and potentially:
        // 1. Create a SkillVerificationRequest record
        // 2. Send an event to SkillPod to initiate assessment
        // 3. Return a request ID for tracking

        const requestId = crypto.randomUUID();

        deps.logger.info({
          msg: 'Skill verification requested',
          userId,
          skillId: body.skillId,
          requestId,
        });

        return await reply.code(202).send({
          success: true,
          message: 'Verification request submitted',
          data: {
            requestId,
            skillId: body.skillId,
            status: 'pending',
          },
        });
      } catch (error) {
        deps.logger.error({ msg: 'Failed to request skill verification', error });
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid request parameters',
            details: error.errors,
          });
        }
        return reply.code(500).send({
          success: false,
          error: 'Failed to submit verification request',
        });
      }
    }
  );
}
