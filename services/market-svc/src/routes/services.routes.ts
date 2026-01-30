// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Service Catalog Routes
 *
 * Public API endpoints for service catalog management
 */

import { z } from 'zod';

import { ServiceCatalogError } from '../errors/service-catalog.errors.js';
import { createMarketRateLimitHook } from '../middleware/rate-limit.js';
import { ServiceCatalogService } from '../services/service-catalog.service.js';

import type { ServiceCategory } from '../types/service-catalog.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const DeliverableSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

const RequirementSchema = z.object({
  question: z.string().min(1).max(500),
  type: z.enum(['TEXT', 'TEXTAREA', 'SELECT', 'FILE', 'MULTIPLE_SELECT']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const FAQSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000),
});

const PackageFeatureSchema = z.object({
  feature: z.string().min(1).max(200),
  included: z.boolean(),
});

const PackageDeliverableSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().int().positive(),
});

const CreatePackageSchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['BASIC', 'STANDARD', 'PREMIUM']),
  description: z.string().max(500).optional(),
  price: z.number().positive(),
  deliveryDays: z.number().int().positive().max(365),
  revisionsIncluded: z.number().int().min(0).max(100),
  features: z.array(PackageFeatureSchema),
  deliverables: z.array(PackageDeliverableSchema),
  maxRevisions: z.number().int().min(0).optional(),
});

const UpdatePackageSchema = CreatePackageSchema.partial();

const CreateAddOnSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  price: z.number().positive(),
  additionalDays: z.number().int().min(0).max(365).optional(),
  allowQuantity: z.boolean().optional(),
  maxQuantity: z.number().int().positive().optional(),
});

const UpdateAddOnSchema = CreateAddOnSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const CreateServiceSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(100).max(10000),
  shortDescription: z.string().min(20).max(300),
  category: z.enum([
    'DEVELOPMENT',
    'DESIGN',
    'WRITING',
    'MARKETING',
    'VIDEO',
    'MUSIC',
    'BUSINESS',
    'DATA',
    'LIFESTYLE',
    'OTHER',
  ]),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  skills: z.array(z.string().uuid()).max(10).optional(),
  basePrice: z.number().positive(),
  currency: z.string().length(3).optional(),
  deliveryDays: z.number().int().positive().max(365),
  revisionsIncluded: z.number().int().min(0).max(100).optional(),
  deliverables: z.array(DeliverableSchema).min(1),
  requirements: z.array(RequirementSchema).optional(),
  thumbnailUrl: z.string().url().optional(),
  galleryUrls: z.array(z.string().url()).max(10).optional(),
  videoUrl: z.string().url().optional(),
  faqs: z.array(FAQSchema).max(20).optional(),
  packages: z.array(CreatePackageSchema).max(3).optional(),
  addOns: z.array(CreateAddOnSchema).max(10).optional(),
});

const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const SearchServicesSchema = z.object({
  query: z.string().optional(),
  category: z
    .enum([
      'DEVELOPMENT',
      'DESIGN',
      'WRITING',
      'MARKETING',
      'VIDEO',
      'MUSIC',
      'BUSINESS',
      'DATA',
      'LIFESTYLE',
      'OTHER',
    ])
    .optional(),
  subcategory: z.string().optional(),
  priceMin: z.string().transform(Number).optional(),
  priceMax: z.string().transform(Number).optional(),
  deliveryDays: z.string().transform(Number).optional(),
  minRating: z.string().transform(Number).optional(),
  skills: z.array(z.string()).optional(),
  sellerId: z.string().uuid().optional(),
  sortBy: z
    .enum(['relevance', 'bestselling', 'newest', 'price_low', 'price_high', 'rating'])
    .optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface ServiceRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerServiceRoutes(fastify: FastifyInstance, deps: ServiceRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const serviceCatalogService = new ServiceCatalogService(prisma, redis, logger);

  // Rate limit hooks
  const serviceCreationRateLimitHook = fastify.marketRateLimit?.serviceCreation;
  const searchRateLimitHook = fastify.marketRateLimit?.searchQueries;

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Helper to get optional user (prefixed with _ as currently unused but planned for future use)
  const _getOptionalUser = (request: any) => {
    return request.user as { id: string; email: string; role: string } | undefined;
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
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
  };

  // ==========================================================================
  // SERVICE CRUD
  // ==========================================================================

  // POST /services - Create a new service (rate limited to prevent spam)
  fastify.post(
    '/',
    {
      preHandler: serviceCreationRateLimitHook ? [serviceCreationRateLimitHook] : [],
    },
    async (request, reply) => {
      try {
        const user = getUser(request);
        const body = CreateServiceSchema.parse(request.body);

        const service = await serviceCatalogService.createService(user.id, body);

        logger.info({
          msg: 'Service created',
          serviceId: service.id,
          freelancerId: user.id,
        });

        return await reply.status(201).send({
          success: true,
          service,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /services/search - Search services (rate limited - can be expensive)
  fastify.get(
    '/search',
    {
      preHandler: searchRateLimitHook ? [searchRateLimitHook] : [],
    },
    async (request, reply) => {
      try {
        const query = SearchServicesSchema.parse(request.query);

        const result = await serviceCatalogService.searchServices({
          query: query.query,
          category: query.category,
          subcategory: query.subcategory,
          priceMin: query.priceMin,
          priceMax: query.priceMax,
          deliveryDays: query.deliveryDays,
          minRating: query.minRating,
          skills: query.skills,
          sellerId: query.sellerId,
          sortBy: query.sortBy,
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
    }
  );

  // GET /services/featured - Get featured services
  fastify.get('/featured', async (request, reply) => {
    try {
      const limit = Math.min(Number((request.query as Record<string, string>).limit) || 10, 20);

      const services = await serviceCatalogService.getFeaturedServices(limit);

      return await reply.send({
        success: true,
        services,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /services/trending - Get trending services
  fastify.get('/trending', async (request, reply) => {
    try {
      const limit = Math.min(Number((request.query as Record<string, string>).limit) || 10, 20);

      const services = await serviceCatalogService.getTrendingServices(limit);

      return await reply.send({
        success: true,
        services,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /services/category/:category - Get services by category
  fastify.get('/category/:category', async (request, reply) => {
    try {
      const { category } = request.params as { category: string };
      const { page, limit } = request.query as { page?: string; limit?: string };

      const pageNum = Number(page) || 1;
      const limitNum = Math.min(Number(limit) || 20, 50);
      const offset = (pageNum - 1) * limitNum;

      const result = await serviceCatalogService.getServicesByCategory(
        category as ServiceCategory,
        limitNum,
        offset
      );

      return await reply.send({
        success: true,
        ...result,
        page: pageNum,
        limit: limitNum,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /services/me - Get my services (as seller)
  fastify.get('/me', async (request, reply) => {
    try {
      const user = getUser(request);
      const { status, page, limit } = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = Number(page) || 1;
      const limitNum = Math.min(Number(limit) || 20, 50);
      const offset = (pageNum - 1) * limitNum;

      const result = await serviceCatalogService.getServicesByFreelancer(user.id, {
        status: status as any,
        limit: limitNum,
        offset,
      });

      return await reply.send({
        success: true,
        services: result.services,
        total: result.total,
        page: pageNum,
        limit: limitNum,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /services/:id - Get a service by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const service = await serviceCatalogService.getService(id);

      return await reply.send({
        success: true,
        service,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /services/slug/:slug - Get a service by slug
  fastify.get('/slug/:slug', async (request, reply) => {
    try {
      const { slug } = request.params as { slug: string };

      const service = await serviceCatalogService.getServiceBySlug(slug);

      return await reply.send({
        success: true,
        service,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /services/:id - Update a service
  fastify.patch('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateServiceSchema.parse(request.body);

      const service = await serviceCatalogService.updateService(id, user.id, body);

      logger.info({
        msg: 'Service updated',
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        service,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /services/:id - Delete a draft service
  fastify.delete('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await serviceCatalogService.deleteService(id, user.id);

      logger.info({
        msg: 'Service deleted',
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // SERVICE LIFECYCLE
  // ==========================================================================

  // POST /services/:id/submit - Submit service for review
  fastify.post('/:id/submit', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const service = await serviceCatalogService.submitForReview(id, user.id);

      logger.info({
        msg: 'Service submitted for review',
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        service,
        message: 'Service submitted for review',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /services/:id/pause - Pause a service
  fastify.post('/:id/pause', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const service = await serviceCatalogService.pauseService(id, user.id);

      logger.info({
        msg: 'Service paused',
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        service,
        message: 'Service paused',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /services/:id/unpause - Unpause a service
  fastify.post('/:id/unpause', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const service = await serviceCatalogService.unpauseService(id, user.id);

      logger.info({
        msg: 'Service unpaused',
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        service,
        message: 'Service reactivated',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /services/:id/archive - Archive a service
  fastify.post('/:id/archive', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await serviceCatalogService.archiveService(id, user.id);

      logger.info({
        msg: 'Service archived',
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Service archived',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // PACKAGE MANAGEMENT
  // ==========================================================================

  // POST /services/:id/packages - Add a package
  fastify.post('/:id/packages', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = CreatePackageSchema.parse(request.body);

      const pkg = await serviceCatalogService.addPackage(id, user.id, body);

      logger.info({
        msg: 'Package added',
        packageId: pkg.id,
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        package: pkg,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /services/:serviceId/packages/:packageId - Update a package
  fastify.patch('/:serviceId/packages/:packageId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { packageId } = request.params as { serviceId: string; packageId: string };
      const body = UpdatePackageSchema.parse(request.body);

      const pkg = await serviceCatalogService.updatePackage(packageId, user.id, body);

      logger.info({
        msg: 'Package updated',
        packageId,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        package: pkg,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /services/:serviceId/packages/:packageId - Delete a package
  fastify.delete('/:serviceId/packages/:packageId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { packageId } = request.params as { serviceId: string; packageId: string };

      await serviceCatalogService.deletePackage(packageId, user.id);

      logger.info({
        msg: 'Package deleted',
        packageId,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Package deleted',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // ADD-ON MANAGEMENT
  // ==========================================================================

  // POST /services/:id/addons - Add an add-on
  fastify.post('/:id/addons', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = CreateAddOnSchema.parse(request.body);

      const addOn = await serviceCatalogService.addAddOn(id, user.id, body);

      logger.info({
        msg: 'Add-on added',
        addOnId: addOn.id,
        serviceId: id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        addOn,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /services/:serviceId/addons/:addOnId - Update an add-on
  fastify.patch('/:serviceId/addons/:addOnId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { addOnId } = request.params as { serviceId: string; addOnId: string };
      const body = UpdateAddOnSchema.parse(request.body);

      const addOn = await serviceCatalogService.updateAddOn(addOnId, user.id, body);

      logger.info({
        msg: 'Add-on updated',
        addOnId,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        addOn,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /services/:serviceId/addons/:addOnId - Delete an add-on
  fastify.delete('/:serviceId/addons/:addOnId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { addOnId } = request.params as { serviceId: string; addOnId: string };

      await serviceCatalogService.deleteAddOn(addOnId, user.id);

      logger.info({
        msg: 'Add-on deleted',
        addOnId,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Add-on deleted',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
