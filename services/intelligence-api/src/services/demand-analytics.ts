/**
 * Demand Analytics Service
 * Sprint M10: Talent Intelligence API
 */

import { structlog } from '@skillancer/logger';

const logger = structlog.get('demand-analytics');

// ============================================================================
// Types
// ============================================================================

export interface DemandData {
  skill: string;
  location: string | null;
  currentDemand: number;
  demandScore: number; // 0-100 scale
  supplyDemandRatio: number;
  openPositions: number;
  avgTimeToFill: number; // days
  competitionLevel: 'low' | 'medium' | 'high' | 'very_high';
  trendDirection: 'rising' | 'stable' | 'declining';
  trendStrength: number; // 0-1
  snapshotDate: Date;
}

export interface DemandTrend {
  skill: string;
  location: string | null;
  history: Array<{
    period: Date;
    demand: number;
    demandScore: number;
    openPositions: number;
  }>;
  forecast: Array<{
    period: Date;
    projected: number;
    confidence: number;
  }>;
  analysis: {
    overallTrend: 'rising' | 'stable' | 'declining';
    growthRate: number;
    peakMonth: string | null;
    lowMonth: string | null;
  };
}

export interface EmergingSkill {
  skill: string;
  category: string;
  growthRate: number; // % growth
  currentDemand: number;
  projectedDemand: number;
  timeHorizon: string;
  relatedSkills: string[];
  drivers: string[];
  confidenceLevel: number;
}

export interface DecliningSkill {
  skill: string;
  category: string;
  declineRate: number; // % decline
  currentDemand: number;
  projectedDemand: number;
  replacementSkills: string[];
  transitionPath: string | null;
  urgency: 'low' | 'medium' | 'high';
}

export interface SkillCorrelation {
  skill: string;
  relatedSkills: Array<{
    skill: string;
    correlation: number;
    coOccurrence: number;
    trend: 'growing' | 'stable' | 'declining';
  }>;
}

// ============================================================================
// Demand Analytics Service
// ============================================================================

export class DemandAnalyticsService {
  /**
   * Get current demand for a skill
   */
  async getCurrentDemand(skill: string, location?: string): Promise<DemandData | null> {
    logger.info('Getting current demand', { skill, location });

    const signal = await this.queryLatestDemandSignal(skill, location);

    if (!signal) {
      logger.warn('No demand data found', { skill, location });
      return null;
    }

    return {
      skill,
      location: location || null,
      currentDemand: signal.demand,
      demandScore: signal.demandScore,
      supplyDemandRatio: signal.supplyDemandRatio,
      openPositions: signal.openPositions,
      avgTimeToFill: signal.avgTimeToFill,
      competitionLevel: this.calculateCompetitionLevel(signal.supplyDemandRatio),
      trendDirection: signal.trendDirection,
      trendStrength: signal.trendStrength,
      snapshotDate: signal.snapshotDate,
    };
  }

  /**
   * Get demand trends over time with forecast
   */
  async getDemandTrends(
    skill: string,
    periods: number = 12,
    location?: string
  ): Promise<DemandTrend> {
    logger.info('Getting demand trends', { skill, periods, location });

    const historical = await this.queryHistoricalDemand(skill, periods, location);
    const forecast = await this.generateForecast(historical, 3);

    // Analyze trends
    const growthRate = this.calculateGrowthRate(historical);
    const overallTrend = growthRate > 5 ? 'rising' : growthRate < -5 ? 'declining' : 'stable';

    // Find peak and low months
    const sorted = [...historical].sort((a, b) => b.demand - a.demand);
    const peakMonth = sorted[0]?.period.toLocaleString('default', { month: 'long' });
    const lowMonth = sorted[sorted.length - 1]?.period.toLocaleString('default', {
      month: 'long',
    });

    return {
      skill,
      location: location || null,
      history: historical.map((h) => ({
        period: h.period,
        demand: h.demand,
        demandScore: h.demandScore,
        openPositions: h.openPositions,
      })),
      forecast,
      analysis: {
        overallTrend,
        growthRate,
        peakMonth,
        lowMonth,
      },
    };
  }

  /**
   * Get emerging skills
   */
  async getEmergingSkills(category?: string, limit: number = 10): Promise<EmergingSkill[]> {
    logger.info('Getting emerging skills', { category, limit });

    const skills = await this.queryEmergingSkills(category, limit);

    return skills.map((s) => ({
      skill: s.skill,
      category: s.category,
      growthRate: s.growthRate,
      currentDemand: s.currentDemand,
      projectedDemand: Math.round(s.currentDemand * (1 + s.growthRate / 100)),
      timeHorizon: '12 months',
      relatedSkills: s.relatedSkills,
      drivers: s.drivers,
      confidenceLevel: s.confidence,
    }));
  }

  /**
   * Get declining skills
   */
  async getDecliningSkills(category?: string, limit: number = 10): Promise<DecliningSkill[]> {
    logger.info('Getting declining skills', { category, limit });

    const skills = await this.queryDecliningSkills(category, limit);

    return skills.map((s) => ({
      skill: s.skill,
      category: s.category,
      declineRate: s.declineRate,
      currentDemand: s.currentDemand,
      projectedDemand: Math.round(s.currentDemand * (1 - Math.abs(s.declineRate) / 100)),
      replacementSkills: s.replacementSkills,
      transitionPath: s.transitionPath,
      urgency: this.calculateUrgency(s.declineRate),
    }));
  }

  /**
   * Get skill correlations
   */
  async getSkillCorrelations(skill: string, limit: number = 10): Promise<SkillCorrelation> {
    logger.info('Getting skill correlations', { skill, limit });

    const correlations = await this.querySkillCorrelations(skill, limit);

    return {
      skill,
      relatedSkills: correlations,
    };
  }

  /**
   * Get demand by industry
   */
  async getDemandByIndustry(
    skill: string
  ): Promise<Array<{ industry: string; demand: number; percentage: number }>> {
    logger.info('Getting demand by industry', { skill });

    return [
      { industry: 'Technology', demand: 4500, percentage: 0.35 },
      { industry: 'Finance', demand: 2100, percentage: 0.16 },
      { industry: 'Healthcare', demand: 1800, percentage: 0.14 },
      { industry: 'E-commerce', demand: 1500, percentage: 0.12 },
      { industry: 'Manufacturing', demand: 1200, percentage: 0.09 },
      { industry: 'Consulting', demand: 900, percentage: 0.07 },
      { industry: 'Other', demand: 900, percentage: 0.07 },
    ];
  }

  /**
   * Get demand heatmap by region
   */
  async getDemandHeatmap(
    skill: string
  ): Promise<Array<{ region: string; demand: number; intensity: number }>> {
    logger.info('Getting demand heatmap', { skill });

    return [
      { region: 'US', demand: 5200, intensity: 0.95 },
      { region: 'GB', demand: 1800, intensity: 0.72 },
      { region: 'DE', demand: 1400, intensity: 0.65 },
      { region: 'CA', demand: 1100, intensity: 0.58 },
      { region: 'AU', demand: 800, intensity: 0.48 },
      { region: 'IN', demand: 2200, intensity: 0.55 },
      { region: 'SG', demand: 600, intensity: 0.42 },
    ];
  }

  // ========================================
  // Private Methods
  // ========================================

  private calculateCompetitionLevel(ratio: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (ratio >= 3) return 'low';
    if (ratio >= 1.5) return 'medium';
    if (ratio >= 0.8) return 'high';
    return 'very_high';
  }

  private calculateGrowthRate(historical: Array<{ period: Date; demand: number }>): number {
    if (historical.length < 2) return 0;

    const first = historical[0].demand;
    const last = historical[historical.length - 1].demand;

    return ((last - first) / first) * 100;
  }

  private calculateUrgency(declineRate: number): 'low' | 'medium' | 'high' {
    const absRate = Math.abs(declineRate);
    if (absRate >= 30) return 'high';
    if (absRate >= 15) return 'medium';
    return 'low';
  }

  private async generateForecast(
    historical: Array<{ period: Date; demand: number }>,
    periods: number
  ): Promise<Array<{ period: Date; projected: number; confidence: number }>> {
    const forecast: Array<{ period: Date; projected: number; confidence: number }> = [];
    const lastValue = historical[historical.length - 1]?.demand || 0;
    const growthRate = this.calculateGrowthRate(historical) / 100;
    const monthlyGrowth = growthRate / historical.length;

    for (let i = 1; i <= periods; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);

      forecast.push({
        period: date,
        projected: Math.round(lastValue * (1 + monthlyGrowth * i)),
        confidence: Math.max(0.5, 0.95 - i * 0.1),
      });
    }

    return forecast;
  }

  // ========================================
  // Database Queries (Mock implementations)
  // ========================================

  private async queryLatestDemandSignal(skill: string, location?: string): Promise<any> {
    return {
      demand: 2450,
      demandScore: 78,
      supplyDemandRatio: 1.2,
      openPositions: 890,
      avgTimeToFill: 21,
      trendDirection: 'rising' as const,
      trendStrength: 0.65,
      snapshotDate: new Date(),
    };
  }

  private async queryHistoricalDemand(
    skill: string,
    periods: number,
    location?: string
  ): Promise<Array<{ period: Date; demand: number; demandScore: number; openPositions: number }>> {
    const results = [];
    const now = new Date();
    const baseDemand = 2000;

    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const variation = 1 + (i / periods) * 0.2; // Simulating growth
      results.push({
        period: date,
        demand: Math.round(baseDemand * variation + Math.random() * 200),
        demandScore: 65 + Math.floor(Math.random() * 20),
        openPositions: 700 + Math.floor(Math.random() * 300),
      });
    }

    return results;
  }

  private async queryEmergingSkills(
    category?: string,
    limit: number = 10
  ): Promise<
    Array<{
      skill: string;
      category: string;
      growthRate: number;
      currentDemand: number;
      relatedSkills: string[];
      drivers: string[];
      confidence: number;
    }>
  > {
    return [
      {
        skill: 'LLM Fine-Tuning',
        category: 'AI/ML',
        growthRate: 245,
        currentDemand: 890,
        relatedSkills: ['PyTorch', 'Transformers', 'Python'],
        drivers: ['ChatGPT adoption', 'Enterprise AI'],
        confidence: 0.92,
      },
      {
        skill: 'Prompt Engineering',
        category: 'AI/ML',
        growthRate: 180,
        currentDemand: 1200,
        relatedSkills: ['LLMs', 'NLP', 'Technical Writing'],
        drivers: ['GenAI adoption', 'Automation'],
        confidence: 0.88,
      },
      {
        skill: 'Rust',
        category: 'Programming',
        growthRate: 95,
        currentDemand: 2100,
        relatedSkills: ['Systems Programming', 'WebAssembly', 'C++'],
        drivers: ['Performance requirements', 'Memory safety'],
        confidence: 0.85,
      },
      {
        skill: 'dbt (Data Build Tool)',
        category: 'Data Engineering',
        growthRate: 78,
        currentDemand: 1800,
        relatedSkills: ['SQL', 'Data Warehousing', 'Analytics'],
        drivers: ['Data transformation needs', 'Modern data stack'],
        confidence: 0.82,
      },
      {
        skill: 'Kubernetes Platform Engineering',
        category: 'DevOps',
        growthRate: 65,
        currentDemand: 3200,
        relatedSkills: ['Kubernetes', 'Terraform', 'GitOps'],
        drivers: ['Cloud native adoption', 'Developer experience'],
        confidence: 0.8,
      },
    ].slice(0, limit);
  }

  private async queryDecliningSkills(
    category?: string,
    limit: number = 10
  ): Promise<
    Array<{
      skill: string;
      category: string;
      declineRate: number;
      currentDemand: number;
      replacementSkills: string[];
      transitionPath: string | null;
    }>
  > {
    return [
      {
        skill: 'jQuery',
        category: 'Frontend',
        declineRate: -35,
        currentDemand: 800,
        replacementSkills: ['React', 'Vue.js', 'Vanilla JavaScript'],
        transitionPath: 'React Developer',
      },
      {
        skill: 'AngularJS (1.x)',
        category: 'Frontend',
        declineRate: -42,
        currentDemand: 450,
        replacementSkills: ['Angular', 'React', 'Vue.js'],
        transitionPath: 'Modern Angular Developer',
      },
      {
        skill: 'PHP (Legacy)',
        category: 'Backend',
        declineRate: -18,
        currentDemand: 2100,
        replacementSkills: ['Laravel', 'Node.js', 'Python'],
        transitionPath: 'Laravel Developer',
      },
      {
        skill: 'Flash Development',
        category: 'Multimedia',
        declineRate: -85,
        currentDemand: 50,
        replacementSkills: ['HTML5 Canvas', 'WebGL', 'Three.js'],
        transitionPath: 'Web Animation Specialist',
      },
    ].slice(0, limit);
  }

  private async querySkillCorrelations(
    skill: string,
    limit: number
  ): Promise<
    Array<{
      skill: string;
      correlation: number;
      coOccurrence: number;
      trend: 'growing' | 'stable' | 'declining';
    }>
  > {
    // Mock correlations for React
    return [
      { skill: 'TypeScript', correlation: 0.85, coOccurrence: 78, trend: 'growing' as const },
      { skill: 'Next.js', correlation: 0.72, coOccurrence: 65, trend: 'growing' as const },
      { skill: 'Redux', correlation: 0.68, coOccurrence: 58, trend: 'stable' as const },
      { skill: 'GraphQL', correlation: 0.55, coOccurrence: 42, trend: 'growing' as const },
      { skill: 'Node.js', correlation: 0.52, coOccurrence: 68, trend: 'stable' as const },
      { skill: 'Jest', correlation: 0.48, coOccurrence: 52, trend: 'stable' as const },
      { skill: 'Tailwind CSS', correlation: 0.45, coOccurrence: 38, trend: 'growing' as const },
    ].slice(0, limit);
  }
}

export const demandAnalyticsService = new DemandAnalyticsService();
