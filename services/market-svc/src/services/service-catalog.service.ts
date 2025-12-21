/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Service Catalog Service
 *
 * Core service for managing productized services:
 * - Create and update services
 * - Manage packages and add-ons
 * - Publish and manage service status
 * - Search and discover services
 */

import { ServiceCatalogError, ServiceCatalogErrorCode } from '../errors/service-catalog.errors.js';
import { ServiceRepository } from '../repositories/service.repository.js';

import type {
  CreateServiceInput,
  UpdateServiceInput,
  CreatePackageInput,
  UpdatePackageInput,
  CreateAddOnInput,
  UpdateAddOnInput,
  ServiceSearchParams,
  ServiceCategory,
  ServiceStatus,
} from '../types/service-catalog.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Cache TTLs
const SERVICE_CACHE_TTL = 300; // 5 minutes
const SEARCH_CACHE_TTL = 60; // 1 minute

export class ServiceCatalogService {
  private readonly repository: ServiceRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.repository = new ServiceRepository(prisma);
  }

  // ===========================================================================
  // SERVICE MANAGEMENT
  // ===========================================================================

  /**
   * Create a new service
   */
  async createService(freelancerId: string, input: CreateServiceInput) {
    // Generate unique slug
    const slug = await this.generateUniqueSlug(input.title);

    const service = await this.repository.create(freelancerId, {
      ...input,
      slug,
    });

    this.logger.info({
      msg: 'Service created',
      serviceId: service.id,
      freelancerId,
    });

    return service;
  }

  /**
   * Get a service by ID
   */
  async getService(serviceId: string) {
    // Try cache first
    const cacheKey = `service:${serviceId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    // Cache the result
    await this.redis.setex(cacheKey, SERVICE_CACHE_TTL, JSON.stringify(service));

    return service;
  }

  /**
   * Get a service by slug
   */
  async getServiceBySlug(slug: string) {
    const service = await this.repository.findBySlug(slug);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    // Increment view count asynchronously
    this.repository.incrementViewCount(service.id).catch((err) => {
      this.logger.error({ msg: 'Failed to increment view count', err, serviceId: service.id });
    });

    return service;
  }

  /**
   * Get services by freelancer
   */
  async getServicesByFreelancer(
    freelancerId: string,
    options?: { status?: ServiceStatus; limit?: number; offset?: number }
  ) {
    return this.repository.findByFreelancerId(freelancerId, options);
  }

  /**
   * Update a service
   */
  async updateService(serviceId: string, userId: string, input: UpdateServiceInput) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    // Can only update draft or paused services
    if (!['DRAFT', 'PAUSED', 'ACTIVE'].includes(service.status)) {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        'Cannot update a service in this status'
      );
    }

    const updatedService = await this.repository.update(serviceId, input);

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service updated',
      serviceId,
      userId,
    });

    return updatedService;
  }

  /**
   * Submit a service for review (publish request)
   */
  async submitForReview(serviceId: string, userId: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    if (service.status !== 'DRAFT' && service.status !== 'REJECTED') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        'Only draft or rejected services can be submitted for review'
      );
    }

    // Validate service has required data
    this.validateServiceForPublishing(service);

    const updatedService = await this.repository.updateStatus(serviceId, 'PENDING_REVIEW');

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service submitted for review',
      serviceId,
      userId,
    });

    return updatedService;
  }

  /**
   * Publish a service (admin action after review)
   */
  async publishService(serviceId: string, adminId: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.status !== 'PENDING_REVIEW' && service.status !== 'PAUSED') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        'Service must be pending review or paused to publish'
      );
    }

    const updatedService = await this.repository.updateStatus(
      serviceId,
      'ACTIVE',
      service.publishedAt ?? new Date()
    );

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service published',
      serviceId,
      adminId,
    });

    return updatedService;
  }

  /**
   * Pause a service
   */
  async pauseService(serviceId: string, userId: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    if (service.status !== 'ACTIVE') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        'Only active services can be paused'
      );
    }

    const updatedService = await this.repository.updateStatus(serviceId, 'PAUSED');

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service paused',
      serviceId,
      userId,
    });

    return updatedService;
  }

  /**
   * Unpause (reactivate) a service
   */
  async unpauseService(serviceId: string, userId: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    if (service.status !== 'PAUSED') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        'Only paused services can be unpaused'
      );
    }

    const updatedService = await this.repository.updateStatus(serviceId, 'ACTIVE');

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service unpaused',
      serviceId,
      userId,
    });

    return updatedService;
  }

  /**
   * Reject a service (admin action)
   */
  async rejectService(serviceId: string, adminId: string, reason: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.status !== 'PENDING_REVIEW') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        'Only pending review services can be rejected'
      );
    }

    const updatedService = await this.repository.updateStatus(serviceId, 'REJECTED');

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    // FUTURE: Send notification to seller with rejection reason
    this.logger.info({
      msg: 'Service rejected',
      serviceId,
      adminId,
      reason,
    });

    return updatedService;
  }

  /**
   * Archive a service (soft delete)
   */
  async archiveService(serviceId: string, userId: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    // Cannot archive if there are active orders
    // FUTURE: Check for active orders

    await this.repository.delete(serviceId);

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service archived',
      serviceId,
      userId,
    });
  }

  /**
   * Delete a draft service permanently
   */
  async deleteService(serviceId: string, userId: string) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    if (service.status !== 'DRAFT') {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.SERVICE_NOT_DRAFT,
        'Only draft services can be permanently deleted'
      );
    }

    await this.repository.hardDelete(serviceId);

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Service deleted',
      serviceId,
      userId,
    });
  }

  // ===========================================================================
  // PACKAGE MANAGEMENT
  // ===========================================================================

  /**
   * Add a package to a service
   */
  async addPackage(serviceId: string, userId: string, input: CreatePackageInput) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    // Check if tier already exists
    const existingPackages = await this.repository.findPackagesByServiceId(serviceId);
    if (existingPackages.some((pkg) => pkg.tier === input.tier)) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.DUPLICATE_PACKAGE_TIER);
    }

    const pkg = await this.repository.createPackage(serviceId, input);

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Package added',
      packageId: pkg.id,
      serviceId,
      userId,
    });

    return pkg;
  }

  /**
   * Update a package
   */
  async updatePackage(packageId: string, userId: string, input: UpdatePackageInput) {
    const pkg = await this.repository.findPackageById(packageId);

    if (!pkg) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.PACKAGE_NOT_FOUND);
    }

    if (pkg.service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    const updatedPkg = await this.repository.updatePackage(packageId, input);

    // Invalidate cache
    await this.invalidateServiceCache(pkg.serviceId);

    this.logger.info({
      msg: 'Package updated',
      packageId,
      serviceId: pkg.serviceId,
      userId,
    });

    return updatedPkg;
  }

  /**
   * Delete a package
   */
  async deletePackage(packageId: string, userId: string) {
    const pkg = await this.repository.findPackageById(packageId);

    if (!pkg) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.PACKAGE_NOT_FOUND);
    }

    if (pkg.service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    await this.repository.deletePackage(packageId);

    // Invalidate cache
    await this.invalidateServiceCache(pkg.serviceId);

    this.logger.info({
      msg: 'Package deleted',
      packageId,
      serviceId: pkg.serviceId,
      userId,
    });
  }

  // ===========================================================================
  // ADD-ON MANAGEMENT
  // ===========================================================================

  /**
   * Add an add-on to a service
   */
  async addAddOn(serviceId: string, userId: string, input: CreateAddOnInput) {
    const service = await this.repository.findById(serviceId);

    if (!service) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SERVICE_NOT_FOUND);
    }

    if (service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    const addOn = await this.repository.createAddOn(serviceId, input);

    // Invalidate cache
    await this.invalidateServiceCache(serviceId);

    this.logger.info({
      msg: 'Add-on added',
      addOnId: addOn.id,
      serviceId,
      userId,
    });

    return addOn;
  }

  /**
   * Update an add-on
   */
  async updateAddOn(addOnId: string, userId: string, input: UpdateAddOnInput) {
    const addOn = await this.repository.findAddOnById(addOnId);

    if (!addOn) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ADD_ON_NOT_FOUND);
    }

    if (addOn.service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    const updatedAddOn = await this.repository.updateAddOn(addOnId, input);

    // Invalidate cache
    await this.invalidateServiceCache(addOn.serviceId);

    this.logger.info({
      msg: 'Add-on updated',
      addOnId,
      serviceId: addOn.serviceId,
      userId,
    });

    return updatedAddOn;
  }

  /**
   * Delete an add-on
   */
  async deleteAddOn(addOnId: string, userId: string) {
    const addOn = await this.repository.findAddOnById(addOnId);

    if (!addOn) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ADD_ON_NOT_FOUND);
    }

    if (addOn.service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    await this.repository.deleteAddOn(addOnId);

    // Invalidate cache
    await this.invalidateServiceCache(addOn.serviceId);

    this.logger.info({
      msg: 'Add-on deleted',
      addOnId,
      serviceId: addOn.serviceId,
      userId,
    });
  }

  // ===========================================================================
  // SEARCH AND DISCOVERY
  // ===========================================================================

  /**
   * Search services
   */
  async searchServices(params: ServiceSearchParams) {
    // Generate cache key from params
    const cacheKey = `search:services:${JSON.stringify(params)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.repository.search(params);

    // Cache the result
    await this.redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * Get featured services
   */
  async getFeaturedServices(limit = 10) {
    const cacheKey = `featured:services:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const services = await this.repository.getFeatured(limit);

    // Cache the result
    await this.redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(services));

    return services;
  }

  /**
   * Get trending services
   */
  async getTrendingServices(limit = 10) {
    const cacheKey = `trending:services:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const services = await this.repository.getTrending(limit);

    // Cache the result
    await this.redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(services));

    return services;
  }

  /**
   * Get services by category
   */
  async getServicesByCategory(category: ServiceCategory, limit = 20, offset = 0) {
    const cacheKey = `category:${category}:${limit}:${offset}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.repository.getByCategory(category, limit, offset);

    // Cache the result
    await this.redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result));

    return result;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Generate a unique slug for a service
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.repository.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Validate service has required data for publishing
   */
  private validateServiceForPublishing(service: unknown) {
    const s = service as Record<string, unknown>;

    const errors: string[] = [];

    if (!s.title || (s.title as string).length < 10) {
      errors.push('Title must be at least 10 characters');
    }

    if (!s.description || (s.description as string).length < 100) {
      errors.push('Description must be at least 100 characters');
    }

    if (!s.shortDescription || (s.shortDescription as string).length < 20) {
      errors.push('Short description must be at least 20 characters');
    }

    if (!s.basePrice || (s.basePrice as number) <= 0) {
      errors.push('Base price must be greater than 0');
    }

    if (!s.deliveryDays || (s.deliveryDays as number) <= 0) {
      errors.push('Delivery days must be greater than 0');
    }

    const packages = s.packages as unknown[] | undefined;
    if (!packages || packages.length === 0) {
      errors.push('At least one package is required');
    }

    if (errors.length > 0) {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.INVALID_SERVICE_STATUS,
        `Service validation failed: ${errors.join(', ')}`
      );
    }
  }

  /**
   * Invalidate service cache
   */
  private async invalidateServiceCache(serviceId: string) {
    await this.redis.del(`service:${serviceId}`);
    // Also invalidate related search caches (would need a more sophisticated approach in production)
    const keys = await this.redis.keys('search:services:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    const categoryKeys = await this.redis.keys('category:*');
    if (categoryKeys.length > 0) {
      await this.redis.del(...categoryKeys);
    }
    await this.redis.del('featured:services:*');
    await this.redis.del('trending:services:*');
  }
}
