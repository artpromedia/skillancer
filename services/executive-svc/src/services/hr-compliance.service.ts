import { prisma } from '@skillancer/database';
import { EventEmitter } from 'events';

// HR Compliance Service for CHRO Suite
// Manages HR compliance items: training, filings, policies, audits

export type HRComplianceCategory =
  | 'TRAINING'
  | 'FILING'
  | 'POLICY'
  | 'AUDIT'
  | 'BENEFITS'
  | 'SAFETY'
  | 'OTHER';

export type ComplianceFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'AS_NEEDED';

export type ComplianceItemStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'OVERDUE'
  | 'NOT_APPLICABLE';

export interface HRComplianceItemInput {
  title: string;
  description?: string;
  category: HRComplianceCategory;
  jurisdiction: string; // "Federal", "CA", "NY", etc.
  dueDate?: Date;
  frequency: ComplianceFrequency;
  ownerId?: string;
  affectedCount?: number;
  notes?: string;
}

export interface HRComplianceItemUpdate {
  title?: string;
  description?: string;
  category?: HRComplianceCategory;
  jurisdiction?: string;
  dueDate?: Date;
  frequency?: ComplianceFrequency;
  status?: ComplianceItemStatus;
  ownerId?: string;
  affectedCount?: number;
  notes?: string;
}

export interface ComplianceScore {
  total: number;
  complete: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  score: number; // 0-100
}

// Common compliance items by jurisdiction
const COMMON_FEDERAL_ITEMS: Omit<HRComplianceItemInput, 'frequency'>[] = [
  {
    title: 'I-9 Employment Verification',
    description: 'Complete I-9 forms for all new hires within 3 days of start date',
    category: 'FILING',
    jurisdiction: 'Federal',
  },
  {
    title: 'EEO-1 Reporting',
    description: 'Annual employment data report for employers with 100+ employees',
    category: 'FILING',
    jurisdiction: 'Federal',
  },
  {
    title: 'OSHA 300 Log Maintenance',
    description: 'Maintain log of work-related injuries and illnesses',
    category: 'SAFETY',
    jurisdiction: 'Federal',
  },
  {
    title: 'Form 5500 Filing',
    description: 'Annual benefit plan information return',
    category: 'BENEFITS',
    jurisdiction: 'Federal',
  },
  {
    title: 'ACA Reporting (Forms 1094-C & 1095-C)',
    description: 'Annual Affordable Care Act employer reporting',
    category: 'BENEFITS',
    jurisdiction: 'Federal',
  },
  {
    title: 'COBRA Notices',
    description: 'Provide continuation coverage notices to eligible employees',
    category: 'BENEFITS',
    jurisdiction: 'Federal',
  },
];

const COMMON_STATE_ITEMS: Record<string, Omit<HRComplianceItemInput, 'jurisdiction'>[]> = {
  CA: [
    {
      title: 'Sexual Harassment Prevention Training',
      description: 'Mandatory training for supervisors (2 hrs) and non-supervisors (1 hr)',
      category: 'TRAINING',
      frequency: 'ANNUAL',
    },
    {
      title: 'California Wage Notice',
      description: 'Provide wage notice to new hires and when changes occur',
      category: 'FILING',
      frequency: 'AS_NEEDED',
    },
    {
      title: 'Pay Data Reporting',
      description: 'Annual pay data report to Civil Rights Department',
      category: 'FILING',
      frequency: 'ANNUAL',
    },
  ],
  NY: [
    {
      title: 'Sexual Harassment Prevention Training',
      description: 'Annual interactive training for all employees',
      category: 'TRAINING',
      frequency: 'ANNUAL',
    },
    {
      title: 'NY Wage Theft Prevention Act Notice',
      description: 'Provide wage notice at time of hire',
      category: 'FILING',
      frequency: 'AS_NEEDED',
    },
  ],
};

class HRComplianceService extends EventEmitter {
  // ==================== COMPLIANCE ITEMS ====================

  async addComplianceItem(engagementId: string, item: HRComplianceItemInput) {
    const created = await prisma.hRComplianceItem.create({
      data: {
        engagementId,
        ...item,
        status: 'NOT_STARTED',
      },
    });

    this.emit('item:created', { engagementId, item: created });
    return created;
  }

  async updateComplianceItem(itemId: string, updates: HRComplianceItemUpdate) {
    const updated = await prisma.hRComplianceItem.update({
      where: { id: itemId },
      data: updates,
    });

    this.emit('item:updated', { itemId, updates });
    return updated;
  }

  async completeComplianceItem(itemId: string, completedBy: string) {
    const updated = await prisma.hRComplianceItem.update({
      where: { id: itemId },
      data: {
        status: 'COMPLETE',
        completedAt: new Date(),
        completedBy,
      },
    });

    this.emit('item:completed', { itemId, completedBy });
    return updated;
  }

  async deleteComplianceItem(itemId: string) {
    await prisma.hRComplianceItem.delete({
      where: { id: itemId },
    });

    this.emit('item:deleted', { itemId });
  }

  async getComplianceItems(engagementId: string, status?: ComplianceItemStatus) {
    return prisma.hRComplianceItem.findMany({
      where: {
        engagementId,
        ...(status && { status }),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getComplianceItem(itemId: string) {
    return prisma.hRComplianceItem.findUnique({
      where: { id: itemId },
    });
  }

  // ==================== DEADLINES & TRACKING ====================

  async getUpcomingDeadlines(engagementId: string, days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return prisma.hRComplianceItem.findMany({
      where: {
        engagementId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        dueDate: {
          gte: new Date(),
          lte: futureDate,
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getOverdueItems(engagementId: string) {
    // Update status for overdue items first
    await prisma.hRComplianceItem.updateMany({
      where: {
        engagementId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });

    return prisma.hRComplianceItem.findMany({
      where: {
        engagementId,
        status: 'OVERDUE',
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getComplianceScore(engagementId: string): Promise<ComplianceScore> {
    const items = await prisma.hRComplianceItem.findMany({
      where: { engagementId },
    });

    const total = items.length;
    const complete = items.filter((i) => i.status === 'COMPLETE').length;
    const inProgress = items.filter((i) => i.status === 'IN_PROGRESS').length;
    const notStarted = items.filter((i) => i.status === 'NOT_STARTED').length;
    const overdue = items.filter((i) => i.status === 'OVERDUE').length;

    // Score calculation: Complete = 100%, In Progress = 50%, Not Started = 0%, Overdue = -25%
    const maxScore = total * 100;
    const actualScore = complete * 100 + inProgress * 50 - overdue * 25;
    const score =
      total > 0 ? Math.max(0, Math.min(100, Math.round((actualScore / maxScore) * 100))) : 100;

    return {
      total,
      complete,
      inProgress,
      notStarted,
      overdue,
      score,
    };
  }

  // ==================== CATEGORIZATION ====================

  async getItemsByCategory(engagementId: string) {
    const items = await this.getComplianceItems(engagementId);

    const byCategory: Record<HRComplianceCategory, typeof items> = {
      TRAINING: [],
      FILING: [],
      POLICY: [],
      AUDIT: [],
      BENEFITS: [],
      SAFETY: [],
      OTHER: [],
    };

    items.forEach((item) => {
      byCategory[item.category as HRComplianceCategory].push(item);
    });

    return byCategory;
  }

  async getItemsByJurisdiction(engagementId: string) {
    const items = await this.getComplianceItems(engagementId);

    const byJurisdiction: Record<string, typeof items> = {};

    items.forEach((item) => {
      if (!byJurisdiction[item.jurisdiction]) {
        byJurisdiction[item.jurisdiction] = [];
      }
      byJurisdiction[item.jurisdiction].push(item);
    });

    return byJurisdiction;
  }

  // ==================== AUTO-POPULATION ====================

  async autoPopulateFederalItems(engagementId: string) {
    const items = COMMON_FEDERAL_ITEMS.map((item) => ({
      ...item,
      frequency: 'ANNUAL' as ComplianceFrequency,
    }));

    const created = await Promise.all(
      items.map((item) => this.addComplianceItem(engagementId, item))
    );

    this.emit('items:autopopulated', { engagementId, count: created.length, type: 'federal' });
    return created;
  }

  async autoPopulateStateItems(engagementId: string, states: string[]) {
    const allItems: HRComplianceItemInput[] = [];

    states.forEach((state) => {
      const stateItems = COMMON_STATE_ITEMS[state] || [];
      stateItems.forEach((item) => {
        allItems.push({
          ...item,
          frequency: item.frequency || 'ANNUAL',
          jurisdiction: state,
        });
      });
    });

    const created = await Promise.all(
      allItems.map((item) => this.addComplianceItem(engagementId, item))
    );

    this.emit('items:autopopulated', { engagementId, count: created.length, type: 'state' });
    return created;
  }

  async autoPopulateAllItems(engagementId: string, states: string[]) {
    const [federalItems, stateItems] = await Promise.all([
      this.autoPopulateFederalItems(engagementId),
      this.autoPopulateStateItems(engagementId, states),
    ]);

    return [...federalItems, ...stateItems];
  }

  // ==================== CALENDAR VIEW ====================

  async getComplianceCalendar(engagementId: string, startDate: Date, endDate: Date) {
    const items = await prisma.hRComplianceItem.findMany({
      where: {
        engagementId,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Group by date
    const byDate: Record<string, typeof items> = {};

    items.forEach((item) => {
      if (item.dueDate) {
        const dateKey = item.dueDate.toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = [];
        }
        byDate[dateKey].push(item);
      }
    });

    return byDate;
  }

  // ==================== WIDGET DATA ====================

  async getComplianceWidgetData(engagementId: string) {
    const [score, upcoming, overdue] = await Promise.all([
      this.getComplianceScore(engagementId),
      this.getUpcomingDeadlines(engagementId, 30),
      this.getOverdueItems(engagementId),
    ]);

    return {
      score: score.score,
      byStatus: {
        complete: score.complete,
        inProgress: score.inProgress,
        notStarted: score.notStarted,
        overdue: score.overdue,
      },
      upcomingCount: upcoming.length,
      overdueCount: overdue.length,
      nextDeadline: upcoming[0]?.dueDate || null,
      urgentItems: [...overdue.slice(0, 3), ...upcoming.slice(0, 3)],
    };
  }
}

export const hrComplianceService = new HRComplianceService();
