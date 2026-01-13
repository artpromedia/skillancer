// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Service Order Routes
 *
 * Public API endpoints for service order management
 */

import { z } from 'zod';

import { ServiceCatalogError } from '../errors/service-catalog.errors.js';
import { ServiceOrderService } from '../services/service-order.service.js';
import { ServiceReviewService } from '../services/service-review.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateOrderSchema = z.object({
  serviceId: z.string().uuid(),
  packageId: z.string().uuid(),
  addOnIds: z
    .array(
      z.object({
        addOnId: z.string().uuid(),
        quantity: z.number().int().positive().default(1),
      })
    )
    .optional(),
  couponCode: z.string().optional(),
});

const SubmitRequirementsSchema = z.object({
  answers: z.record(z.unknown()),
});

const ProcessPaymentSchema = z.object({
  paymentMethodId: z.string().optional(),
  paymentIntentId: z.string().optional(),
});

const DeliveryFileSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().int().positive(),
  type: z.string().max(100),
});

const SubmitDeliverySchema = z.object({
  message: z.string().max(2000).optional(),
  files: z.array(DeliveryFileSchema).min(1),
});

const RequestRevisionSchema = z.object({
  description: z.string().min(10).max(2000),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
      })
    )
    .optional(),
});

const CancelOrderSchema = z.object({
  reason: z.string().min(10).max(1000),
});

const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        size: z.number().optional(),
        type: z.string().optional(),
      })
    )
    .optional(),
});

const CreateReviewSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5).optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  deliveryRating: z.number().int().min(1).max(5).optional(),
  valueRating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(100).optional(),
  content: z.string().max(2000).optional(),
});

const AddSellerResponseSchema = z.object({
  response: z.string().min(10).max(1000),
});

const OrderListQuerySchema = z.object({
  status: z
    .enum([
      'PENDING_REQUIREMENTS',
      'PENDING_PAYMENT',
      'IN_PROGRESS',
      'DELIVERED',
      'REVISION_REQUESTED',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ])
    .optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface OrderRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Shared Helpers
// ============================================================================

// Helper to get authenticated user
function getUser(request: any): { id: string; email: string; role: string } {
  if (!request.user) {
    throw new Error('Authentication required');
  }
  return request.user as { id: string; email: string; role: string };
}

// Error handler
function handleError(error: unknown, reply: any): unknown {
  if (error instanceof ServiceCatalogError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }
  throw error;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerServiceOrderRoutes(fastify: FastifyInstance, deps: OrderRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize services
  const orderService = new ServiceOrderService(prisma, redis, logger);
  const reviewService = new ServiceReviewService(prisma, redis, logger);

  // ==========================================================================
  // ORDER MANAGEMENT
  // ==========================================================================

  // POST /service-orders - Create a new order
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateOrderSchema.parse(request.body);

      const order = await orderService.createOrder(user.id, body);

      logger.info({
        msg: 'Service order created',
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        order,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/buyer - Get orders as buyer
  fastify.get('/buyer', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = OrderListQuerySchema.parse(request.query);

      const result = await orderService.getBuyerOrders(user.id, {
        status: query.status as any,
        page: query.page,
        limit: Math.min(query.limit, 50),
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/seller - Get orders as seller
  fastify.get('/seller', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = OrderListQuerySchema.parse(request.query);

      const result = await orderService.getSellerOrders(user.id, {
        status: query.status as any,
        page: query.page,
        limit: Math.min(query.limit, 50),
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/seller/stats - Get seller stats
  fastify.get('/seller/stats', async (request, reply) => {
    try {
      const user = getUser(request);

      const stats = await orderService.getSellerStats(user.id);

      return await reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/:id - Get an order by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const order = await orderService.getOrder(id, user.id);

      return await reply.send({
        success: true,
        order,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/number/:orderNumber - Get an order by order number
  fastify.get('/number/:orderNumber', async (request, reply) => {
    try {
      const user = getUser(request);
      const { orderNumber } = request.params as { orderNumber: string };

      const order = await orderService.getOrderByNumber(orderNumber, user.id);

      return await reply.send({
        success: true,
        order,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // ORDER LIFECYCLE
  // ==========================================================================

  // POST /service-orders/:id/requirements - Submit requirements
  fastify.post('/:id/requirements', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = SubmitRequirementsSchema.parse(request.body);

      const order = await orderService.submitRequirements(id, user.id, body);

      logger.info({
        msg: 'Order requirements submitted',
        orderId: id,
        buyerId: user.id,
      });

      return await reply.send({
        success: true,
        order,
        message: 'Requirements submitted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /service-orders/:id/pay - Process payment
  fastify.post('/:id/pay', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = ProcessPaymentSchema.parse(request.body);

      // In production, this would create a Stripe PaymentIntent
      // For now, we'll simulate with a generated ID
      const paymentIntentId =
        body.paymentIntentId || `pi_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const order = await orderService.processPayment(id, user.id, paymentIntentId);

      logger.info({
        msg: 'Order payment processed',
        orderId: id,
        buyerId: user.id,
        paymentIntentId,
      });

      return await reply.send({
        success: true,
        order,
        message: 'Payment processed successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /service-orders/:id/cancel - Cancel an order
  fastify.post('/:id/cancel', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = CancelOrderSchema.parse(request.body);

      const order = await orderService.cancelOrder(id, user.id, body);

      logger.info({
        msg: 'Order cancelled',
        orderId: id,
        cancelledBy: user.id,
      });

      return await reply.send({
        success: true,
        order,
        message: 'Order cancelled',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // DELIVERY
  // ==========================================================================

  // POST /service-orders/:id/deliver - Submit a delivery
  fastify.post('/:id/deliver', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = SubmitDeliverySchema.parse(request.body);

      const delivery = await orderService.submitDelivery(id, user.id, body);

      logger.info({
        msg: 'Delivery submitted',
        orderId: id,
        deliveryId: delivery.id,
        sellerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        delivery,
        message: 'Delivery submitted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /service-orders/:id/accept - Accept delivery
  fastify.post('/:id/accept', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const delivery = await orderService.acceptDelivery(id, user.id);

      logger.info({
        msg: 'Delivery accepted',
        orderId: id,
        buyerId: user.id,
      });

      return await reply.send({
        success: true,
        delivery,
        message: 'Delivery accepted, order completed!',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /service-orders/:id/revision - Request a revision
  fastify.post('/:id/revision', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = RequestRevisionSchema.parse(request.body);

      const revision = await orderService.requestRevision(id, user.id, body);

      logger.info({
        msg: 'Revision requested',
        orderId: id,
        revisionId: revision.id,
        buyerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        revision,
        message: 'Revision requested',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/:id/deliveries - Get order deliveries
  fastify.get('/:id/deliveries', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const deliveries = await orderService.getOrderDeliveries(id, user.id);

      return await reply.send({
        success: true,
        deliveries,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/:id/revisions - Get order revisions
  fastify.get('/:id/revisions', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const revisions = await orderService.getOrderRevisions(id, user.id);

      return await reply.send({
        success: true,
        revisions,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // MESSAGING
  // ==========================================================================

  // POST /service-orders/:id/messages - Send a message
  fastify.post('/:id/messages', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = SendMessageSchema.parse(request.body);

      // Map attachments to remove undefined properties for exactOptionalPropertyTypes
      const attachments = body.attachments?.map((a) => ({
        name: a.name,
        url: a.url,
        ...(a.size !== undefined && { size: a.size }),
        ...(a.type !== undefined && { type: a.type }),
      }));

      const message = await orderService.sendMessage(id, user.id, {
        content: body.content,
        ...(attachments && { attachments }),
      });

      logger.info({
        msg: 'Order message sent',
        orderId: id,
        messageId: message.id,
        senderId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        message,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/:id/messages - Get order messages
  fastify.get('/:id/messages', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const { limit, before } = request.query as { limit?: string; before?: string };

      const messages = await orderService.getOrderMessages(
        id,
        user.id,
        Number(limit) || 50,
        before
      );

      return await reply.send({
        success: true,
        messages,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/:id/unread-count - Get unread message count
  fastify.get('/:id/unread-count', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const count = await orderService.getUnreadCount(id, user.id);

      return await reply.send({
        success: true,
        unreadCount: count,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // REVIEWS
  // ==========================================================================

  // POST /service-orders/:id/review - Create a review
  fastify.post('/:id/review', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = CreateReviewSchema.parse(request.body);

      const review = await reviewService.createReview(id, user.id, body);

      logger.info({
        msg: 'Service review created',
        orderId: id,
        reviewId: review.id,
        reviewerId: user.id,
        rating: body.overallRating,
      });

      return await reply.status(201).send({
        success: true,
        review,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-orders/:id/review - Get order review
  fastify.get('/:id/review', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // First get the order to find the review
      const user = getUser(request);
      await orderService.getOrder(id, user.id); // Validates access

      // Review lookup by orderId would need to be added to review service
      // For now, we'll return the order's review if it exists
      return await reply.send({
        success: true,
        message: 'Use GET /reviews/:reviewId for review details',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

// ============================================================================
// Review Routes (separate registration)
// ============================================================================

export function registerServiceReviewRoutes(fastify: FastifyInstance, deps: OrderRouteDeps): void {
  const { prisma, redis, logger } = deps;

  const reviewService = new ServiceReviewService(prisma, redis, logger);

  // GET /service-reviews/service/:serviceId - Get service reviews
  fastify.get('/service/:serviceId', async (request, reply) => {
    try {
      const { serviceId } = request.params as { serviceId: string };
      const { minRating, sortBy, page, limit } = request.query as {
        minRating?: string;
        sortBy?: string;
        page?: string;
        limit?: string;
      };

      const result = await reviewService.getServiceReviews(serviceId, {
        ...(minRating && { minRating: Number(minRating) }),
        ...(sortBy && { sortBy: sortBy as 'newest' | 'helpful' | 'highest' | 'lowest' }),
        page: Number(page) || 1,
        limit: Math.min(Number(limit) || 20, 50),
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-reviews/service/:serviceId/stats - Get service review stats
  fastify.get('/service/:serviceId/stats', async (request, reply) => {
    try {
      const { serviceId } = request.params as { serviceId: string };

      const stats = await reviewService.getServiceStats(serviceId);

      return await reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-reviews/seller/:sellerId/stats - Get seller review stats
  fastify.get('/seller/:sellerId/stats', async (request, reply) => {
    try {
      const { sellerId } = request.params as { sellerId: string };

      const stats = await reviewService.getSellerStats(sellerId);

      return await reply.send({
        success: true,
        stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-reviews/me - Get my reviews
  fastify.get('/me', async (request, reply) => {
    try {
      const user = getUser(request);
      const { page, limit } = request.query as { page?: string; limit?: string };

      const result = await reviewService.getUserReviews(user.id, {
        page: Number(page) || 1,
        limit: Math.min(Number(limit) || 20, 50),
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /service-reviews/:id - Get a review by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const review = await reviewService.getReview(id);

      return await reply.send({
        success: true,
        review,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /service-reviews/:id - Update a review
  fastify.patch('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = CreateReviewSchema.partial().parse(request.body);

      // Filter out undefined values for exactOptionalPropertyTypes
      const updateData: Record<string, unknown> = {};
      if (body.overallRating !== undefined) updateData.overallRating = body.overallRating;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.communicationRating !== undefined)
        updateData.communicationRating = body.communicationRating;
      if (body.qualityRating !== undefined) updateData.qualityRating = body.qualityRating;
      if (body.deliveryRating !== undefined) updateData.deliveryRating = body.deliveryRating;
      if (body.valueRating !== undefined) updateData.valueRating = body.valueRating;

      const review = await reviewService.updateReview(id, user.id, updateData);

      logger.info({
        msg: 'Service review updated',
        reviewId: id,
        reviewerId: user.id,
      });

      return await reply.send({
        success: true,
        review,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /service-reviews/:id - Delete a review
  fastify.delete('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await reviewService.deleteReview(id, user.id);

      logger.info({
        msg: 'Service review deleted',
        reviewId: id,
        reviewerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Review deleted',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /service-reviews/:id/respond - Add seller response
  fastify.post('/:id/respond', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = AddSellerResponseSchema.parse(request.body);

      const review = await reviewService.addSellerResponse(id, user.id, body);

      logger.info({
        msg: 'Seller response added',
        reviewId: id,
        sellerId: user.id,
      });

      return await reply.send({
        success: true,
        review,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /service-reviews/:id/helpful - Mark review as helpful
  fastify.post('/:id/helpful', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const review = await reviewService.markAsHelpful(id, user.id);

      return await reply.send({
        success: true,
        review,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

