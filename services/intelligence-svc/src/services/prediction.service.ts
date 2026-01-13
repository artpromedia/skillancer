import { PrismaClient } from '@prisma/client';
import { PredictionConfidence, RiskCategory, RiskLevel } from '../types/intelligence.types.js';
import type {
  SuccessPredictionInput,
  PredictionResult,
  RiskFactor,
} from '../types/intelligence.types.js';

export class PredictionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate success prediction for a project
   */
  async predictSuccess(input: SuccessPredictionInput): Promise<PredictionResult> {
    // Get historical data for similar projects
    const historicalData = await this.getHistoricalData(input);

    // Analyze freelancer track record
    const freelancerHistory = await this.getFreelancerHistory(input.freelancerId);

    // Analyze client track record
    const clientHistory = await this.getClientHistory(input.clientId);

    // Calculate risk factors
    const riskFactors = await this.calculateRiskFactors(
      input,
      freelancerHistory,
      clientHistory,
      historicalData
    );

    // Calculate success probability
    const { probability, confidence } = this.calculateSuccessProbability(
      freelancerHistory,
      clientHistory,
      historicalData,
      riskFactors
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(riskFactors, input);

    // Store prediction
    await this.prisma.successPrediction.create({
      data: {
        contractId: input.contractId,
        clientId: input.clientId,
        freelancerId: input.freelancerId,
        successProbability: probability,
        confidence,
        riskFactors: JSON.parse(JSON.stringify(riskFactors)),
        recommendations,
        modelVersion: '1.0.0',
      },
    });

    return {
      successProbability: probability,
      confidence,
      riskFactors,
      recommendations,
      similarProjectsAnalyzed: historicalData.count,
    };
  }

  /**
   * Get prediction for a contract
   */
  async getPrediction(contractId: string) {
    const prediction = await this.prisma.successPrediction.findFirst({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });

    return prediction;
  }

  /**
   * Update prediction based on new data
   */
  async updatePrediction(contractId: string) {
    const existingPrediction = await this.prisma.successPrediction.findFirst({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingPrediction) {
      throw new Error('No existing prediction found');
    }

    // Re-run prediction with current data
    const newPrediction = await this.predictSuccess({
      contractId,
      clientId: existingPrediction.clientId,
      freelancerId: existingPrediction.freelancerId,
      projectType: 'GENERAL',
      budget: 0,
      duration: 0,
      complexity: 'MEDIUM',
    });

    return newPrediction;
  }

  /**
   * Get predictions for a freelancer
   */
  async getFreelancerPredictions(freelancerId: string, page = 1, limit = 20) {
    const [predictions, total] = await Promise.all([
      this.prisma.successPrediction.findMany({
        where: { freelancerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.successPrediction.count({ where: { freelancerId } }),
    ]);

    return {
      predictions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get predictions for a client
   */
  async getClientPredictions(clientId: string, page = 1, limit = 20) {
    const [predictions, total] = await Promise.all([
      this.prisma.successPrediction.findMany({
        where: { clientId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.successPrediction.count({ where: { clientId } }),
    ]);

    return {
      predictions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Private helper methods

  private async getHistoricalData(input: SuccessPredictionInput) {
    const outcomes = await this.prisma.engagementOutcome.findMany({
      where: {
        OR: [{ freelancerId: input.freelancerId }, { clientId: input.clientId }],
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const successfulOutcomes = outcomes.filter((o) =>
      ['EXCEPTIONAL', 'SUCCESSFUL', 'SATISFACTORY'].includes(o.rating)
    );

    return {
      count: outcomes.length,
      successRate: outcomes.length > 0 ? successfulOutcomes.length / outcomes.length : 0.5,
      outcomes,
    };
  }

  private async getFreelancerHistory(freelancerId: string) {
    const outcomes = await this.prisma.engagementOutcome.findMany({
      where: { freelancerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const successful = outcomes.filter((o) =>
      ['EXCEPTIONAL', 'SUCCESSFUL', 'SATISFACTORY'].includes(o.rating)
    );

    const avgScore =
      outcomes.length > 0 ? outcomes.reduce((s, o) => s + Number(o.score), 0) / outcomes.length : 0;

    return {
      totalProjects: outcomes.length,
      successRate: outcomes.length > 0 ? successful.length / outcomes.length : 0.5,
      averageScore: avgScore,
      recentProjects: outcomes.slice(0, 5),
    };
  }

  private async getClientHistory(clientId: string) {
    const outcomes = await this.prisma.engagementOutcome.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const successful = outcomes.filter((o) =>
      ['EXCEPTIONAL', 'SUCCESSFUL', 'SATISFACTORY'].includes(o.rating)
    );

    return {
      totalProjects: outcomes.length,
      successRate: outcomes.length > 0 ? successful.length / outcomes.length : 0.5,
      communicationAvg: this.calculateCommunicationAvg(outcomes),
      scopeChangeAvg: this.calculateScopeChangeAvg(outcomes),
    };
  }

  private calculateCommunicationAvg(outcomes: any[]): number {
    let total = 0;
    let count = 0;

    for (const o of outcomes) {
      const metrics = o.metrics as any;
      if (metrics?.communicationScore) {
        total += metrics.communicationScore;
        count++;
      }
    }

    return count > 0 ? total / count : 0.7;
  }

  private calculateScopeChangeAvg(outcomes: any[]): number {
    let total = 0;
    let count = 0;

    for (const o of outcomes) {
      const metrics = o.metrics as any;
      if (metrics?.scopeChanges !== undefined) {
        total += metrics.scopeChanges;
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  }

  private async calculateRiskFactors(
    input: SuccessPredictionInput,
    freelancerHistory: any,
    clientHistory: any,
    historicalData: any
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Freelancer experience risk
    if (freelancerHistory.totalProjects < 3) {
      riskFactors.push({
        category: RiskCategory.RESOURCE,
        level: RiskLevel.MEDIUM,
        description: 'Limited freelancer track record on platform',
        mitigation: 'Request portfolio samples and conduct thorough interview',
      });
    }

    // Freelancer success rate risk
    if (freelancerHistory.successRate < 0.7) {
      riskFactors.push({
        category: RiskCategory.QUALITY,
        level: freelancerHistory.successRate < 0.5 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        description: 'Freelancer success rate below average',
        mitigation: 'Implement milestone-based payments and regular check-ins',
      });
    }

    // Client history risk
    if (clientHistory.totalProjects > 5 && clientHistory.successRate < 0.6) {
      riskFactors.push({
        category: RiskCategory.RELATIONSHIP,
        level: RiskLevel.MEDIUM,
        description: 'Client has mixed project history',
        mitigation: 'Establish clear communication channels and expectations upfront',
      });
    }

    // Scope change risk
    if (clientHistory.scopeChangeAvg > 3) {
      riskFactors.push({
        category: RiskCategory.SCOPE,
        level: clientHistory.scopeChangeAvg > 5 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        description: 'Client has history of frequent scope changes',
        mitigation: 'Define detailed requirements document and change request process',
      });
    }

    // Communication risk
    if (clientHistory.communicationAvg < 0.5) {
      riskFactors.push({
        category: RiskCategory.COMMUNICATION,
        level: RiskLevel.MEDIUM,
        description: 'Client communication scores below average',
        mitigation: 'Set up regular scheduled check-ins and reporting',
      });
    }

    // Complexity risk
    if (input.complexity === 'HIGH') {
      riskFactors.push({
        category: RiskCategory.QUALITY,
        level: RiskLevel.MEDIUM,
        description: 'High project complexity increases delivery risk',
        mitigation: 'Break project into smaller milestones with clear deliverables',
      });
    }

    // Timeline risk for long projects
    if (input.duration > 90) {
      riskFactors.push({
        category: RiskCategory.TIMELINE,
        level: RiskLevel.LOW,
        description: 'Extended project duration may lead to scope drift',
        mitigation: 'Conduct monthly project health reviews',
      });
    }

    return riskFactors;
  }

  private calculateSuccessProbability(
    freelancerHistory: any,
    clientHistory: any,
    historicalData: any,
    riskFactors: RiskFactor[]
  ): { probability: number; confidence: PredictionConfidence } {
    // Base probability from historical success rates
    let probability = 0.5;

    // Weight freelancer history (40%)
    probability += (freelancerHistory.successRate - 0.5) * 0.4;

    // Weight client history (20%)
    probability += (clientHistory.successRate - 0.5) * 0.2;

    // Weight overall historical data (20%)
    probability += (historicalData.successRate - 0.5) * 0.2;

    // Adjust for risk factors (20% max impact)
    const riskImpact = riskFactors.reduce((impact, rf) => {
      const levelImpacts: Record<RiskLevel, number> = {
        LOW: 0.02,
        MEDIUM: 0.05,
        HIGH: 0.08,
        CRITICAL: 0.12,
      };
      return impact + levelImpacts[rf.level];
    }, 0);

    probability -= Math.min(riskImpact, 0.2);

    // Clamp probability between 0.1 and 0.95
    probability = Math.max(0.1, Math.min(0.95, probability));

    // Calculate confidence based on data availability
    let confidence: PredictionConfidence = PredictionConfidence.LOW;
    const dataPoints = freelancerHistory.totalProjects + clientHistory.totalProjects;

    if (dataPoints >= 20) confidence = PredictionConfidence.VERY_HIGH;
    else if (dataPoints >= 10) confidence = PredictionConfidence.HIGH;
    else if (dataPoints >= 5) confidence = PredictionConfidence.MEDIUM;

    return {
      probability: Math.round(probability * 100) / 100,
      confidence,
    };
  }

  private generateRecommendations(
    riskFactors: RiskFactor[],
    input: SuccessPredictionInput
  ): string[] {
    const recommendations: string[] = [];

    // Add risk-specific mitigations
    for (const rf of riskFactors) {
      if (rf.mitigation) {
        recommendations.push(rf.mitigation);
      }
    }

    // Add general recommendations
    if (input.complexity === 'HIGH') {
      recommendations.push('Consider a small paid trial before full project commitment');
    }

    if (input.duration > 30) {
      recommendations.push('Use milestone-based payment structure for long-term engagement');
    }

    recommendations.push('Document all requirements and expectations in writing');
    recommendations.push('Set up regular progress updates and feedback sessions');

    // Remove duplicates
    return [...new Set(recommendations)];
  }
}
