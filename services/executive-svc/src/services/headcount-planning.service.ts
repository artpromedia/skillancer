import { prisma } from '@skillancer/database';
import { EventEmitter } from 'events';
import { Decimal } from '@prisma/client/runtime/library';

// Headcount Planning Service for CHRO Suite
// Manages headcount plans, planned hires, and actual vs planned tracking

export type HireStatus =
  | 'PLANNED'
  | 'APPROVED'
  | 'RECRUITING'
  | 'OFFER_EXTENDED'
  | 'FILLED'
  | 'CANCELLED';

export interface DepartmentPlan {
  department: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export interface HeadcountPlanInput {
  year: number;
  departmentPlans: DepartmentPlan[];
}

export interface PlannedHireInput {
  title: string;
  department: string;
  level?: string;
  targetQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  salaryBudget?: number;
}

export interface PlannedHireUpdate {
  title?: string;
  department?: string;
  level?: string;
  targetQuarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  status?: HireStatus;
  actualHireDate?: Date;
  salaryBudget?: number;
}

export interface HeadcountVariance {
  department: string;
  quarter: string;
  planned: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface HeadcountReport {
  year: number;
  totalPlanned: number;
  totalActual: number;
  totalVariance: number;
  byDepartment: HeadcountVariance[];
  byQuarter: {
    q1: { planned: number; actual: number };
    q2: { planned: number; actual: number };
    q3: { planned: number; actual: number };
    q4: { planned: number; actual: number };
  };
  plannedHires: {
    total: number;
    filled: number;
    inProgress: number;
    cancelled: number;
  };
  budgetImpact: {
    plannedCost: number;
    actualCost: number;
    variance: number;
  };
}

class HeadcountPlanningService extends EventEmitter {
  // ==================== PLAN MANAGEMENT ====================

  async createHeadcountPlan(engagementId: string, plan: HeadcountPlanInput) {
    const created = await prisma.headcountPlan.create({
      data: {
        engagementId,
        year: plan.year,
        departmentPlans: plan.departmentPlans as any,
      },
    });

    this.emit('plan:created', { engagementId, planId: created.id });
    return created;
  }

  async updateHeadcountPlan(planId: string, updates: Partial<HeadcountPlanInput>) {
    const updated = await prisma.headcountPlan.update({
      where: { id: planId },
      data: {
        ...(updates.departmentPlans && { departmentPlans: updates.departmentPlans as any }),
      },
    });

    this.emit('plan:updated', { planId });
    return updated;
  }

  async getHeadcountPlan(engagementId: string, year: number) {
    return prisma.headcountPlan.findUnique({
      where: {
        engagementId_year: { engagementId, year },
      },
      include: {
        plannedHires: true,
      },
    });
  }

  async getHeadcountPlans(engagementId: string) {
    return prisma.headcountPlan.findMany({
      where: { engagementId },
      include: {
        plannedHires: true,
      },
      orderBy: { year: 'desc' },
    });
  }

  // ==================== PLANNED HIRES ====================

  async addPlannedHire(planId: string, hire: PlannedHireInput) {
    const created = await prisma.plannedHire.create({
      data: {
        planId,
        ...hire,
        salaryBudget: hire.salaryBudget ? new Decimal(hire.salaryBudget) : null,
        status: 'PLANNED',
      },
    });

    this.emit('hire:added', { planId, hireId: created.id });
    return created;
  }

  async updatePlannedHire(hireId: string, updates: PlannedHireUpdate) {
    const updated = await prisma.plannedHire.update({
      where: { id: hireId },
      data: {
        ...updates,
        ...(updates.salaryBudget !== undefined && {
          salaryBudget: updates.salaryBudget ? new Decimal(updates.salaryBudget) : null,
        }),
      },
    });

    this.emit('hire:updated', { hireId });
    return updated;
  }

  async markHireAsFilled(hireId: string, actualHireDate: Date) {
    return this.updatePlannedHire(hireId, {
      status: 'FILLED',
      actualHireDate,
    });
  }

  async cancelPlannedHire(hireId: string) {
    return this.updatePlannedHire(hireId, {
      status: 'CANCELLED',
    });
  }

  async getPlannedHires(planId: string, status?: HireStatus) {
    return prisma.plannedHire.findMany({
      where: {
        planId,
        ...(status && { status }),
      },
      orderBy: [{ targetQuarter: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getOpenPositions(planId: string) {
    return prisma.plannedHire.findMany({
      where: {
        planId,
        status: { in: ['PLANNED', 'APPROVED', 'RECRUITING', 'OFFER_EXTENDED'] },
      },
      orderBy: { targetQuarter: 'asc' },
    });
  }

  // ==================== VARIANCE TRACKING ====================

  async compareActualToPlanned(
    engagementId: string,
    year: number,
    actualHeadcount: Record<string, { q1: number; q2: number; q3: number; q4: number }>
  ): Promise<HeadcountVariance[]> {
    const plan = await this.getHeadcountPlan(engagementId, year);
    if (!plan) return [];

    const departmentPlans = plan.departmentPlans as unknown as DepartmentPlan[];
    const variances: HeadcountVariance[] = [];

    departmentPlans.forEach((deptPlan) => {
      const actual = actualHeadcount[deptPlan.department] || { q1: 0, q2: 0, q3: 0, q4: 0 };

      (['q1', 'q2', 'q3', 'q4'] as const).forEach((quarter) => {
        const planned = deptPlan[quarter];
        const actualVal = actual[quarter];
        const variance = actualVal - planned;
        const variancePercent = planned > 0 ? (variance / planned) * 100 : 0;

        variances.push({
          department: deptPlan.department,
          quarter: quarter.toUpperCase(),
          planned,
          actual: actualVal,
          variance,
          variancePercent: Math.round(variancePercent * 10) / 10,
        });
      });
    });

    return variances;
  }

  // ==================== FORECASTING ====================

  async getForecastedCost(planId: string): Promise<{
    totalBudget: number;
    byQuarter: Record<string, number>;
    byDepartment: Record<string, number>;
  }> {
    const hires = await prisma.plannedHire.findMany({
      where: {
        planId,
        status: { not: 'CANCELLED' },
      },
    });

    let totalBudget = 0;
    const byQuarter: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const byDepartment: Record<string, number> = {};

    hires.forEach((hire) => {
      const salary = hire.salaryBudget ? Number(hire.salaryBudget) : 0;
      totalBudget += salary;
      byQuarter[hire.targetQuarter] = (byQuarter[hire.targetQuarter] || 0) + salary;
      byDepartment[hire.department] = (byDepartment[hire.department] || 0) + salary;
    });

    return { totalBudget, byQuarter, byDepartment };
  }

  // ==================== REPORTING ====================

  async generateHeadcountReport(
    engagementId: string,
    year: number,
    actualHeadcount?: Record<string, { q1: number; q2: number; q3: number; q4: number }>
  ): Promise<HeadcountReport | null> {
    const plan = await this.getHeadcountPlan(engagementId, year);
    if (!plan) return null;

    const departmentPlans = plan.departmentPlans as unknown as DepartmentPlan[];
    const hires = plan.plannedHires;

    // Calculate totals
    let totalPlanned = 0;
    let totalActual = 0;
    const byQuarter = {
      q1: { planned: 0, actual: 0 },
      q2: { planned: 0, actual: 0 },
      q3: { planned: 0, actual: 0 },
      q4: { planned: 0, actual: 0 },
    };

    departmentPlans.forEach((dept) => {
      (['q1', 'q2', 'q3', 'q4'] as const).forEach((q) => {
        totalPlanned += dept[q];
        byQuarter[q].planned += dept[q];
      });
    });

    // Calculate actual if provided
    if (actualHeadcount) {
      Object.values(actualHeadcount).forEach((dept) => {
        (['q1', 'q2', 'q3', 'q4'] as const).forEach((q) => {
          totalActual += dept[q];
          byQuarter[q].actual += dept[q];
        });
      });
    }

    // Calculate hire stats
    const filled = hires.filter((h) => h.status === 'FILLED').length;
    const cancelled = hires.filter((h) => h.status === 'CANCELLED').length;
    const inProgress = hires.filter((h) =>
      ['PLANNED', 'APPROVED', 'RECRUITING', 'OFFER_EXTENDED'].includes(h.status)
    ).length;

    // Calculate budget
    const plannedCost = hires
      .filter((h) => h.status !== 'CANCELLED')
      .reduce((sum, h) => sum + (h.salaryBudget ? Number(h.salaryBudget) : 0), 0);

    const actualCost = hires
      .filter((h) => h.status === 'FILLED')
      .reduce((sum, h) => sum + (h.salaryBudget ? Number(h.salaryBudget) : 0), 0);

    const variances = actualHeadcount
      ? await this.compareActualToPlanned(engagementId, year, actualHeadcount)
      : [];

    return {
      year,
      totalPlanned,
      totalActual,
      totalVariance: totalActual - totalPlanned,
      byDepartment: variances,
      byQuarter,
      plannedHires: {
        total: hires.length,
        filled,
        inProgress,
        cancelled,
      },
      budgetImpact: {
        plannedCost,
        actualCost,
        variance: actualCost - plannedCost,
      },
    };
  }

  // ==================== WIDGET DATA ====================

  async getHeadcountPlanWidgetData(engagementId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();
    const plan = await this.getHeadcountPlan(engagementId, targetYear);

    if (!plan) {
      return {
        hasPlan: false,
        year: targetYear,
        totalPlanned: 0,
        openPositions: 0,
        filled: 0,
        variance: 0,
      };
    }

    const departmentPlans = plan.departmentPlans as unknown as DepartmentPlan[];
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

    // Calculate current quarter planned
    const quarterKey = currentQuarter.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4';
    const plannedThisQuarter = departmentPlans.reduce((sum, dept) => sum + dept[quarterKey], 0);

    const hires = plan.plannedHires;
    const openPositions = hires.filter((h) =>
      ['PLANNED', 'APPROVED', 'RECRUITING', 'OFFER_EXTENDED'].includes(h.status)
    ).length;
    const filled = hires.filter((h) => h.status === 'FILLED').length;

    return {
      hasPlan: true,
      year: targetYear,
      totalPlanned: plannedThisQuarter,
      openPositions,
      filled,
      variance: filled - plannedThisQuarter,
      byQuarter: {
        q1: departmentPlans.reduce((sum, d) => sum + d.q1, 0),
        q2: departmentPlans.reduce((sum, d) => sum + d.q2, 0),
        q3: departmentPlans.reduce((sum, d) => sum + d.q3, 0),
        q4: departmentPlans.reduce((sum, d) => sum + d.q4, 0),
      },
    };
  }
}

export const headcountPlanningService = new HeadcountPlanningService();
