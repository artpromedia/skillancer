/**
 * Workforce Planning Analytics Service
 * Sprint M10: Talent Intelligence API
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ service: 'workforce-analytics' });

// ============================================================================
// Types
// ============================================================================

export interface TeamRequirements {
  skills: Array<{
    skill: string;
    count: number;
    experienceLevel: 'junior' | 'mid' | 'senior' | 'expert';
    hoursPerWeek: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;
  projectDuration: number; // months
  startDate: Date;
  location?: string;
  timezone?: string;
  budget?: number;
}

export interface TeamEstimate {
  totalCost: number;
  monthlyBurn: number;
  skillBreakdown: Array<{
    skill: string;
    count: number;
    experienceLevel: string;
    avgRate: number;
    monthlyCost: number;
    availability: 'high' | 'medium' | 'low';
    timeToHire: number; // days
    confidenceLevel: number;
  }>;
  timeline: {
    estimatedStartDate: Date;
    onboardingTime: number; // days
    fullProductivityDate: Date;
  };
  risks: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  alternatives: Array<{
    suggestion: string;
    costSavings: number;
    tradeoffs: string[];
  }>;
}

export interface SkillGapAnalysis {
  skill: string;
  currentSupply: number;
  projectedDemand: number;
  gapSize: number;
  gapSeverity: 'surplus' | 'balanced' | 'shortage' | 'critical';
  priceImpact: {
    currentAvgRate: number;
    projectedRate: number;
    changePercent: number;
  };
  recommendations: Array<{
    action: string;
    timeframe: string;
    cost: string | null;
  }>;
}

export interface MarketReport {
  generatedAt: Date;
  period: string;
  executiveSummary: string;
  keyMetrics: {
    totalActiveFreelancers: number;
    totalOpenProjects: number;
    avgProjectValue: number;
    marketGrowthRate: number;
  };
  topSkills: Array<{
    skill: string;
    demand: number;
    avgRate: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  emergingTrends: string[];
  regionInsights: Array<{
    region: string;
    talent: number;
    avgRate: number;
    growth: number;
  }>;
  predictions: Array<{
    prediction: string;
    confidence: number;
    timeframe: string;
  }>;
}

export interface ScenarioAnalysis {
  scenarios: Array<{
    name: string;
    description: string;
    probability: number;
    impact: {
      onCosts: number; // % change
      onTimeline: number; // days change
      onAvailability: number; // % change
    };
    recommendations: string[];
  }>;
}

// ============================================================================
// Workforce Planning Service
// ============================================================================

export class WorkforceAnalyticsService {
  /**
   * Generate team cost and availability estimate
   */
  async estimateTeam(requirements: TeamRequirements): Promise<TeamEstimate> {
    logger.info('Estimating team', {
      skillCount: requirements.skills.length,
      duration: requirements.projectDuration,
    });

    const skillBreakdown: TeamEstimate['skillBreakdown'] = [];
    let totalMonthlyCost = 0;

    for (const skill of requirements.skills) {
      const estimate = await this.estimateSkillCost(
        skill.skill,
        skill.experienceLevel,
        skill.hoursPerWeek,
        requirements.location
      );

      const monthlyCost = estimate.avgRate * skill.hoursPerWeek * 4 * skill.count;
      totalMonthlyCost += monthlyCost;

      skillBreakdown.push({
        skill: skill.skill,
        count: skill.count,
        experienceLevel: skill.experienceLevel,
        avgRate: estimate.avgRate,
        monthlyCost,
        availability: estimate.availability,
        timeToHire: estimate.timeToHire,
        confidenceLevel: estimate.confidence,
      });
    }

    const totalCost = totalMonthlyCost * requirements.projectDuration;
    const maxTimeToHire = Math.max(...skillBreakdown.map((s) => s.timeToHire));

    const estimatedStartDate = new Date(requirements.startDate);
    estimatedStartDate.setDate(estimatedStartDate.getDate() + maxTimeToHire);

    const fullProductivityDate = new Date(estimatedStartDate);
    fullProductivityDate.setDate(fullProductivityDate.getDate() + 14); // 2 weeks onboarding

    // Identify risks
    const risks = this.identifyRisks(skillBreakdown, requirements);

    // Generate cost-saving alternatives
    const alternatives = this.generateAlternatives(skillBreakdown, requirements);

    return {
      totalCost,
      monthlyBurn: totalMonthlyCost,
      skillBreakdown,
      timeline: {
        estimatedStartDate,
        onboardingTime: 14,
        fullProductivityDate,
      },
      risks,
      alternatives,
    };
  }

  /**
   * Analyze skill gaps in the market
   */
  async analyzeSkillGaps(skills: string[], location?: string): Promise<SkillGapAnalysis[]> {
    logger.info('Analyzing skill gaps', { skills, location });

    const analyses: SkillGapAnalysis[] = [];

    for (const skill of skills) {
      const supply = await this.getSupplyData(skill, location);
      const demand = await this.getDemandData(skill, location);

      const gapSize = demand.projected - supply.current;
      const gapRatio = supply.current / demand.projected;

      let gapSeverity: SkillGapAnalysis['gapSeverity'];
      if (gapRatio >= 1.5) gapSeverity = 'surplus';
      else if (gapRatio >= 0.9) gapSeverity = 'balanced';
      else if (gapRatio >= 0.6) gapSeverity = 'shortage';
      else gapSeverity = 'critical';

      // Calculate price impact
      const priceMultiplier =
        gapSeverity === 'critical'
          ? 1.3
          : gapSeverity === 'shortage'
            ? 1.15
            : gapSeverity === 'surplus'
              ? 0.95
              : 1.0;

      analyses.push({
        skill,
        currentSupply: supply.current,
        projectedDemand: demand.projected,
        gapSize,
        gapSeverity,
        priceImpact: {
          currentAvgRate: supply.avgRate,
          projectedRate: Math.round(supply.avgRate * priceMultiplier),
          changePercent: Math.round((priceMultiplier - 1) * 100),
        },
        recommendations: this.generateGapRecommendations(gapSeverity, skill),
      });
    }

    return analyses;
  }

  /**
   * Generate comprehensive market report
   */
  async generateMarketReport(category?: string, location?: string): Promise<MarketReport> {
    logger.info('Generating market report', { category, location });

    return {
      generatedAt: new Date(),
      period: 'Q4 2024',
      executiveSummary: `The freelance technology market continues to show strong growth, with AI/ML skills experiencing the highest demand increase. Remote work normalization has expanded the global talent pool, while specialized skills command premium rates.`,
      keyMetrics: {
        totalActiveFreelancers: 145000,
        totalOpenProjects: 28500,
        avgProjectValue: 12500,
        marketGrowthRate: 18.5,
      },
      topSkills: [
        { skill: 'React', demand: 8500, avgRate: 85, trend: 'stable' as const },
        { skill: 'Python', demand: 7200, avgRate: 90, trend: 'up' as const },
        { skill: 'AWS', demand: 6100, avgRate: 110, trend: 'up' as const },
        { skill: 'Node.js', demand: 5800, avgRate: 80, trend: 'stable' as const },
        { skill: 'TypeScript', demand: 5200, avgRate: 88, trend: 'up' as const },
        { skill: 'Machine Learning', demand: 4800, avgRate: 125, trend: 'up' as const },
        { skill: 'Kubernetes', demand: 3900, avgRate: 115, trend: 'up' as const },
      ],
      emergingTrends: [
        'LLM integration and prompt engineering becoming essential skills',
        'Platform engineering replacing traditional DevOps roles',
        'Increased demand for AI ethics and responsible AI expertise',
        'Growing preference for fractional CTOs and technical advisors',
        'Rise of specialized vertical expertise (FinTech, HealthTech)',
      ],
      regionInsights: [
        { region: 'North America', talent: 45000, avgRate: 110, growth: 12 },
        { region: 'Europe', talent: 38000, avgRate: 85, growth: 15 },
        { region: 'India', talent: 32000, avgRate: 35, growth: 25 },
        { region: 'Latin America', talent: 18000, avgRate: 45, growth: 22 },
        { region: 'Southeast Asia', talent: 12000, avgRate: 40, growth: 28 },
      ],
      predictions: [
        {
          prediction: 'AI/ML specialist rates will increase 20-30% by end of 2025',
          confidence: 0.85,
          timeframe: '12 months',
        },
        {
          prediction: 'Remote-first companies will represent 60% of enterprise clients',
          confidence: 0.78,
          timeframe: '18 months',
        },
        {
          prediction: 'Demand for Web3/blockchain skills will stabilize at current levels',
          confidence: 0.72,
          timeframe: '6 months',
        },
      ],
    };
  }

  /**
   * Run scenario analysis for workforce planning
   */
  async runScenarioAnalysis(requirements: TeamRequirements): Promise<ScenarioAnalysis> {
    logger.info('Running scenario analysis');

    return {
      scenarios: [
        {
          name: 'Base Case',
          description: 'Market conditions remain stable',
          probability: 0.5,
          impact: {
            onCosts: 0,
            onTimeline: 0,
            onAvailability: 0,
          },
          recommendations: ['Proceed with standard hiring timeline'],
        },
        {
          name: 'Talent Shortage',
          description: 'AI skills demand spikes, reducing availability',
          probability: 0.25,
          impact: {
            onCosts: 25,
            onTimeline: 21,
            onAvailability: -30,
          },
          recommendations: [
            'Consider upskilling existing team members',
            'Look at adjacent skill pools',
            'Increase budget allocation for key roles',
          ],
        },
        {
          name: 'Economic Slowdown',
          description: 'Tech hiring freezes increase freelancer availability',
          probability: 0.15,
          impact: {
            onCosts: -15,
            onTimeline: -7,
            onAvailability: 40,
          },
          recommendations: [
            'Opportunity to hire senior talent at competitive rates',
            'Consider building a larger bench',
          ],
        },
        {
          name: 'Rapid AI Advancement',
          description: 'New tools reduce need for certain roles',
          probability: 0.1,
          impact: {
            onCosts: -20,
            onTimeline: 0,
            onAvailability: 20,
          },
          recommendations: [
            'Stay updated on AI tooling developments',
            'Prioritize AI-augmented workflows',
            'Focus on roles that require human judgment',
          ],
        },
      ],
    };
  }

  /**
   * Compare hiring options (freelance vs full-time vs agency)
   */
  async compareHiringOptions(
    skill: string,
    hoursPerWeek: number,
    durationMonths: number,
    location?: string
  ): Promise<{
    freelance: { monthlyCost: number; totalCost: number; pros: string[]; cons: string[] };
    fullTime: { monthlyCost: number; totalCost: number; pros: string[]; cons: string[] };
    agency: { monthlyCost: number; totalCost: number; pros: string[]; cons: string[] };
  }> {
    logger.info('Comparing hiring options', { skill, hoursPerWeek, durationMonths });

    const freelanceRate = 85; // $/hr
    const fteSalary = 120000; // annual
    const agencyRate = 130; // $/hr

    const freelanceMonthlyCost = freelanceRate * hoursPerWeek * 4;
    const fteMonthlyCost = (fteSalary / 12) * 1.3; // 30% overhead
    const agencyMonthlyCost = agencyRate * hoursPerWeek * 4;

    return {
      freelance: {
        monthlyCost: freelanceMonthlyCost,
        totalCost: freelanceMonthlyCost * durationMonths,
        pros: [
          'Flexible commitment',
          'Access to specialized expertise',
          'No long-term obligations',
          'Fast onboarding',
        ],
        cons: [
          'Less control over availability',
          'Knowledge may leave with freelancer',
          'Coordination overhead',
        ],
      },
      fullTime: {
        monthlyCost: fteMonthlyCost,
        totalCost: fteMonthlyCost * durationMonths,
        pros: [
          'Full dedication',
          'Knowledge retention',
          'Team culture alignment',
          'Long-term investment',
        ],
        cons: [
          'High fixed costs',
          'Hiring takes longer',
          'Difficult to scale down',
          'Benefits overhead',
        ],
      },
      agency: {
        monthlyCost: agencyMonthlyCost,
        totalCost: agencyMonthlyCost * durationMonths,
        pros: ['Quick scaling', 'Managed team', 'Backup resources', 'SLAs and guarantees'],
        cons: ['Highest cost', 'Less direct control', 'Variable quality', 'Communication layers'],
      },
    };
  }

  // ========================================
  // Private Methods
  // ========================================

  private async estimateSkillCost(
    skill: string,
    level: string,
    hoursPerWeek: number,
    location?: string
  ): Promise<{
    avgRate: number;
    availability: 'high' | 'medium' | 'low';
    timeToHire: number;
    confidence: number;
  }> {
    // Mock data - in production, query from rate aggregates
    const baseRates: Record<string, number> = {
      junior: 45,
      mid: 75,
      senior: 110,
      expert: 150,
    };

    const skillMultipliers: Record<string, number> = {
      'machine learning': 1.4,
      react: 1.0,
      python: 1.1,
      aws: 1.2,
      kubernetes: 1.25,
      default: 1.0,
    };

    const baseRate = baseRates[level] || 75;
    const multiplier = skillMultipliers[skill.toLowerCase()] || skillMultipliers.default;

    return {
      avgRate: Math.round(baseRate * multiplier),
      availability: level === 'expert' ? 'low' : level === 'senior' ? 'medium' : 'high',
      timeToHire: level === 'expert' ? 21 : level === 'senior' ? 14 : 7,
      confidence: 0.85,
    };
  }

  private async getSupplyData(
    skill: string,
    location?: string
  ): Promise<{ current: number; avgRate: number }> {
    return { current: 850, avgRate: 85 };
  }

  private async getDemandData(skill: string, location?: string): Promise<{ projected: number }> {
    return { projected: 1200 };
  }

  private identifyRisks(
    breakdown: TeamEstimate['skillBreakdown'],
    requirements: TeamRequirements
  ): TeamEstimate['risks'] {
    const risks: TeamEstimate['risks'] = [];

    // Check for low availability skills
    const lowAvailability = breakdown.filter((s) => s.availability === 'low');
    if (lowAvailability.length > 0) {
      risks.push({
        type: 'availability',
        description: `${lowAvailability.map((s) => s.skill).join(', ')} have low market availability`,
        severity: 'high',
        mitigation: 'Start recruiting early, consider remote talent globally',
      });
    }

    // Check for budget constraints
    if (requirements.budget) {
      const totalCost =
        breakdown.reduce((sum, s) => sum + s.monthlyCost, 0) * requirements.projectDuration;
      if (totalCost > requirements.budget) {
        risks.push({
          type: 'budget',
          description: `Estimated cost exceeds budget by ${Math.round(((totalCost - requirements.budget) / requirements.budget) * 100)}%`,
          severity: 'high',
          mitigation: 'Consider reducing scope, adjusting seniority mix, or extending timeline',
        });
      }
    }

    // Check for timeline risks
    const longHireTimes = breakdown.filter((s) => s.timeToHire > 14);
    if (longHireTimes.length > 0) {
      risks.push({
        type: 'timeline',
        description: `${longHireTimes.length} roles may take longer to fill`,
        severity: 'medium',
        mitigation: 'Parallel recruiting, use specialized recruiters',
      });
    }

    return risks;
  }

  private generateAlternatives(
    breakdown: TeamEstimate['skillBreakdown'],
    requirements: TeamRequirements
  ): TeamEstimate['alternatives'] {
    return [
      {
        suggestion: 'Replace 1 Senior with 2 Mid-level developers',
        costSavings: 2500,
        tradeoffs: ['May require more oversight', 'Longer ramp-up time'],
      },
      {
        suggestion: 'Consider offshore talent for non-critical roles',
        costSavings: 8000,
        tradeoffs: ['Timezone challenges', 'Communication overhead'],
      },
      {
        suggestion: 'Use part-time specialists for expert-level skills',
        costSavings: 3500,
        tradeoffs: ['Limited availability', 'Context switching'],
      },
    ];
  }

  private generateGapRecommendations(
    severity: SkillGapAnalysis['gapSeverity'],
    skill: string
  ): SkillGapAnalysis['recommendations'] {
    const recommendations: SkillGapAnalysis['recommendations'] = [];

    if (severity === 'critical' || severity === 'shortage') {
      recommendations.push({
        action: 'Invest in training programs for adjacent skill holders',
        timeframe: '3-6 months',
        cost: '$2,000-5,000 per trainee',
      });
      recommendations.push({
        action: 'Expand geographic search to emerging markets',
        timeframe: 'Immediate',
        cost: null,
      });
      recommendations.push({
        action: 'Consider fractional or part-time engagement',
        timeframe: 'Immediate',
        cost: null,
      });
    } else if (severity === 'surplus') {
      recommendations.push({
        action: 'Opportunity for competitive rates',
        timeframe: 'Immediate',
        cost: 'Potential savings of 10-20%',
      });
      recommendations.push({
        action: 'Build a bench of pre-vetted talent',
        timeframe: '1-2 months',
        cost: null,
      });
    }

    return recommendations;
  }
}

export const workforceAnalyticsService = new WorkforceAnalyticsService();
