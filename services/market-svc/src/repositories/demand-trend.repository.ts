/**
 * @module @skillancer/market-svc/repositories/demand-trend
 * Skill Demand Trend repository
 */

import type { PrismaClient, DemandLevel, SkillDemandTrend } from '../types/prisma-shim.js';

export interface DemandTrendData {
  skill: string;
  skillCategory: string;
  periodStart: Date;
  periodEnd: Date;
  projectCount: number;
  totalBudget: number;
  avgBudget: number;
  activeFreelancers: number;
  totalBids: number;
  avgBidsPerProject: number;
  demandSupplyRatio: number;
  demandChangeFromPrevious: number | null;
  rateChangeFromPrevious: number | null;
  demandLevel: DemandLevel;
}

export class DemandTrendRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find the latest demand trend for a skill
   */
  async findLatest(skill: string): Promise<SkillDemandTrend | null> {
    return this.prisma.skillDemandTrend.findFirst({
      where: {
        skill,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });
  }

  /**
   * Find the previous period's trend
   */
  async findPrevious(skill: string, currentPeriodStart: Date): Promise<SkillDemandTrend | null> {
    return this.prisma.skillDemandTrend.findFirst({
      where: {
        skill,
        periodStart: {
          lt: currentPeriodStart,
        },
      },
      orderBy: {
        periodStart: 'desc',
      },
    });
  }

  /**
   * Upsert a demand trend
   */
  async upsert(data: DemandTrendData): Promise<SkillDemandTrend> {
    return this.prisma.skillDemandTrend.upsert({
      where: {
        skill_periodStart: {
          skill: data.skill,
          periodStart: data.periodStart,
        },
      },
      create: {
        skill: data.skill,
        skillCategory: data.skillCategory,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        projectCount: data.projectCount,
        totalBudget: data.totalBudget,
        avgBudget: data.avgBudget,
        activeFreelancers: data.activeFreelancers,
        totalBids: data.totalBids,
        avgBidsPerProject: data.avgBidsPerProject,
        demandSupplyRatio: data.demandSupplyRatio,
        demandChangeFromPrevious: data.demandChangeFromPrevious,
        rateChangeFromPrevious: data.rateChangeFromPrevious,
        demandLevel: data.demandLevel,
      },
      update: {
        skillCategory: data.skillCategory,
        periodEnd: data.periodEnd,
        projectCount: data.projectCount,
        totalBudget: data.totalBudget,
        avgBudget: data.avgBudget,
        activeFreelancers: data.activeFreelancers,
        totalBids: data.totalBids,
        avgBidsPerProject: data.avgBidsPerProject,
        demandSupplyRatio: data.demandSupplyRatio,
        demandChangeFromPrevious: data.demandChangeFromPrevious,
        rateChangeFromPrevious: data.rateChangeFromPrevious,
        demandLevel: data.demandLevel,
      },
    });
  }

  /**
   * Get trends by category
   */
  async getByCategory(
    skillCategory: string,
    options?: { limit?: number }
  ): Promise<SkillDemandTrend[]> {
    return this.prisma.skillDemandTrend.findMany({
      where: {
        skillCategory,
      },
      orderBy: [{ periodStart: 'desc' }, { projectCount: 'desc' }],
      take: options?.limit ?? 20,
    });
  }

  /**
   * Get hot skills (high demand, positive rate growth)
   */
  async getHotSkills(limit: number = 10): Promise<SkillDemandTrend[]> {
    return this.prisma.skillDemandTrend.findMany({
      where: {
        demandLevel: {
          in: ['HIGH', 'VERY_HIGH'],
        },
        rateChangeFromPrevious: {
          gt: 0,
        },
      },
      orderBy: [{ demandLevel: 'desc' }, { rateChangeFromPrevious: 'desc' }],
      distinct: ['skill'],
      take: limit,
    });
  }

  /**
   * Get declining skills (low demand, negative rate growth)
   */
  async getDecliningSkills(limit: number = 10): Promise<SkillDemandTrend[]> {
    return this.prisma.skillDemandTrend.findMany({
      where: {
        demandLevel: {
          in: ['LOW', 'VERY_LOW'],
        },
        rateChangeFromPrevious: {
          lt: 0,
        },
      },
      orderBy: [{ rateChangeFromPrevious: 'asc' }],
      distinct: ['skill'],
      take: limit,
    });
  }

  /**
   * Get all trends for a specific period
   */
  async getByPeriod(periodStart: Date, options?: { limit?: number }): Promise<SkillDemandTrend[]> {
    return this.prisma.skillDemandTrend.findMany({
      where: {
        periodStart,
      },
      orderBy: {
        projectCount: 'desc',
      },
      take: options?.limit ?? 100,
    });
  }

  /**
   * Get skill history
   */
  async getSkillHistory(skill: string, options?: { limit?: number }): Promise<SkillDemandTrend[]> {
    return this.prisma.skillDemandTrend.findMany({
      where: {
        skill,
      },
      orderBy: {
        periodStart: 'desc',
      },
      take: options?.limit ?? 12,
    });
  }
}
