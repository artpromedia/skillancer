import { prisma } from '@skillancer/database';
import type { PRD, PRDComment, PRDVersion, PRDTemplate, Prisma } from '@prisma/client';
import { logger } from '@skillancer/logger';
import type {
  CreatePRDInput,
  UpdatePRDInput,
  CreatePRDCommentInput,
  PRDExportFormat,
  PRDWithRelations,
} from '@skillancer/types';

const log = logger.child({ service: 'prd-builder-service' });

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface PRDFilters {
  status?: string;
  ownerId?: string;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  content: Record<string, unknown>;
  createdBy?: string;
  isPublic?: boolean;
}

// =============================================================================
// PRD BUILDER SERVICE
// =============================================================================

export class PRDBuilderService {
  // ==================== PRD CRUD ====================

  async createPRD(input: CreatePRDInput): Promise<PRD> {
    log.info({ engagementId: input.engagementId }, 'Creating PRD');

    const prd = await prisma.pRD.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        status: 'DRAFT',
        overview: input.overview,
        problemStatement: input.problemStatement,
        goals: input.goals || [],
        userStories: input.userStories || [],
        requirements: input.requirements || [],
        successMetrics: input.successMetrics || [],
        timeline: input.timeline ? (input.timeline as Prisma.JsonValue) : undefined,
        openQuestions: input.openQuestions || [],
        appendix: input.appendix,
        ownerId: input.ownerId,
        reviewers: input.reviewers || [],
        templateId: input.templateId,
      },
    });

    log.info({ prdId: prd.id }, 'PRD created');
    return prd;
  }

  async getPRD(id: string): Promise<PRDWithRelations | null> {
    const prd = await prisma.pRD.findUnique({
      where: { id },
      include: {
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 10,
        },
        engagement: {
          select: {
            id: true,
            title: true,
            clientTenantId: true,
          },
        },
      },
    });

    return prd as PRDWithRelations | null;
  }

  async getPRDs(
    engagementId: string,
    filters?: PRDFilters,
    pagination?: PaginationOptions
  ): Promise<{ prds: PRD[]; total: number }> {
    const where: Prisma.PRDWhereInput = { engagementId };

    if (filters?.status) {
      where.status = filters.status as PRD['status'];
    }
    if (filters?.ownerId) {
      where.ownerId = filters.ownerId;
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { overview: { contains: filters.search, mode: 'insensitive' } },
        { problemStatement: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;

    const [prds, total] = await Promise.all([
      prisma.pRD.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pRD.count({ where }),
    ]);

    return { prds, total };
  }

  async updatePRD(id: string, input: UpdatePRDInput, userId: string): Promise<PRD> {
    log.info({ prdId: id }, 'Updating PRD');

    // Get current version for versioning
    const currentPRD = await prisma.pRD.findUnique({ where: { id } });
    if (!currentPRD) {
      throw new Error('PRD not found');
    }

    // Create version snapshot before update
    await this.createVersion(id, userId, 'Auto-save before update');

    const prd = await prisma.pRD.update({
      where: { id },
      data: {
        title: input.title,
        status: input.status,
        overview: input.overview,
        problemStatement: input.problemStatement,
        goals: input.goals ? (input.goals as Prisma.JsonValue) : undefined,
        userStories: input.userStories ? (input.userStories as Prisma.JsonValue) : undefined,
        requirements: input.requirements ? (input.requirements as Prisma.JsonValue) : undefined,
        successMetrics: input.successMetrics
          ? (input.successMetrics as Prisma.JsonValue)
          : undefined,
        timeline: input.timeline ? (input.timeline as Prisma.JsonValue) : undefined,
        openQuestions: input.openQuestions,
        appendix: input.appendix,
        ownerId: input.ownerId,
        reviewers: input.reviewers,
      },
    });

    log.info({ prdId: id, status: prd.status }, 'PRD updated');
    return prd;
  }

  async deletePRD(id: string): Promise<void> {
    log.info({ prdId: id }, 'Deleting PRD');
    await prisma.pRD.delete({ where: { id } });
    log.info({ prdId: id }, 'PRD deleted');
  }

  // ==================== TEMPLATES ====================

  async getTemplates(filters?: { category?: string; isSystem?: boolean }): Promise<PRDTemplate[]> {
    const where: Prisma.PRDTemplateWhereInput = {};

    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.isSystem !== undefined) {
      where.isSystem = filters.isSystem;
    }

    return prisma.pRDTemplate.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { useCount: 'desc' }],
    });
  }

  async getTemplate(id: string): Promise<PRDTemplate | null> {
    return prisma.pRDTemplate.findUnique({ where: { id } });
  }

  async createTemplate(input: CreateTemplateInput): Promise<PRDTemplate> {
    log.info({ name: input.name }, 'Creating PRD template');

    const template = await prisma.pRDTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        content: input.content as Prisma.JsonValue,
        createdBy: input.createdBy,
        isPublic: input.isPublic || false,
        isSystem: false,
      },
    });

    log.info({ templateId: template.id }, 'PRD template created');
    return template;
  }

  async createFromTemplate(
    templateId: string,
    engagementId: string,
    title: string,
    ownerId?: string
  ): Promise<PRD> {
    log.info({ templateId, engagementId }, 'Creating PRD from template');

    const template = await prisma.pRDTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new Error('Template not found');
    }

    const content = template.content as Record<string, unknown>;

    // Increment use count
    await prisma.pRDTemplate.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    const prd = await this.createPRD({
      engagementId,
      title,
      overview: content.overview as string | undefined,
      problemStatement: content.problemStatement as string | undefined,
      goals: content.goals as CreatePRDInput['goals'],
      userStories: content.userStories as CreatePRDInput['userStories'],
      requirements: (content.requirements as CreatePRDInput['requirements']) || [],
      successMetrics: content.successMetrics as CreatePRDInput['successMetrics'],
      timeline: content.timeline as CreatePRDInput['timeline'],
      openQuestions: content.openQuestions as string[],
      appendix: content.appendix as string | undefined,
      ownerId,
      templateId,
    });

    log.info({ prdId: prd.id, templateId }, 'PRD created from template');
    return prd;
  }

  // ==================== COMMENTS ====================

  async addComment(input: CreatePRDCommentInput, authorId: string): Promise<PRDComment> {
    log.info({ prdId: input.prdId, section: input.section }, 'Adding PRD comment');

    const comment = await prisma.pRDComment.create({
      data: {
        prdId: input.prdId,
        section: input.section,
        content: input.content,
        authorId,
        parentId: input.parentId,
      },
    });

    log.info({ commentId: comment.id }, 'PRD comment added');
    return comment;
  }

  async getComments(prdId: string, section?: string): Promise<PRDComment[]> {
    const where: Prisma.PRDCommentWhereInput = { prdId };

    if (section) {
      where.section = section;
    }

    return prisma.pRDComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveComment(commentId: string, resolvedBy: string): Promise<PRDComment> {
    log.info({ commentId }, 'Resolving PRD comment');

    const comment = await prisma.pRDComment.update({
      where: { id: commentId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
    });

    log.info({ commentId }, 'PRD comment resolved');
    return comment;
  }

  async deleteComment(commentId: string): Promise<void> {
    await prisma.pRDComment.delete({ where: { id: commentId } });
  }

  // ==================== VERSIONING ====================

  async createVersion(prdId: string, changedBy: string, changeNote?: string): Promise<PRDVersion> {
    const prd = await prisma.pRD.findUnique({ where: { id: prdId } });
    if (!prd) {
      throw new Error('PRD not found');
    }

    // Get next version number
    const lastVersion = await prisma.pRDVersion.findFirst({
      where: { prdId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;

    const version = await prisma.pRDVersion.create({
      data: {
        prdId,
        version: nextVersion,
        content: {
          title: prd.title,
          status: prd.status,
          overview: prd.overview,
          problemStatement: prd.problemStatement,
          goals: prd.goals,
          userStories: prd.userStories,
          requirements: prd.requirements,
          successMetrics: prd.successMetrics,
          timeline: prd.timeline,
          openQuestions: prd.openQuestions,
          appendix: prd.appendix,
        },
        changedBy,
        changeNote,
      },
    });

    log.info({ prdId, version: nextVersion }, 'PRD version created');
    return version;
  }

  async getVersions(prdId: string): Promise<PRDVersion[]> {
    return prisma.pRDVersion.findMany({
      where: { prdId },
      orderBy: { version: 'desc' },
    });
  }

  async getVersion(versionId: string): Promise<PRDVersion | null> {
    return prisma.pRDVersion.findUnique({ where: { id: versionId } });
  }

  async restoreVersion(versionId: string, userId: string): Promise<PRD> {
    log.info({ versionId }, 'Restoring PRD version');

    const version = await prisma.pRDVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new Error('Version not found');
    }

    const content = version.content as Record<string, unknown>;

    // Create a new version with current state before restoring
    await this.createVersion(
      version.prdId,
      userId,
      `Before restoring to version ${version.version}`
    );

    // Restore the PRD
    const prd = await prisma.pRD.update({
      where: { id: version.prdId },
      data: {
        title: content.title as string,
        status: content.status as PRD['status'],
        overview: content.overview as string | null,
        problemStatement: content.problemStatement as string | null,
        goals: content.goals as Prisma.JsonValue,
        userStories: content.userStories as Prisma.JsonValue,
        requirements: content.requirements as Prisma.JsonValue,
        successMetrics: content.successMetrics as Prisma.JsonValue,
        timeline: content.timeline as Prisma.JsonValue,
        openQuestions: content.openQuestions as string[],
        appendix: content.appendix as string | null,
      },
    });

    log.info({ prdId: prd.id, restoredVersion: version.version }, 'PRD restored');
    return prd;
  }

  // ==================== REVIEW WORKFLOW ====================

  async requestReview(prdId: string, reviewers: string[]): Promise<PRD> {
    log.info({ prdId, reviewerCount: reviewers.length }, 'Requesting PRD review');

    const prd = await prisma.pRD.update({
      where: { id: prdId },
      data: {
        status: 'REVIEW',
        reviewers,
      },
    });

    // TODO: Send notifications to reviewers

    log.info({ prdId }, 'PRD review requested');
    return prd;
  }

  async approvePRD(prdId: string, approverId: string): Promise<PRD> {
    log.info({ prdId, approverId }, 'Approving PRD');

    const prd = await prisma.pRD.update({
      where: { id: prdId },
      data: {
        status: 'APPROVED',
      },
    });

    // Create version snapshot
    await this.createVersion(prdId, approverId, 'Approved');

    log.info({ prdId }, 'PRD approved');
    return prd;
  }

  // ==================== EXPORT ====================

  async exportPRD(
    prdId: string,
    format: PRDExportFormat['format']
  ): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    log.info({ prdId, format }, 'Exporting PRD');

    const prd = await this.getPRD(prdId);
    if (!prd) {
      throw new Error('PRD not found');
    }

    switch (format) {
      case 'markdown':
        return this.exportToMarkdown(prd);
      case 'json':
        return this.exportToJSON(prd);
      case 'pdf':
        return this.exportToPDF(prd);
      case 'notion':
        return this.exportToNotion(prd);
      case 'confluence':
        return this.exportToConfluence(prd);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportToMarkdown(prd: PRDWithRelations): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    const goals = prd.goals as Array<{ goal: string; metric?: string; target?: string }>;
    const userStories = prd.userStories as Array<{
      as: string;
      iWant: string;
      soThat: string;
      acceptanceCriteria?: string[];
    }>;
    const requirements = prd.requirements as Array<{
      type: string;
      description: string;
      priority?: string;
    }>;
    const successMetrics = prd.successMetrics as Array<{
      metric: string;
      baseline?: string;
      target: string;
    }>;

    let md = `# ${prd.title}\n\n`;
    md += `**Status:** ${prd.status}\n\n`;

    if (prd.overview) {
      md += `## Overview\n\n${prd.overview}\n\n`;
    }

    if (prd.problemStatement) {
      md += `## Problem Statement\n\n${prd.problemStatement}\n\n`;
    }

    if (goals.length > 0) {
      md += `## Goals\n\n`;
      goals.forEach((g, i) => {
        md += `${i + 1}. **${g.goal}**`;
        if (g.metric) md += ` (Metric: ${g.metric})`;
        if (g.target) md += ` - Target: ${g.target}`;
        md += '\n';
      });
      md += '\n';
    }

    if (userStories.length > 0) {
      md += `## User Stories\n\n`;
      userStories.forEach((story, i) => {
        md += `### Story ${i + 1}\n\n`;
        md += `As a ${story.as}, I want to ${story.iWant}, so that ${story.soThat}.\n\n`;
        if (story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
          md += '**Acceptance Criteria:**\n';
          story.acceptanceCriteria.forEach((ac) => {
            md += `- ${ac}\n`;
          });
          md += '\n';
        }
      });
    }

    if (requirements.length > 0) {
      md += `## Requirements\n\n`;
      const functional = requirements.filter((r) => r.type === 'functional');
      const nonFunctional = requirements.filter((r) => r.type === 'non-functional');

      if (functional.length > 0) {
        md += `### Functional Requirements\n\n`;
        functional.forEach((r) => {
          md += `- ${r.description}`;
          if (r.priority) md += ` (${r.priority})`;
          md += '\n';
        });
        md += '\n';
      }

      if (nonFunctional.length > 0) {
        md += `### Non-Functional Requirements\n\n`;
        nonFunctional.forEach((r) => {
          md += `- ${r.description}`;
          if (r.priority) md += ` (${r.priority})`;
          md += '\n';
        });
        md += '\n';
      }
    }

    if (successMetrics.length > 0) {
      md += `## Success Metrics\n\n`;
      md += '| Metric | Baseline | Target |\n';
      md += '|--------|----------|--------|\n';
      successMetrics.forEach((m) => {
        md += `| ${m.metric} | ${m.baseline || 'N/A'} | ${m.target} |\n`;
      });
      md += '\n';
    }

    if (prd.openQuestions.length > 0) {
      md += `## Open Questions\n\n`;
      prd.openQuestions.forEach((q) => {
        md += `- ${q}\n`;
      });
      md += '\n';
    }

    if (prd.appendix) {
      md += `## Appendix\n\n${prd.appendix}\n`;
    }

    const filename = `${prd.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-prd.md`;

    return {
      content: md,
      filename,
      mimeType: 'text/markdown',
    };
  }

  private async exportToJSON(prd: PRDWithRelations): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    const exportData = {
      id: prd.id,
      title: prd.title,
      status: prd.status,
      overview: prd.overview,
      problemStatement: prd.problemStatement,
      goals: prd.goals,
      userStories: prd.userStories,
      requirements: prd.requirements,
      successMetrics: prd.successMetrics,
      timeline: prd.timeline,
      openQuestions: prd.openQuestions,
      appendix: prd.appendix,
      exportedAt: new Date().toISOString(),
    };

    const filename = `${prd.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-prd.json`;

    return {
      content: JSON.stringify(exportData, null, 2),
      filename,
      mimeType: 'application/json',
    };
  }

  private async exportToPDF(prd: PRDWithRelations): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    // TODO: Implement PDF generation (use puppeteer or similar)
    log.warn({ prdId: prd.id }, 'PDF export not yet implemented');

    // For now, return markdown that could be converted to PDF
    return this.exportToMarkdown(prd);
  }

  private async exportToNotion(prd: PRDWithRelations): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    // TODO: Implement Notion export via Notion API
    log.warn({ prdId: prd.id }, 'Notion export not yet implemented');

    // Return Notion-compatible markdown for now
    return this.exportToMarkdown(prd);
  }

  private async exportToConfluence(prd: PRDWithRelations): Promise<{
    content: string;
    filename: string;
    mimeType: string;
  }> {
    // TODO: Implement Confluence export
    log.warn({ prdId: prd.id }, 'Confluence export not yet implemented');

    // Return markdown for now
    return this.exportToMarkdown(prd);
  }

  // ==================== STATS ====================

  async getPRDStats(engagementId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    recentlyUpdated: number;
  }> {
    const prds = await prisma.pRD.findMany({
      where: { engagementId },
      select: { status: true, updatedAt: true },
    });

    const byStatus: Record<string, number> = {};
    prds.forEach((p) => {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentlyUpdated = prds.filter((p) => p.updatedAt > weekAgo).length;

    return {
      total: prds.length,
      byStatus,
      recentlyUpdated,
    };
  }
}

// Singleton instance
export const prdBuilderService = new PRDBuilderService();
