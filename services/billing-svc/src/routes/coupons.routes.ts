/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
/**
 * @module @skillancer/billing-svc/routes/coupons
 * Coupon and promotion code management routes
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getErrorResponse } from '../errors/index.js';
import { getCouponService } from '../services/coupon.service.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface UserPayload {
  id: string;
  email: string;
  sessionId: string;
  tenantId?: string;
  roles?: string[];
}

// Helper to get user from request (throws if not authenticated)
function requireUser(request: FastifyRequest): UserPayload {
  const user = request.user as UserPayload | undefined;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

// Helper to check admin role
function requireAdmin(request: FastifyRequest): UserPayload {
  const user = requireUser(request);
  if (!user.roles?.includes('admin')) {
    throw new Error('Admin access required');
  }
  return user;
}

// =============================================================================
// SCHEMAS
// =============================================================================

// Create coupon request (admin only)
const CreateCouponSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/i, 'Code must be alphanumeric with underscores or hyphens'),
  name: z.string().min(1).max(100),
  discountType: z.enum(['PERCENT', 'AMOUNT']),
  discountValue: z.number().positive(),
  currency: z.string().length(3).default('usd'),
  maxRedemptions: z.number().int().positive().optional(),
  maxRedemptionsPerUser: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  minPurchaseAmount: z.number().positive().optional(),
  applicableProducts: z.array(z.string()).optional(),
  duration: z.enum(['ONCE', 'REPEATING', 'FOREVER']).default('ONCE'),
  durationInMonths: z.number().int().positive().optional(),
  firstTimeOnly: z.boolean().default(false),
  metadata: z.record(z.string()).optional(),
});

// Validate coupon request
const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  productType: z.enum(['SKILLPOD', 'COCKPIT']).optional(),
  subscriptionId: z.string().uuid().optional(),
});

// Redeem coupon request
const RedeemCouponSchema = z.object({
  code: z.string().min(1),
  subscriptionId: z.string().uuid(),
});

// Create promotion code request (admin only)
const CreatePromotionCodeSchema = z.object({
  couponId: z.string().uuid(),
  code: z.string().min(3).max(50),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  restrictions: z
    .object({
      firstTimeOnly: z.boolean().optional(),
      minimumAmount: z.number().positive().optional(),
      minimumCurrency: z.string().length(3).optional(),
    })
    .optional(),
});

// Pagination schema
const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// =============================================================================
// ROUTE PLUGIN
// =============================================================================

const couponRoutes: FastifyPluginAsync = async (fastify) => {
  const couponService = getCouponService();

  // ===========================================================================
  // VALIDATE COUPON (Public)
  // ===========================================================================

  /**
   * POST /coupons/validate
   * Validate a coupon code
   */
  fastify.post(
    '/validate',
    {
      schema: {
        description: 'Validate a coupon code',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(ValidateCouponSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              coupon: { type: 'object' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const body = ValidateCouponSchema.parse(request.body);

        const validation = await couponService.validateCoupon(
          body.code,
          user.id,
          body.productType,
          body.subscriptionId
        );

        return await reply.send(validation);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // REDEEM COUPON
  // ===========================================================================

  /**
   * POST /coupons/redeem
   * Redeem a coupon for a subscription
   */
  fastify.post(
    '/redeem',
    {
      schema: {
        description: 'Redeem a coupon for a subscription',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(RedeemCouponSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              redemption: { type: 'object' },
              discount: { type: 'object' },
            },
          },
          400: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const body = RedeemCouponSchema.parse(request.body);

        const result = await couponService.redeemCoupon(body.code, user.id, body.subscriptionId);

        return await reply.send(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // USER REDEMPTIONS
  // ===========================================================================

  /**
   * GET /coupons/redemptions
   * Get user's coupon redemption history
   */
  fastify.get<{
    Querystring: z.infer<typeof PaginationSchema>;
  }>(
    '/redemptions',
    {
      schema: {
        description: "Get user's coupon redemption history",
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        querystring: zodToJsonSchema(PaginationSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              redemptions: { type: 'array', items: { type: 'object' } },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = requireUser(request);
        const query = PaginationSchema.parse(request.query);

        const result = await couponService.getRedemptionsForUser(
          user.id,
          query.limit,
          query.offset
        );

        return await reply.send(result);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ADMIN: LIST COUPONS
  // ===========================================================================

  /**
   * GET /coupons
   * List all coupons (admin only)
   */
  fastify.get<{
    Querystring: z.infer<typeof PaginationSchema> & { active?: boolean };
  }>(
    '/',
    {
      schema: {
        description: 'List all coupons (admin only)',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20 },
            offset: { type: 'number', default: 0 },
            active: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              coupons: { type: 'array', items: { type: 'object' } },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        requireAdmin(request);
        const pagination = PaginationSchema.parse(request.query);
        const activeFilter = (request.query as { active?: boolean }).active;

        const result = await couponService.listCoupons(
          pagination.limit,
          pagination.offset,
          activeFilter
        );

        return await reply.send(result);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ADMIN: CREATE COUPON
  // ===========================================================================

  /**
   * POST /coupons
   * Create a new coupon (admin only)
   */
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new coupon (admin only)',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(CreateCouponSchema),
        response: {
          201: { type: 'object' },
          400: { type: 'object' },
          409: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireAdmin(request);
        const body = CreateCouponSchema.parse(request.body);

        const coupon = await couponService.createCoupon({
          code: body.code,
          name: body.name,
          discountType: body.discountType,
          discountValue: body.discountValue,
          currency: body.currency,
          maxRedemptions: body.maxRedemptions,
          maxRedemptionsPerUser: body.maxRedemptionsPerUser,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          minPurchaseAmount: body.minPurchaseAmount,
          applicableProducts: body.applicableProducts,
          duration: body.duration,
          durationInMonths: body.durationInMonths,
          firstTimeOnly: body.firstTimeOnly,
          metadata: body.metadata,
        });

        return await reply.code(201).send(coupon);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ADMIN: GET COUPON DETAILS
  // ===========================================================================

  /**
   * GET /coupons/:couponId
   * Get coupon details (admin only)
   */
  fastify.get<{
    Params: { couponId: string };
  }>(
    '/:couponId',
    {
      schema: {
        description: 'Get coupon details (admin only)',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            couponId: { type: 'string', format: 'uuid' },
          },
          required: ['couponId'],
        },
        response: {
          200: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        requireAdmin(request);

        const coupon = await couponService.getCoupon(request.params.couponId);

        if (!coupon) {
          return await reply.code(404).send({
            error: 'NotFound',
            code: 'COUPON_NOT_FOUND',
            message: 'Coupon not found',
          });
        }

        return await reply.send(coupon);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ADMIN: DEACTIVATE COUPON
  // ===========================================================================

  /**
   * DELETE /coupons/:couponId
   * Deactivate a coupon (admin only)
   */
  fastify.delete<{
    Params: { couponId: string };
  }>(
    '/:couponId',
    {
      schema: {
        description: 'Deactivate a coupon (admin only)',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            couponId: { type: 'string', format: 'uuid' },
          },
          required: ['couponId'],
        },
        response: {
          200: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        requireAdmin(request);

        const coupon = await couponService.deactivateCoupon(request.params.couponId);

        return await reply.send({
          coupon,
          message: 'Coupon deactivated successfully',
        });
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ADMIN: PROMOTION CODES
  // ===========================================================================

  /**
   * GET /coupons/:couponId/promotion-codes
   * List promotion codes for a coupon (admin only)
   */
  fastify.get<{
    Params: { couponId: string };
    Querystring: z.infer<typeof PaginationSchema>;
  }>(
    '/:couponId/promotion-codes',
    {
      schema: {
        description: 'List promotion codes for a coupon (admin only)',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            couponId: { type: 'string', format: 'uuid' },
          },
          required: ['couponId'],
        },
        querystring: zodToJsonSchema(PaginationSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              promotionCodes: { type: 'array', items: { type: 'object' } },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        requireAdmin(request);
        const pagination = PaginationSchema.parse(request.query);

        const result = await couponService.listPromotionCodes(
          request.params.couponId,
          pagination.limit
        );

        return await reply.send(result);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /coupons/:couponId/promotion-codes
   * Create a promotion code for a coupon (admin only)
   */
  fastify.post<{
    Params: { couponId: string };
  }>(
    '/:couponId/promotion-codes',
    {
      schema: {
        description: 'Create a promotion code for a coupon (admin only)',
        tags: ['coupons'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            couponId: { type: 'string', format: 'uuid' },
          },
          required: ['couponId'],
        },
        body: zodToJsonSchema(CreatePromotionCodeSchema.omit({ couponId: true })),
        response: {
          201: { type: 'object' },
          400: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        requireAdmin(request);
        const params = request.params;
        const bodySchema = CreatePromotionCodeSchema.omit({ couponId: true });
        const body = bodySchema.parse(request.body);

        const promotionCode = await couponService.createPromotionCode(params.couponId, body.code, {
          maxRedemptions: body.maxRedemptions,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          restrictions: body.restrictions,
        });

        return await reply.code(201).send(promotionCode);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );
};

export default couponRoutes;

export { couponRoutes };

export async function registerCouponRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(couponRoutes, { prefix: '/coupons' });
}
