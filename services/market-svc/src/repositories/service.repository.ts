/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/service
 * Service Catalog data access layer
 */

import type {
  ServiceSearchParams,
  CreateServiceInput,
  UpdateServiceInput,
  CreatePackageInput,
  UpdatePackageInput,
  CreateAddOnInput,
  UpdateAddOnInput,
  ServiceCategory,
  ServiceStatus,
} from '../types/service-catalog.types.js';
import type { PrismaClient, Prisma } from '@skillancer/database';

/**
 * Service Repository
 *
 * Handles database operations for services, packages, and add-ons.
 * Uses Prisma client for all database interactions.
 */
export class ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // SERVICE CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a new service
   */
  async create(freelancerId: string, input: CreateServiceInput & { slug: string }) {
    const { packages, addOns, skills, ...serviceData } = input;

    return this.prisma.service.create({
      data: {
        freelancerId,
        title: serviceData.title,
        slug: serviceData.slug,
        description: serviceData.description,
        shortDescription: serviceData.shortDescription,
        category: serviceData.category,
        subcategory: serviceData.subcategory ?? null,
        tags: serviceData.tags ?? [],
        basePrice: serviceData.basePrice,
        currency: serviceData.currency ?? 'USD',
        deliveryDays: serviceData.deliveryDays,
        revisionsIncluded: serviceData.revisionsIncluded ?? 1,
        deliverables: (serviceData.deliverables || []) as unknown as Prisma.InputJsonValue,
        requirements: (serviceData.requirements || []) as unknown as Prisma.InputJsonValue,
        thumbnailUrl: serviceData.thumbnailUrl ?? null,
        galleryUrls: serviceData.galleryUrls ?? [],
        videoUrl: serviceData.videoUrl ?? null,
        faqs: (serviceData.faqs || []) as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        isActive: false,
        isFeatured: false,
        viewCount: 0,
        orderCount: 0,
        completedCount: 0,
        ratingCount: 0,
        packages: packages?.length
          ? {
              create: packages.map((pkg, index) => ({
                name: pkg.name,
                tier: pkg.tier,
                description: pkg.description ?? null,
                price: pkg.price,
                deliveryDays: pkg.deliveryDays,
                revisionsIncluded: pkg.revisionsIncluded,
                features: pkg.features as unknown as Prisma.InputJsonValue,
                deliverables: pkg.deliverables as unknown as Prisma.InputJsonValue,
                maxRevisions: pkg.maxRevisions ?? null,
                isActive: true,
                sortOrder: index,
              })),
            }
          : undefined,
        addOns: addOns?.length
          ? {
              create: addOns.map((addOn, index) => ({
                title: addOn.title,
                description: addOn.description ?? null,
                price: addOn.price,
                additionalDays: addOn.additionalDays ?? 0,
                allowQuantity: addOn.allowQuantity ?? false,
                maxQuantity: addOn.maxQuantity ?? null,
                isActive: true,
                sortOrder: index,
              })),
            }
          : undefined,
        skills: skills?.length
          ? {
              create: skills.map((skillId) => ({
                skillId,
              })),
            }
          : undefined,
      },
      include: this.getServiceIncludes(),
    });
  }

  /**
   * Find a service by ID
   */
  async findById(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: this.getServiceIncludes(),
    });
  }

  /**
   * Find a service by slug
   */
  async findBySlug(slug: string) {
    return this.prisma.service.findUnique({
      where: { slug },
      include: this.getServiceIncludes(),
    });
  }

  /**
   * Find services by freelancer ID
   */
  async findByFreelancerId(
    freelancerId: string,
    options?: { status?: ServiceStatus; limit?: number; offset?: number }
  ) {
    const where: Prisma.ServiceWhereInput = {
      freelancerId,
      ...(options?.status && { status: options.status }),
    };

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: this.getServiceIncludes(),
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 20,
        skip: options?.offset ?? 0,
      }),
      this.prisma.service.count({ where }),
    ]);

    return { services, total };
  }

  /**
   * Update a service
   */
  async update(id: string, input: UpdateServiceInput) {
    return this.prisma.service.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.subcategory !== undefined && { subcategory: input.subcategory }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.basePrice !== undefined && { basePrice: input.basePrice }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.deliveryDays !== undefined && { deliveryDays: input.deliveryDays }),
        ...(input.revisionsIncluded !== undefined && {
          revisionsIncluded: input.revisionsIncluded,
        }),
        ...(input.deliverables !== undefined && {
          deliverables: input.deliverables as unknown as Prisma.InputJsonValue,
        }),
        ...(input.requirements !== undefined && {
          requirements: input.requirements as unknown as Prisma.InputJsonValue,
        }),
        ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
        ...(input.galleryUrls !== undefined && { galleryUrls: input.galleryUrls }),
        ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
        ...(input.faqs !== undefined && {
          faqs: input.faqs as unknown as Prisma.InputJsonValue,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: this.getServiceIncludes(),
    });
  }

  /**
   * Delete a service (soft delete by archiving)
   */
  async delete(id: string) {
    return this.prisma.service.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        isActive: false,
      },
    });
  }

  /**
   * Hard delete a service (for drafts only)
   */
  async hardDelete(id: string) {
    // First delete related records
    await this.prisma.$transaction([
      this.prisma.servicePackage.deleteMany({ where: { serviceId: id } }),
      this.prisma.serviceAddOn.deleteMany({ where: { serviceId: id } }),
      this.prisma.serviceSkill.deleteMany({ where: { serviceId: id } }),
      this.prisma.service.delete({ where: { id } }),
    ]);
  }

  /**
   * Update service status
   */
  async updateStatus(id: string, status: ServiceStatus, publishedAt?: Date) {
    return this.prisma.service.update({
      where: { id },
      data: {
        status,
        ...(publishedAt && { publishedAt }),
        ...(status === 'ACTIVE' && { isActive: true }),
        ...(status !== 'ACTIVE' && status !== 'PENDING_REVIEW' && { isActive: false }),
      },
      include: this.getServiceIncludes(),
    });
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: string) {
    return this.prisma.service.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  /**
   * Update service stats after order completion
   */
  async updateStatsAfterOrder(id: string, rating?: number) {
    const updates: Prisma.ServiceUpdateInput = {
      orderCount: { increment: 1 },
      completedCount: { increment: 1 },
    };

    if (rating !== undefined) {
      // Need to recalculate average rating
      const service = await this.findById(id);
      if (service) {
        const currentTotal = (service.avgRating ?? 0) * service.ratingCount;
        const newCount = service.ratingCount + 1;
        const newAvg = (currentTotal + rating) / newCount;

        updates.avgRating = newAvg;
        updates.ratingCount = { increment: 1 };
      }
    }

    return this.prisma.service.update({
      where: { id },
      data: updates,
    });
  }

  // ===========================================================================
  // PACKAGE OPERATIONS
  // ===========================================================================

  /**
   * Create a package for a service
   */
  async createPackage(serviceId: string, input: CreatePackageInput) {
    // Get current max sort order
    const lastPackage = await this.prisma.servicePackage.findFirst({
      where: { serviceId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (lastPackage?.sortOrder ?? -1) + 1;

    return this.prisma.servicePackage.create({
      data: {
        serviceId,
        name: input.name,
        tier: input.tier,
        description: input.description ?? null,
        price: input.price,
        deliveryDays: input.deliveryDays,
        revisionsIncluded: input.revisionsIncluded,
        features: input.features as unknown as Prisma.InputJsonValue,
        deliverables: input.deliverables as unknown as Prisma.InputJsonValue,
        maxRevisions: input.maxRevisions ?? null,
        isActive: true,
        sortOrder,
      },
    });
  }

  /**
   * Find a package by ID
   */
  async findPackageById(id: string) {
    return this.prisma.servicePackage.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            freelancerId: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Find packages by service ID
   */
  async findPackagesByServiceId(serviceId: string) {
    return this.prisma.servicePackage.findMany({
      where: { serviceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Update a package
   */
  async updatePackage(id: string, input: UpdatePackageInput) {
    return this.prisma.servicePackage.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.deliveryDays !== undefined && { deliveryDays: input.deliveryDays }),
        ...(input.revisionsIncluded !== undefined && {
          revisionsIncluded: input.revisionsIncluded,
        }),
        ...(input.features !== undefined && {
          features: input.features as unknown as Prisma.InputJsonValue,
        }),
        ...(input.deliverables !== undefined && {
          deliverables: input.deliverables as unknown as Prisma.InputJsonValue,
        }),
        ...(input.maxRevisions !== undefined && { maxRevisions: input.maxRevisions }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /**
   * Delete a package
   */
  async deletePackage(id: string) {
    return this.prisma.servicePackage.delete({ where: { id } });
  }

  // ===========================================================================
  // ADD-ON OPERATIONS
  // ===========================================================================

  /**
   * Create an add-on for a service
   */
  async createAddOn(serviceId: string, input: CreateAddOnInput) {
    // Get current max sort order
    const lastAddOn = await this.prisma.serviceAddOn.findFirst({
      where: { serviceId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (lastAddOn?.sortOrder ?? -1) + 1;

    return this.prisma.serviceAddOn.create({
      data: {
        serviceId,
        title: input.title,
        description: input.description ?? null,
        price: input.price,
        additionalDays: input.additionalDays ?? 0,
        allowQuantity: input.allowQuantity ?? false,
        maxQuantity: input.maxQuantity ?? null,
        isActive: true,
        sortOrder,
      },
    });
  }

  /**
   * Find an add-on by ID
   */
  async findAddOnById(id: string) {
    return this.prisma.serviceAddOn.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            freelancerId: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Find add-ons by service ID
   */
  async findAddOnsByServiceId(serviceId: string) {
    return this.prisma.serviceAddOn.findMany({
      where: { serviceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Update an add-on
   */
  async updateAddOn(id: string, input: UpdateAddOnInput) {
    return this.prisma.serviceAddOn.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.additionalDays !== undefined && { additionalDays: input.additionalDays }),
        ...(input.allowQuantity !== undefined && { allowQuantity: input.allowQuantity }),
        ...(input.maxQuantity !== undefined && { maxQuantity: input.maxQuantity }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  /**
   * Delete an add-on
   */
  async deleteAddOn(id: string) {
    return this.prisma.serviceAddOn.delete({ where: { id } });
  }

  // ===========================================================================
  // SEARCH OPERATIONS
  // ===========================================================================

  /**
   * Search services with filters
   */
  async search(params: ServiceSearchParams) {
    const {
      query,
      category,
      subcategory,
      priceMin,
      priceMax,
      deliveryDays,
      minRating,
      skills,
      sellerId,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
    } = params;

    const where: Prisma.ServiceWhereInput = {
      status: 'ACTIVE',
      isActive: true,
      ...(category && { category }),
      ...(subcategory && { subcategory }),
      ...(priceMin !== undefined && { basePrice: { gte: priceMin } }),
      ...(priceMax !== undefined && { basePrice: { lte: priceMax } }),
      ...(deliveryDays && { deliveryDays: { lte: deliveryDays } }),
      ...(minRating && { avgRating: { gte: minRating } }),
      ...(sellerId && { freelancerId: sellerId }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query] } },
        ],
      }),
      ...(skills?.length && {
        skills: {
          some: {
            skillId: { in: skills },
          },
        },
      }),
    };

    const orderBy: Prisma.ServiceOrderByWithRelationInput = this.getOrderBy(sortBy);

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: this.getServiceSummaryIncludes(),
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      services,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Get featured services
   */
  async getFeatured(limit = 10) {
    return this.prisma.service.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true,
        isFeatured: true,
      },
      include: this.getServiceSummaryIncludes(),
      orderBy: [{ avgRating: 'desc' }, { orderCount: 'desc' }],
      take: limit,
    });
  }

  /**
   * Get trending services (based on recent orders)
   */
  async getTrending(limit = 10) {
    return this.prisma.service.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true,
      },
      include: this.getServiceSummaryIncludes(),
      orderBy: [{ orderCount: 'desc' }, { avgRating: 'desc' }],
      take: limit,
    });
  }

  /**
   * Get services by category
   */
  async getByCategory(category: ServiceCategory, limit = 20, offset = 0) {
    const where: Prisma.ServiceWhereInput = {
      status: 'ACTIVE',
      isActive: true,
      category,
    };

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: this.getServiceSummaryIncludes(),
        orderBy: [{ isFeatured: 'desc' }, { avgRating: 'desc' }, { orderCount: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.service.count({ where }),
    ]);

    return { services, total };
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: string) {
    const existing = await this.prisma.service.findFirst({
      where: {
        slug,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return !!existing;
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private getServiceIncludes() {
    return {
      freelancer: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          title: true,
          createdAt: true,
          country: true,
          ratingAggregation: {
            select: {
              freelancerAverageRating: true,
              freelancerTotalReviews: true,
            },
          },
        },
      },
      packages: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
      },
      addOns: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
      },
      skills: {
        include: {
          skill: true,
        },
      },
      _count: {
        select: {
          orders: true,
          reviews: true,
        },
      },
    };
  }

  private getServiceSummaryIncludes() {
    return {
      freelancer: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          ratingAggregation: {
            select: {
              freelancerAverageRating: true,
              freelancerTotalReviews: true,
            },
          },
        },
      },
      _count: {
        select: {
          orders: true,
        },
      },
    };
  }

  private getOrderBy(
    sortBy: ServiceSearchParams['sortBy']
  ): Prisma.ServiceOrderByWithRelationInput {
    switch (sortBy) {
      case 'bestselling':
        return { orderCount: 'desc' };
      case 'newest':
        return { createdAt: 'desc' };
      case 'price_low':
        return { basePrice: 'asc' };
      case 'price_high':
        return { basePrice: 'desc' };
      case 'rating':
        return { avgRating: 'desc' };
      case 'relevance':
      default:
        return { isFeatured: 'desc' };
    }
  }
}
