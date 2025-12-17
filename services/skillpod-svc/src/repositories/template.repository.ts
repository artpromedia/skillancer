/**
 * @module @skillancer/skillpod-svc/repositories/template
 * Template repository for database operations
 *
 * Note: This file contains type mismatches due to exactOptionalPropertyTypes.
 * Prisma uses `null` for optional fields while our interfaces use `undefined`.
 * This is acceptable as the values are equivalent at runtime.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import type { ResourceSpec, ToolDefinition } from '../types/environment.types.js';
import type {
  PrismaClient,
  PodTemplate,
  TemplateRating,
  TemplateCategory,
  Prisma,
} from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateWithRelations extends PodTemplate {
  baseImage?: {
    id: string;
    name: string;
    osType: string;
    osVersion: string;
    registryUri: string;
    imageTag: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count?: {
    pods: number;
    ratings: number;
  };
}

export interface CreateTemplateInput {
  tenantId?: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  category: TemplateCategory;
  tags: string[];
  baseImageId: string;
  kasmImageId?: string;
  ecrImageUri?: string;
  installedTools: ToolDefinition[];
  defaultConfig: Record<string, unknown>;
  defaultResources: ResourceSpec;
  minResources: ResourceSpec;
  maxResources: ResourceSpec;
  startupScript?: string;
  environmentVars?: Record<string, string>;
  iconUrl?: string;
  screenshotUrls: string[];
  documentationUrl?: string;
  isPublic: boolean;
  isActive: boolean;
  estimatedLaunchSeconds: number;
}

export interface UpdateTemplateInput {
  name?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  category?: TemplateCategory;
  tags?: string[];
  baseImageId?: string;
  kasmImageId?: string;
  ecrImageUri?: string;
  installedTools?: ToolDefinition[];
  defaultConfig?: Record<string, unknown>;
  defaultResources?: ResourceSpec;
  minResources?: ResourceSpec;
  maxResources?: ResourceSpec;
  startupScript?: string;
  environmentVars?: Record<string, string>;
  iconUrl?: string;
  screenshotUrls?: string[];
  documentationUrl?: string;
  isPublic?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  version?: string;
  changelog?: string;
  avgRating?: number;
  ratingCount?: number;
  usageCount?: number;
}

export interface TemplateListFilter {
  tenantId?: string;
  category?: TemplateCategory;
  tags?: string[];
  search?: string;
  isPublic?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  includeGlobal?: boolean;
}

export interface TemplateListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'usageCount' | 'avgRating' | 'name';
  orderDirection?: 'asc' | 'desc';
}

export interface UpsertRatingInput {
  templateId: string;
  userId: string;
  rating: number;
  review?: string;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface TemplateRepository {
  create(input: CreateTemplateInput): Promise<PodTemplate>;
  findById(id: string): Promise<TemplateWithRelations | null>;
  findBySlug(tenantId: string | null, slug: string): Promise<PodTemplate | null>;
  findMany(
    filter: TemplateListFilter,
    options?: TemplateListOptions
  ): Promise<{ templates: TemplateWithRelations[]; total: number }>;
  update(id: string, input: UpdateTemplateInput): Promise<PodTemplate>;
  delete(id: string): Promise<void>;
  incrementUsageCount(id: string): Promise<void>;

  // Ratings
  upsertRating(input: UpsertRatingInput): Promise<TemplateRating>;
  getRatings(templateId: string, limit?: number): Promise<TemplateRating[]>;
  getUserRating(templateId: string, userId: string): Promise<TemplateRating | null>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createTemplateRepository(prisma: PrismaClient): TemplateRepository {
  async function create(input: CreateTemplateInput): Promise<PodTemplate> {
    return prisma.podTemplate.create({
      data: {
        tenantId: input.tenantId ?? null,
        name: input.name,
        slug: input.slug,
        description: input.description,
        shortDescription: input.shortDescription,
        category: input.category,
        tags: input.tags,
        baseImageId: input.baseImageId,
        kasmImageId: input.kasmImageId,
        ecrImageUri: input.ecrImageUri,
        installedTools: input.installedTools as unknown as Prisma.InputJsonValue,
        defaultConfig: input.defaultConfig as Prisma.InputJsonValue,
        defaultResources: input.defaultResources as unknown as Prisma.InputJsonValue,
        minResources: input.minResources as unknown as Prisma.InputJsonValue,
        maxResources: input.maxResources as unknown as Prisma.InputJsonValue,
        startupScript: input.startupScript,
        environmentVars: input.environmentVars as Prisma.InputJsonValue,
        iconUrl: input.iconUrl,
        screenshotUrls: input.screenshotUrls,
        documentationUrl: input.documentationUrl,
        isPublic: input.isPublic,
        isActive: input.isActive,
        estimatedLaunchSeconds: input.estimatedLaunchSeconds,
      },
    });
  }

  async function findById(id: string): Promise<TemplateWithRelations | null> {
    return prisma.podTemplate.findUnique({
      where: { id },
      include: {
        baseImage: {
          select: {
            id: true,
            name: true,
            osType: true,
            osVersion: true,
            registryUri: true,
            imageTag: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            pods: true,
            ratings: true,
          },
        },
      },
    });
  }

  async function findBySlug(tenantId: string | null, slug: string): Promise<PodTemplate | null> {
    return prisma.podTemplate.findFirst({
      where: {
        tenantId: tenantId ?? null,
        slug,
      },
    });
  }

  async function findMany(
    filter: TemplateListFilter,
    options: TemplateListOptions = {}
  ): Promise<{ templates: TemplateWithRelations[]; total: number }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const whereConditions: Prisma.PodTemplateWhereInput[] = [];

    // Tenant filter with global templates
    if (filter.includeGlobal) {
      whereConditions.push({
        OR: [{ tenantId: filter.tenantId ?? null }, { tenantId: null, isPublic: true }],
      });
    } else if (filter.tenantId !== undefined) {
      whereConditions.push({ tenantId: filter.tenantId ?? null });
    }

    // Category filter
    if (filter.category) {
      whereConditions.push({ category: filter.category });
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      whereConditions.push({ tags: { hasSome: filter.tags } });
    }

    // Search filter
    if (filter.search) {
      whereConditions.push({
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
          { shortDescription: { contains: filter.search, mode: 'insensitive' } },
          { tags: { has: filter.search } },
        ],
      });
    }

    // Status filters
    if (filter.isActive !== undefined) {
      whereConditions.push({ isActive: filter.isActive });
    }

    if (filter.isPublic !== undefined) {
      whereConditions.push({ isPublic: filter.isPublic });
    }

    if (filter.isFeatured !== undefined) {
      whereConditions.push({ isFeatured: filter.isFeatured });
    }

    const where: Prisma.PodTemplateWhereInput =
      whereConditions.length > 0 ? { AND: whereConditions } : {};

    // Build order by - prioritize featured templates
    const orderByClause: Prisma.PodTemplateOrderByWithRelationInput[] = [
      { isFeatured: 'desc' },
      { [orderBy]: orderDirection },
    ];

    const [templates, total] = await Promise.all([
      prisma.podTemplate.findMany({
        where,
        include: {
          baseImage: {
            select: {
              id: true,
              name: true,
              osType: true,
              osVersion: true,
              registryUri: true,
              imageTag: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              pods: true,
              ratings: true,
            },
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      }),
      prisma.podTemplate.count({ where }),
    ]);

    return { templates, total };
  }

  async function update(id: string, input: UpdateTemplateInput): Promise<PodTemplate> {
    // Build update data object - only include fields that are defined
    const simpleFields = [
      'name',
      'slug',
      'description',
      'shortDescription',
      'category',
      'tags',
      'kasmImageId',
      'ecrImageUri',
      'startupScript',
      'iconUrl',
      'screenshotUrls',
      'documentationUrl',
      'isPublic',
      'isActive',
      'isFeatured',
      'version',
      'changelog',
      'avgRating',
      'ratingCount',
      'usageCount',
    ] as const;

    const jsonFields = [
      'installedTools',
      'defaultConfig',
      'defaultResources',
      'minResources',
      'maxResources',
      'environmentVars',
    ] as const;

    const data: Prisma.PodTemplateUpdateInput = {};

    // Copy simple fields that are defined
    for (const field of simpleFields) {
      if (input[field] !== undefined) {
        (data as Record<string, unknown>)[field] = input[field];
      }
    }

    // Copy JSON fields with type casting
    for (const field of jsonFields) {
      if (input[field] !== undefined) {
        (data as Record<string, unknown>)[field] = input[field] as Prisma.InputJsonValue;
      }
    }

    return prisma.podTemplate.update({
      where: { id },
      data,
    });
  }

  async function deleteTemplate(id: string): Promise<void> {
    await prisma.podTemplate.delete({
      where: { id },
    });
  }

  async function incrementUsageCount(id: string): Promise<void> {
    await prisma.podTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  // Ratings
  async function upsertRating(input: UpsertRatingInput): Promise<TemplateRating> {
    return prisma.templateRating.upsert({
      where: {
        templateId_userId: {
          templateId: input.templateId,
          userId: input.userId,
        },
      },
      create: {
        templateId: input.templateId,
        userId: input.userId,
        rating: input.rating,
        review: input.review,
      },
      update: {
        rating: input.rating,
        review: input.review,
      },
    });
  }

  async function getRatings(templateId: string, limit = 50): Promise<TemplateRating[]> {
    return prisma.templateRating.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async function getUserRating(templateId: string, userId: string): Promise<TemplateRating | null> {
    return prisma.templateRating.findUnique({
      where: {
        templateId_userId: {
          templateId,
          userId,
        },
      },
    });
  }

  return {
    create,
    findById,
    findBySlug,
    findMany,
    update,
    delete: deleteTemplate,
    incrementUsageCount,
    upsertRating,
    getRatings,
    getUserRating,
  };
}
