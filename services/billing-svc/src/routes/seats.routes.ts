// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/require-await */
/**
 * Seats Routes
 * API endpoints for seat management in team subscriptions
 */

import { requireAuth } from '../middleware/auth.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface SubscriptionParams {
  subscriptionId: string;
}

interface SeatParams extends SubscriptionParams {
  seatId: string;
}

interface AssignSeatBody {
  userId: string;
  email: string;
  role?: string;
}

interface UpdateSeatBody {
  role?: string;
}

// Stub seat storage (would be in database in production)
const seatStorage = new Map<
  string,
  Array<{
    id: string;
    userId: string;
    email: string;
    role: string;
    assignedAt: Date;
  }>
>();

export async function registerSeatsRoutes(fastify: FastifyInstance): Promise<void> {
  // List seats for a subscription
  fastify.get<{ Params: SubscriptionParams }>(
    '/subscriptions/:subscriptionId/seats',
    {
      preHandler: [requireAuth, requireActiveSubscription],
      schema: {
        description: 'List all seats for a subscription',
        tags: ['Seats'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
          },
          required: ['subscriptionId'],
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
                    email: { type: 'string' },
                    role: { type: 'string' },
                    assignedAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: SubscriptionParams }>, reply: FastifyReply) => {
      const { subscriptionId } = request.params;
      const seats = seatStorage.get(subscriptionId) ?? [];

      return reply.send({ success: true, data: seats });
    }
  );

  // Assign a seat
  fastify.post<{ Params: SubscriptionParams; Body: AssignSeatBody }>(
    '/subscriptions/:subscriptionId/seats',
    {
      preHandler: [requireAuth, requireActiveSubscription],
      schema: {
        description: 'Assign a seat to a user',
        tags: ['Seats'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
          },
          required: ['subscriptionId'],
        },
        body: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', default: 'member' },
          },
          required: ['userId', 'email'],
        },
        response: {
          201: {
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
      request: FastifyRequest<{ Params: SubscriptionParams; Body: AssignSeatBody }>,
      reply: FastifyReply
    ) => {
      const { subscriptionId } = request.params;
      const { userId, email, role = 'member' } = request.body;

      const seat = {
        id: `seat_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        userId,
        email,
        role,
        assignedAt: new Date(),
      };

      const seats = seatStorage.get(subscriptionId) ?? [];
      seats.push(seat);
      seatStorage.set(subscriptionId, seats);

      return reply.status(201).send({ success: true, data: seat });
    }
  );

  // Update a seat
  fastify.patch<{ Params: SeatParams; Body: UpdateSeatBody }>(
    '/subscriptions/:subscriptionId/seats/:seatId',
    {
      preHandler: [requireAuth, requireActiveSubscription],
      schema: {
        description: 'Update a seat assignment',
        tags: ['Seats'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
            seatId: { type: 'string' },
          },
          required: ['subscriptionId', 'seatId'],
        },
        body: {
          type: 'object',
          properties: {
            role: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: SeatParams; Body: UpdateSeatBody }>,
      reply: FastifyReply
    ) => {
      const { subscriptionId, seatId } = request.params;
      const { role } = request.body;

      const seats = seatStorage.get(subscriptionId) ?? [];
      const seatIndex = seats.findIndex((s) => s.id === seatId);

      if (seatIndex === -1) {
        return reply.status(404).send({
          success: false,
          error: 'Seat not found',
        });
      }

      if (role) {
        seats[seatIndex].role = role;
      }

      return reply.send({ success: true, data: seats[seatIndex] });
    }
  );

  // Remove a seat
  fastify.delete<{ Params: SeatParams }>(
    '/subscriptions/:subscriptionId/seats/:seatId',
    {
      preHandler: [requireAuth, requireActiveSubscription],
      schema: {
        description: 'Remove a seat assignment',
        tags: ['Seats'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
            seatId: { type: 'string' },
          },
          required: ['subscriptionId', 'seatId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: SeatParams }>, reply: FastifyReply) => {
      const { subscriptionId, seatId } = request.params;

      const seats = seatStorage.get(subscriptionId) ?? [];
      const seatIndex = seats.findIndex((s) => s.id === seatId);

      if (seatIndex === -1) {
        return reply.status(404).send({
          success: false,
          error: 'Seat not found',
        });
      }

      seats.splice(seatIndex, 1);
      seatStorage.set(subscriptionId, seats);

      return reply.send({ success: true, message: 'Seat removed successfully' });
    }
  );
}
