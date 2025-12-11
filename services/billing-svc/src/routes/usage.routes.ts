/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * Usage Routes
 * API endpoints for metered usage tracking
 */

import { requireAuth } from '../middleware/auth.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { usageService } from '../services/usage.service';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface RecordUsageBody {
  subscriptionId: string;
  metricName: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

interface GetUsageParams {
  subscriptionId: string;
}

interface GetUsageQuery {
  metricName: string;
  periodStart: string;
  periodEnd: string;
}

export async function registerUsageRoutes(fastify: FastifyInstance): Promise<void> {
  // Record usage
  fastify.post<{ Body: RecordUsageBody }>(
    '/usage',
    {
      preHandler: [requireAuth, requireActiveSubscription],
      schema: {
        description: 'Record metered usage for a subscription',
        tags: ['Usage'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
            metricName: { type: 'string' },
            quantity: { type: 'number', minimum: 0 },
            metadata: { type: 'object' },
          },
          required: ['subscriptionId', 'metricName', 'quantity'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  subscriptionId: { type: 'string' },
                  metricName: { type: 'string' },
                  quantity: { type: 'number' },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RecordUsageBody }>, reply: FastifyReply) => {
      const { subscriptionId, metricName, quantity, metadata } = request.body;

      const record = await usageService.recordUsage(subscriptionId, metricName, quantity, metadata);

      return reply.status(201).send({ success: true, data: record });
    }
  );

  // Get usage for a subscription
  fastify.get<{ Params: GetUsageParams; Querystring: GetUsageQuery }>(
    '/usage/:subscriptionId',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Get usage records for a subscription',
        tags: ['Usage'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
          },
          required: ['subscriptionId'],
        },
        querystring: {
          type: 'object',
          properties: {
            metricName: { type: 'string' },
            periodStart: { type: 'string', format: 'date-time' },
            periodEnd: { type: 'string', format: 'date-time' },
          },
          required: ['metricName', 'periodStart', 'periodEnd'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GetUsageParams; Querystring: GetUsageQuery }>,
      reply: FastifyReply
    ) => {
      const { subscriptionId } = request.params;
      const { metricName, periodStart, periodEnd } = request.query;

      const records = usageService.getUsage(
        subscriptionId,
        metricName,
        new Date(periodStart),
        new Date(periodEnd)
      );

      return reply.send({ success: true, data: records });
    }
  );

  // Get usage stats for a subscription
  fastify.get<{ Params: GetUsageParams; Querystring: GetUsageQuery }>(
    '/usage/:subscriptionId/stats',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Get usage statistics for a subscription',
        tags: ['Usage'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
          },
          required: ['subscriptionId'],
        },
        querystring: {
          type: 'object',
          properties: {
            metricName: { type: 'string' },
            periodStart: { type: 'string', format: 'date-time' },
            periodEnd: { type: 'string', format: 'date-time' },
          },
          required: ['metricName', 'periodStart', 'periodEnd'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalQuantity: { type: 'number' },
                  recordCount: { type: 'number' },
                  periodStart: { type: 'string' },
                  periodEnd: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: GetUsageParams; Querystring: GetUsageQuery }>,
      reply: FastifyReply
    ) => {
      const { subscriptionId } = request.params;
      const { metricName, periodStart, periodEnd } = request.query;

      const stats = usageService.getUsageStats(
        subscriptionId,
        metricName,
        new Date(periodStart),
        new Date(periodEnd)
      );

      return reply.send({ success: true, data: stats });
    }
  );
}
