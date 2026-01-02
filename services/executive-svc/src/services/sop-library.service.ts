import { prisma } from '@skillancer/database';

// SOP Library Service
// Manages standard operating procedures with versioning and approval workflow

export interface CreateSOPInput {
  engagementId: string;
  title: string;
  category: string;
  description?: string;
  content: string;
  ownerId: string;
  reviewDate?: Date;
}

export interface SOPVersionInput {
  sopId: string;
  content: string;
  changelog: string;
}

export class SOPLibraryService {
  // Create new SOP
  async createSOP(input: CreateSOPInput) {
    const sop = await prisma.sOP.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        category: input.category,
        description: input.description,
        ownerId: input.ownerId,
        status: 'DRAFT',
        reviewDate: input.reviewDate,
      },
    });

    // Create initial version
    await prisma.sOPVersion.create({
      data: {
        sopId: sop.id,
        version: 1,
        content: input.content,
        changelog: 'Initial version',
      },
    });

    // Update SOP with current version ID
    return prisma.sOP.update({
      where: { id: sop.id },
      data: { currentVersionId: sop.id },
    });
  }

  // Get all SOPs for engagement
  async getSOPs(
    engagementId: string,
    options?: {
      category?: string;
      status?: string;
      search?: string;
    }
  ) {
    const where: any = { engagementId };

    if (options?.category) where.category = options.category;
    if (options?.status) where.status = options.status;
    if (options?.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    return prisma.sOP.findMany({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Get single SOP with versions
  async getSOP(id: string) {
    return prisma.sOP.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 10,
        },
      },
    });
  }

  // Update SOP content (creates new version)
  async updateSOP(input: SOPVersionInput) {
    const sop = await prisma.sOP.findUnique({
      where: { id: input.sopId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!sop) throw new Error('SOP not found');

    const currentVersion = sop.versions[0]?.version || 0;
    const newVersion = currentVersion + 1;

    // Create new version
    const version = await prisma.sOPVersion.create({
      data: {
        sopId: input.sopId,
        version: newVersion,
        content: input.content,
        changelog: input.changelog,
      },
    });

    // Update SOP
    return prisma.sOP.update({
      where: { id: input.sopId },
      data: {
        currentVersionId: version.id,
        status: 'DRAFT', // Reset to draft for review
      },
    });
  }

  // Submit for review
  async submitForReview(id: string) {
    return prisma.sOP.update({
      where: { id },
      data: { status: 'REVIEW' },
    });
  }

  // Publish SOP
  async publishSOP(id: string, publishedBy: string) {
    // Get the latest version and mark it as published
    const sop = await prisma.sOP.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!sop) throw new Error('SOP not found');

    const latestVersion = sop.versions[0];
    if (latestVersion) {
      await prisma.sOPVersion.update({
        where: { id: latestVersion.id },
        data: {
          publishedAt: new Date(),
          publishedBy,
        },
      });
    }

    return prisma.sOP.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Archive SOP
  async archiveSOP(id: string) {
    return prisma.sOP.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  // Get SOPs due for review
  async getSOPsDueForReview(engagementId: string) {
    return prisma.sOP.findMany({
      where: {
        engagementId,
        status: 'PUBLISHED',
        reviewDate: { lte: new Date() },
      },
      orderBy: { reviewDate: 'asc' },
    });
  }

  // Get SOP categories
  async getCategories(engagementId: string) {
    const sops = await prisma.sOP.findMany({
      where: { engagementId },
      select: { category: true },
      distinct: ['category'],
    });

    return sops.map((s) => s.category);
  }

  // Get SOP widget data
  async getSOPWidgetData(engagementId: string) {
    const sops = await prisma.sOP.findMany({
      where: { engagementId },
    });

    const total = sops.length;
    const published = sops.filter((s) => s.status === 'PUBLISHED').length;
    const draft = sops.filter((s) => s.status === 'DRAFT').length;
    const review = sops.filter((s) => s.status === 'REVIEW').length;
    const dueForReview = sops.filter(
      (s) => s.status === 'PUBLISHED' && s.reviewDate && s.reviewDate <= new Date()
    ).length;

    const byCategory: Record<string, number> = {};
    for (const sop of sops) {
      byCategory[sop.category] = (byCategory[sop.category] || 0) + 1;
    }

    return {
      total,
      published,
      draft,
      review,
      dueForReview,
      byCategory: Object.entries(byCategory).map(([name, count]) => ({ name, count })),
      recentlyUpdated: sops
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          title: s.title,
          category: s.category,
          status: s.status,
        })),
    };
  }
}

export const sopLibraryService = new SOPLibraryService();
