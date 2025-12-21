/**
 * @module @skillancer/cockpit-svc/repositories/client
 * Client data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  CreateClientParams,
  UpdateClientParams,
  ClientSearchParams,
  ClientWithMetrics,
  ClientSearchResult,
  SearchFacets,
  ClientAddress,
} from '../types/crm.types.js';
import type {
  PrismaClient,
  ClientStatus,
  ClientSource,
  ClientType,
  CompanySize,
} from '@skillancer/database';

export class ClientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new client
   */
  async create(data: {
    freelancerUserId: string;
    clientType: ClientType;
    source: ClientSource;
    platformUserId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    alternateEmail?: string | null;
    alternatePhone?: string | null;
    companyName?: string | null;
    companyWebsite?: string | null;
    companySize?: CompanySize | null;
    industry?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    address?: ClientAddress | null;
    timezone?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    linkedinUrl?: string | null;
    twitterUrl?: string | null;
    preferredContactMethod?: string | null;
    communicationPreferences?: Record<string, unknown> | null;
    tags?: string[];
    customFields?: Record<string, unknown> | null;
    internalNotes?: string | null;
    status?: ClientStatus;
    lifetimeValue?: number;
    totalProjects?: number;
    activeProjects?: number;
    lastProjectAt?: Date | null;
  }) {
    return this.prisma.client.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        clientType: data.clientType,
        source: data.source,
        platformUserId: data.platformUserId ?? null,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        alternateEmail: data.alternateEmail ?? null,
        alternatePhone: data.alternatePhone ?? null,
        companyName: data.companyName ?? null,
        companyWebsite: data.companyWebsite ?? null,
        companySize: data.companySize ?? null,
        industry: data.industry ?? null,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        address: (data.address as Prisma.InputJsonValue) ?? Prisma.DbNull,
        timezone: data.timezone ?? null,
        avatarUrl: data.avatarUrl ?? null,
        bio: data.bio ?? null,
        linkedinUrl: data.linkedinUrl ?? null,
        twitterUrl: data.twitterUrl ?? null,
        preferredContactMethod: data.preferredContactMethod ?? null,
        communicationPreferences:
          (data.communicationPreferences as Prisma.InputJsonValue) ?? Prisma.DbNull,
        tags: data.tags ?? [],
        customFields: (data.customFields as Prisma.InputJsonValue) ?? Prisma.DbNull,
        internalNotes: data.internalNotes ?? null,
        status: data.status ?? 'LEAD',
        lifetimeValue: data.lifetimeValue ?? 0,
        totalProjects: data.totalProjects ?? 0,
        activeProjects: data.activeProjects ?? 0,
        lastProjectAt: data.lastProjectAt ?? null,
      },
    });
  }

  /**
   * Find a client by ID
   */
  async findById(id: string) {
    return this.prisma.client.findUnique({
      where: { id },
    });
  }

  /**
   * Find a client by ID with full details
   */
  async findByIdWithDetails(id: string) {
    return this.prisma.client.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        platformUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find a client by email for a freelancer
   */
  async findByEmail(freelancerUserId: string, email: string) {
    return this.prisma.client.findFirst({
      where: {
        freelancerUserId,
        email: { equals: email, mode: 'insensitive' },
      },
    });
  }

  /**
   * Find a client by platform user ID
   */
  async findByPlatformUser(freelancerUserId: string, platformUserId: string) {
    return this.prisma.client.findFirst({
      where: {
        freelancerUserId,
        platformUserId,
      },
    });
  }

  /**
   * Update a client
   */
  async update(
    id: string,
    data: Partial<{
      clientType: ClientType;
      source: ClientSource;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      alternateEmail: string | null;
      alternatePhone: string | null;
      companyName: string | null;
      companyWebsite: string | null;
      companySize: CompanySize | null;
      industry: string | null;
      jobTitle: string | null;
      department: string | null;
      address: ClientAddress | null;
      timezone: string | null;
      avatarUrl: string | null;
      bio: string | null;
      linkedinUrl: string | null;
      twitterUrl: string | null;
      preferredContactMethod: string | null;
      communicationPreferences: Record<string, unknown> | null;
      tags: string[];
      customFields: Record<string, unknown> | null;
      internalNotes: string | null;
      status: ClientStatus;
      lifetimeValue: number;
      totalProjects: number;
      activeProjects: number;
      avgRating: number | null;
      healthScore: number | null;
      healthScoreUpdatedAt: Date | null;
      lastContactAt: Date | null;
      lastProjectAt: Date | null;
      nextFollowUpAt: Date | null;
      archivedAt: Date | null;
    }>
  ) {
    const updateData: Prisma.ClientUpdateInput = {};

    // Handle each field explicitly to avoid type issues
    if (data.clientType !== undefined) updateData.clientType = data.clientType;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.alternateEmail !== undefined) updateData.alternateEmail = data.alternateEmail;
    if (data.alternatePhone !== undefined) updateData.alternatePhone = data.alternatePhone;
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.companyWebsite !== undefined) updateData.companyWebsite = data.companyWebsite;
    if (data.companySize !== undefined) updateData.companySize = data.companySize;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.address !== undefined) {
      updateData.address =
        data.address === null ? Prisma.DbNull : (data.address as Prisma.InputJsonValue);
    }
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
    if (data.twitterUrl !== undefined) updateData.twitterUrl = data.twitterUrl;
    if (data.preferredContactMethod !== undefined)
      updateData.preferredContactMethod = data.preferredContactMethod;
    if (data.communicationPreferences !== undefined) {
      updateData.communicationPreferences =
        data.communicationPreferences === null
          ? Prisma.DbNull
          : (data.communicationPreferences as Prisma.InputJsonValue);
    }
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.customFields !== undefined) {
      updateData.customFields =
        data.customFields === null ? Prisma.DbNull : (data.customFields as Prisma.InputJsonValue);
    }
    if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.lifetimeValue !== undefined) updateData.lifetimeValue = data.lifetimeValue;
    if (data.totalProjects !== undefined) updateData.totalProjects = data.totalProjects;
    if (data.activeProjects !== undefined) updateData.activeProjects = data.activeProjects;
    if (data.avgRating !== undefined) updateData.avgRating = data.avgRating;
    if (data.healthScore !== undefined) updateData.healthScore = data.healthScore;
    if (data.healthScoreUpdatedAt !== undefined)
      updateData.healthScoreUpdatedAt = data.healthScoreUpdatedAt;
    if (data.lastContactAt !== undefined) updateData.lastContactAt = data.lastContactAt;
    if (data.lastProjectAt !== undefined) updateData.lastProjectAt = data.lastProjectAt;
    if (data.nextFollowUpAt !== undefined) updateData.nextFollowUpAt = data.nextFollowUpAt;
    if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;

    return this.prisma.client.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Find clients by freelancer
   */
  async findByFreelancer(
    freelancerUserId: string,
    options?: {
      includeArchived?: boolean;
    }
  ) {
    return this.prisma.client.findMany({
      where: {
        freelancerUserId,
        ...(options?.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      },
    });
  }

  /**
   * Search clients with filters
   */
  async search(params: ClientSearchParams): Promise<ClientSearchResult> {
    const {
      freelancerUserId,
      status,
      tags,
      source,
      hasActiveProjects,
      healthScoreMin,
      healthScoreMax,
      lastContactBefore,
      lastContactAfter,
      sortBy = 'created',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = params;

    const where: Prisma.ClientWhereInput = {
      freelancerUserId,
      status: status ? { in: status } : { not: 'ARCHIVED' },
      ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
      ...(source && source.length > 0 && { source: { in: source } }),
      ...(hasActiveProjects !== undefined && {
        activeProjects: hasActiveProjects ? { gt: 0 } : { equals: 0 },
      }),
      ...(healthScoreMin !== undefined && { healthScore: { gte: healthScoreMin } }),
      ...(healthScoreMax !== undefined && { healthScore: { lte: healthScoreMax } }),
      ...(lastContactBefore && { lastContactAt: { lt: lastContactBefore } }),
      ...(lastContactAfter && { lastContactAt: { gt: lastContactAfter } }),
    };

    const orderBy = this.getOrderBy(sortBy, sortOrder);

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    // Get facets
    const facets = await this.getFacets(freelancerUserId);

    // Transform to ClientWithMetrics
    const clientsWithMetrics: ClientWithMetrics[] = clients.map((client) => ({
      id: client.id,
      displayName: this.getDisplayName(client),
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      companyName: client.companyName,
      clientType: client.clientType,
      source: client.source,
      status: client.status,
      avatarUrl: client.avatarUrl,
      healthScore: client.healthScore,
      lifetimeValue: Number(client.lifetimeValue),
      totalProjects: client.totalProjects,
      activeProjects: client.activeProjects,
      lastContactAt: client.lastContactAt,
      lastProjectAt: client.lastProjectAt,
      nextFollowUpAt: client.nextFollowUpAt,
      tags: client.tags,
      createdAt: client.createdAt,
    }));

    return {
      clients: clientsWithMetrics,
      total,
      facets,
    };
  }

  /**
   * Find clients by health score range
   */
  async findByHealthScoreRange(freelancerUserId: string, min: number, max: number) {
    return this.prisma.client.findMany({
      where: {
        freelancerUserId,
        status: { not: 'ARCHIVED' },
        healthScore: {
          gte: min,
          lte: max,
        },
      },
      orderBy: { healthScore: 'asc' },
    });
  }

  /**
   * Delete a client
   */
  async delete(id: string) {
    return this.prisma.client.delete({
      where: { id },
    });
  }

  /**
   * Get order by clause
   */
  private getOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): Prisma.ClientOrderByWithRelationInput {
    switch (sortBy) {
      case 'name':
        return { firstName: sortOrder };
      case 'lastContact':
        return { lastContactAt: sortOrder };
      case 'lifetimeValue':
        return { lifetimeValue: sortOrder };
      case 'healthScore':
        return { healthScore: sortOrder };
      case 'created':
      default:
        return { createdAt: sortOrder };
    }
  }

  /**
   * Get facets for search
   */
  private async getFacets(freelancerUserId: string): Promise<SearchFacets> {
    const clients = await this.prisma.client.findMany({
      where: {
        freelancerUserId,
        status: { not: 'ARCHIVED' },
      },
      select: {
        status: true,
        source: true,
        tags: true,
      },
    });

    // Count by status
    const statusCounts = new Map<ClientStatus, number>();
    const sourceCounts = new Map<ClientSource, number>();
    const tagCounts = new Map<string, number>();

    for (const client of clients) {
      statusCounts.set(client.status, (statusCounts.get(client.status) || 0) + 1);
      sourceCounts.set(client.source, (sourceCounts.get(client.source) || 0) + 1);
      for (const tag of client.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return {
      status: Array.from(statusCounts.entries()).map(([value, count]) => ({ value, count })),
      source: Array.from(sourceCounts.entries()).map(([value, count]) => ({ value, count })),
      tags: Array.from(tagCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Top 20 tags
    };
  }

  /**
   * Get display name for client
   */
  private getDisplayName(client: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (client.companyName) {
      return client.companyName;
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Client';
  }
}
