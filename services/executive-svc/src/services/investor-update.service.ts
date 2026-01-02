/**
 * @module @skillancer/executive-svc/services/investor-update
 * Investor Update Service for CFO Tool Suite
 *
 * Manages investor communications:
 * - Update templates and generation
 * - Scheduling and delivery tracking
 * - Open/engagement tracking
 */

import type { Prisma, PrismaClient } from '@skillancer/database';

export interface UpdateContent {
  highlights: string[];
  metrics: MetricItem[];
  challenges?: string[];
  asks?: string[];
  body?: string;
}

export interface MetricItem {
  name: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface UpdateTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

export const UPDATE_TEMPLATES: UpdateTemplate[] = [
  {
    id: 'monthly-investor',
    name: 'Monthly Investor Update',
    description: 'Standard monthly update for investors',
    sections: ['highlights', 'metrics', 'challenges', 'asks'],
  },
  {
    id: 'quarterly-investor',
    name: 'Quarterly Investor Update',
    description: 'Comprehensive quarterly update',
    sections: ['highlights', 'metrics', 'body', 'challenges', 'asks'],
  },
  {
    id: 'fundraising-update',
    name: 'Fundraising Update',
    description: 'Update during active fundraising',
    sections: ['highlights', 'metrics', 'asks'],
  },
];

export class InvestorUpdateService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get available templates
   */
  getTemplates(): UpdateTemplate[] {
    return UPDATE_TEMPLATES;
  }

  /**
   * Create update from template
   */
  async createFromTemplate(input: {
    engagementId: string;
    templateId: string;
    period: string;
    subject: string;
    data?: Partial<UpdateContent>;
  }): Promise<unknown> {
    const template = UPDATE_TEMPLATES.find((t) => t.id === input.templateId);
    if (!template) {
      throw new Error(`Template not found: ${input.templateId}`);
    }

    const content: UpdateContent = {
      highlights: input.data?.highlights || [],
      metrics: input.data?.metrics || [],
      challenges: template.sections.includes('challenges')
        ? input.data?.challenges || []
        : undefined,
      asks: template.sections.includes('asks') ? input.data?.asks || [] : undefined,
      body: template.sections.includes('body') ? input.data?.body || '' : undefined,
    };

    return this.prisma.investorUpdate.create({
      data: {
        engagementId: input.engagementId,
        period: input.period,
        subject: input.subject,
        content: content as unknown as Prisma.JsonValue,
        status: 'DRAFT',
        recipients: [],
      },
    });
  }

  /**
   * Generate update content from financial data
   */
  generateContent(financialData: Record<string, unknown>): UpdateContent {
    const highlights: string[] = [];
    const metrics: MetricItem[] = [];

    // Generate highlights based on financial performance
    if (financialData.revenueGrowth && Number(financialData.revenueGrowth) > 0) {
      highlights.push(`Revenue grew ${financialData.revenueGrowth}% this period`);
    }
    if (financialData.runway && Number(financialData.runway) > 12) {
      highlights.push(`Strong runway of ${financialData.runway} months`);
    }
    if (financialData.newCustomers) {
      highlights.push(`Added ${financialData.newCustomers} new customers`);
    }

    // Generate metrics
    if (financialData.mrr !== undefined) {
      metrics.push({
        name: 'MRR',
        value: `$${Number(financialData.mrr).toLocaleString()}`,
        change: financialData.mrrChange ? `${financialData.mrrChange}%` : undefined,
        trend:
          Number(financialData.mrrChange) > 0
            ? 'up'
            : Number(financialData.mrrChange) < 0
              ? 'down'
              : 'flat',
      });
    }
    if (financialData.arr !== undefined) {
      metrics.push({
        name: 'ARR',
        value: `$${Number(financialData.arr).toLocaleString()}`,
      });
    }
    if (financialData.cashBalance !== undefined) {
      metrics.push({
        name: 'Cash Balance',
        value: `$${Number(financialData.cashBalance).toLocaleString()}`,
      });
    }
    if (financialData.runway !== undefined) {
      metrics.push({
        name: 'Runway',
        value: `${financialData.runway} months`,
      });
    }
    if (financialData.burnRate !== undefined) {
      metrics.push({
        name: 'Monthly Burn',
        value: `$${Number(financialData.burnRate).toLocaleString()}`,
      });
    }

    return {
      highlights,
      metrics,
      challenges: [],
      asks: [],
    };
  }

  /**
   * Update content
   */
  async updateContent(updateId: string, content: Partial<UpdateContent>): Promise<unknown> {
    const existing = await this.prisma.investorUpdate.findUnique({
      where: { id: updateId },
    });

    if (!existing) {
      throw new Error('Update not found');
    }

    const existingContent = existing.content as unknown as UpdateContent;
    const mergedContent: UpdateContent = {
      highlights: content.highlights ?? existingContent.highlights,
      metrics: content.metrics ?? existingContent.metrics,
      challenges: content.challenges ?? existingContent.challenges,
      asks: content.asks ?? existingContent.asks,
      body: content.body ?? existingContent.body,
    };

    return this.prisma.investorUpdate.update({
      where: { id: updateId },
      data: {
        content: mergedContent as unknown as Prisma.JsonValue,
      },
    });
  }

  /**
   * Schedule update for delivery
   */
  async schedule(updateId: string, scheduledFor: Date, recipients: string[]): Promise<unknown> {
    return this.prisma.investorUpdate.update({
      where: { id: updateId },
      data: {
        status: 'SCHEDULED',
        scheduledFor,
        recipients,
      },
    });
  }

  /**
   * Mark as sent
   */
  async markAsSent(updateId: string): Promise<unknown> {
    return this.prisma.investorUpdate.update({
      where: { id: updateId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  /**
   * Track open (increment counter)
   */
  async trackOpen(updateId: string): Promise<void> {
    await this.prisma.investorUpdate.update({
      where: { id: updateId },
      data: {
        openCount: { increment: 1 },
      },
    });
  }

  /**
   * Get updates pending delivery
   */
  async getPendingUpdates(): Promise<unknown[]> {
    return this.prisma.investorUpdate.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  /**
   * Get update analytics
   */
  async getAnalytics(engagementId: string): Promise<{
    totalSent: number;
    averageOpenRate: number;
    recentUpdates: unknown[];
  }> {
    const updates = await this.prisma.investorUpdate.findMany({
      where: {
        engagementId,
        status: 'SENT',
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    const totalSent = updates.length;
    const totalOpens = updates.reduce((sum, u) => sum + (u.openCount || 0), 0);
    const totalRecipients = updates.reduce((sum, u) => sum + (u.recipients?.length || 0), 0);
    const averageOpenRate = totalRecipients > 0 ? (totalOpens / totalRecipients) * 100 : 0;

    return {
      totalSent,
      averageOpenRate: Math.round(averageOpenRate * 10) / 10,
      recentUpdates: updates,
    };
  }
}

export const createInvestorUpdateService = (prisma: PrismaClient) =>
  new InvestorUpdateService(prisma);
