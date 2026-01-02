import { prisma } from '@skillancer/database';
import type {
  FeaturePrioritization,
  PrioritizedFeature,
  PrioritizationFramework,
  Prisma,
} from '@prisma/client';
import { logger } from '@skillancer/logger';
import type {
  CreatePrioritizationInput,
  UpdatePrioritizationInput,
  CreateFeatureInput,
  UpdateFeatureInput,
  RICEScores,
  ICEScores,
  ValueEffortScores,
  PriorityMatrixData,
  ExternalFeatureSync,
  SyncResult,
  FeaturePrioritizationWithFeatures,
} from '@skillancer/types';

const log = logger.child({ service: 'prioritization-service' });

// =============================================================================
// SCORING ALGORITHMS
// =============================================================================

/**
 * Calculate RICE score: (Reach × Impact × Confidence) / Effort
 */
export function calculateRICEScore(scores: RICEScores): number {
  const { reach, impact, confidence, effort } = scores;
  if (effort === 0) return 0;
  return (reach * impact * (confidence / 100)) / effort;
}

/**
 * Calculate ICE score: Impact × Confidence × Ease
 */
export function calculateICEScore(scores: ICEScores): number {
  return scores.impact * scores.confidence * scores.ease;
}

/**
 * Calculate Value/Effort score
 */
export function calculateValueEffortScore(scores: ValueEffortScores): number {
  if (scores.effort === 0) return 0;
  return scores.value / scores.effort;
}

/**
 * Determine quadrant for value/effort matrix
 */
export function getValueEffortQuadrant(
  scores: ValueEffortScores
): 'quick-wins' | 'big-bets' | 'fill-ins' | 'money-pits' {
  const isHighValue = scores.value >= 6;
  const isHighEffort = scores.effort >= 6;

  if (isHighValue && !isHighEffort) return 'quick-wins';
  if (isHighValue && isHighEffort) return 'big-bets';
  if (!isHighValue && !isHighEffort) return 'fill-ins';
  return 'money-pits';
}

/**
 * Determine tier based on score and framework
 */
function determineTier(score: number, framework: PrioritizationFramework): string {
  // Thresholds vary by framework
  if (framework === 'RICE') {
    if (score >= 100) return 'Must Have';
    if (score >= 50) return 'Should Have';
    if (score >= 20) return 'Nice to Have';
    return "Won't Have";
  } else if (framework === 'ICE') {
    if (score >= 500) return 'Must Have';
    if (score >= 200) return 'Should Have';
    if (score >= 80) return 'Nice to Have';
    return "Won't Have";
  } else if (framework === 'VALUE_EFFORT') {
    if (score >= 1.5) return 'Must Have';
    if (score >= 1) return 'Should Have';
    if (score >= 0.5) return 'Nice to Have';
    return "Won't Have";
  }
  return 'Unscored';
}

// =============================================================================
// PRIORITIZATION SERVICE
// =============================================================================

export class PrioritizationService {
  // ==================== Framework CRUD ====================

  async createFramework(input: CreatePrioritizationInput): Promise<FeaturePrioritization> {
    log.info({ engagementId: input.engagementId }, 'Creating prioritization framework');

    const framework = await prisma.featurePrioritization.create({
      data: {
        engagementId: input.engagementId,
        framework: input.framework || 'RICE',
        customWeights: input.customWeights ? (input.customWeights as Prisma.JsonValue) : undefined,
        impactLevels: input.impactLevels ? (input.impactLevels as Prisma.JsonValue) : undefined,
        effortLevels: input.effortLevels ? (input.effortLevels as Prisma.JsonValue) : undefined,
      },
    });

    log.info({ frameworkId: framework.id }, 'Prioritization framework created');
    return framework;
  }

  async getFramework(engagementId: string): Promise<FeaturePrioritizationWithFeatures | null> {
    const framework = await prisma.featurePrioritization.findUnique({
      where: { engagementId },
      include: {
        features: {
          orderBy: { rank: 'asc' },
        },
      },
    });

    return framework as unknown as FeaturePrioritizationWithFeatures | null;
  }

  async updateFramework(
    engagementId: string,
    input: UpdatePrioritizationInput
  ): Promise<FeaturePrioritization> {
    log.info({ engagementId }, 'Updating prioritization framework');

    const framework = await prisma.featurePrioritization.update({
      where: { engagementId },
      data: {
        framework: input.framework,
        customWeights: input.customWeights ? (input.customWeights as Prisma.JsonValue) : undefined,
        impactLevels: input.impactLevels ? (input.impactLevels as Prisma.JsonValue) : undefined,
        effortLevels: input.effortLevels ? (input.effortLevels as Prisma.JsonValue) : undefined,
      },
    });

    // Recalculate all scores if framework changed
    if (input.framework) {
      await this.recalculateRankings(engagementId);
    }

    log.info({ frameworkId: framework.id }, 'Prioritization framework updated');
    return framework;
  }

  // ==================== Feature CRUD ====================

  async addFeature(engagementId: string, input: CreateFeatureInput): Promise<PrioritizedFeature> {
    log.info({ engagementId, title: input.title }, 'Adding feature to prioritization');

    // Get or create framework
    let framework = await prisma.featurePrioritization.findUnique({
      where: { engagementId },
    });

    if (!framework) {
      framework = await this.createFramework({ engagementId, framework: 'RICE' });
    }

    // Calculate score based on framework
    const score = this.calculateFeatureScore(input, framework.framework);
    const tier = score !== null ? determineTier(score, framework.framework) : null;

    const feature = await prisma.prioritizedFeature.create({
      data: {
        prioritizationId: framework.id,
        title: input.title,
        description: input.description,
        category: input.category,

        // RICE scores
        reach: input.reach,
        impact: input.impact,
        confidence: input.confidence,
        effort: input.effort,

        // ICE scores
        iceImpact: input.iceImpact,
        iceConfidence: input.iceConfidence,
        iceEase: input.iceEase,

        // Value/Effort scores
        valueScore: input.valueScore,
        effortScore: input.effortScore,

        // Custom scores
        customScores: input.customScores ? (input.customScores as Prisma.JsonValue) : undefined,

        // Calculated
        score,
        tier,

        // External source
        externalId: input.externalId,
        externalSource: input.externalSource,
        externalUrl: input.externalUrl,

        // Status
        status: input.status || 'BACKLOG',
        roadmapQuarter: input.roadmapQuarter,

        // Related PRD
        relatedPrdId: input.relatedPrdId,
      },
    });

    // Recalculate rankings
    await this.recalculateRankings(engagementId);

    log.info({ featureId: feature.id }, 'Feature added');
    return feature;
  }

  async updateFeature(featureId: string, input: UpdateFeatureInput): Promise<PrioritizedFeature> {
    log.info({ featureId }, 'Updating feature');

    const existingFeature = await prisma.prioritizedFeature.findUnique({
      where: { id: featureId },
      include: { prioritization: true },
    });

    if (!existingFeature) {
      throw new Error('Feature not found');
    }

    // Calculate new score if scores changed
    const scoreInputs = {
      reach: input.reach ?? existingFeature.reach,
      impact: input.impact ?? existingFeature.impact,
      confidence: input.confidence ?? existingFeature.confidence,
      effort: input.effort ?? existingFeature.effort,
      iceImpact: input.iceImpact ?? existingFeature.iceImpact,
      iceConfidence: input.iceConfidence ?? existingFeature.iceConfidence,
      iceEase: input.iceEase ?? existingFeature.iceEase,
      valueScore: input.valueScore ?? existingFeature.valueScore,
      effortScore: input.effortScore ?? existingFeature.effortScore,
      customScores: input.customScores ?? (existingFeature.customScores as Record<string, number>),
    };

    const score = this.calculateFeatureScore(
      scoreInputs as CreateFeatureInput,
      existingFeature.prioritization.framework
    );
    const tier =
      score !== null
        ? determineTier(score, existingFeature.prioritization.framework)
        : existingFeature.tier;

    const feature = await prisma.prioritizedFeature.update({
      where: { id: featureId },
      data: {
        title: input.title,
        description: input.description,
        category: input.category,

        // RICE scores
        reach: input.reach,
        impact: input.impact,
        confidence: input.confidence,
        effort: input.effort,

        // ICE scores
        iceImpact: input.iceImpact,
        iceConfidence: input.iceConfidence,
        iceEase: input.iceEase,

        // Value/Effort scores
        valueScore: input.valueScore,
        effortScore: input.effortScore,

        // Custom scores
        customScores: input.customScores ? (input.customScores as Prisma.JsonValue) : undefined,

        // Calculated
        score,
        tier,

        // External source
        externalId: input.externalId,
        externalSource: input.externalSource,
        externalUrl: input.externalUrl,

        // Status
        status: input.status,
        roadmapQuarter: input.roadmapQuarter,

        // Related PRD
        relatedPrdId: input.relatedPrdId,
      },
    });

    // Recalculate rankings
    await this.recalculateRankings(existingFeature.prioritization.engagementId);

    log.info({ featureId }, 'Feature updated');
    return feature;
  }

  async deleteFeature(featureId: string): Promise<void> {
    const feature = await prisma.prioritizedFeature.findUnique({
      where: { id: featureId },
      include: { prioritization: true },
    });

    if (!feature) {
      throw new Error('Feature not found');
    }

    await prisma.prioritizedFeature.delete({ where: { id: featureId } });
    await this.recalculateRankings(feature.prioritization.engagementId);

    log.info({ featureId }, 'Feature deleted');
  }

  async scoreFeature(
    featureId: string,
    scores: Partial<CreateFeatureInput>
  ): Promise<PrioritizedFeature> {
    return this.updateFeature(featureId, scores);
  }

  // ==================== Scoring ====================

  private calculateFeatureScore(
    input: CreateFeatureInput,
    framework: PrioritizationFramework
  ): number | null {
    switch (framework) {
      case 'RICE':
        if (
          input.reach !== undefined &&
          input.impact !== undefined &&
          input.confidence !== undefined &&
          input.effort !== undefined
        ) {
          return calculateRICEScore({
            reach: input.reach,
            impact: input.impact,
            confidence: input.confidence,
            effort: input.effort,
          });
        }
        break;

      case 'ICE':
        if (
          input.iceImpact !== undefined &&
          input.iceConfidence !== undefined &&
          input.iceEase !== undefined
        ) {
          return calculateICEScore({
            impact: input.iceImpact,
            confidence: input.iceConfidence,
            ease: input.iceEase,
          });
        }
        break;

      case 'VALUE_EFFORT':
        if (input.valueScore !== undefined && input.effortScore !== undefined) {
          return calculateValueEffortScore({
            value: input.valueScore,
            effort: input.effortScore,
          });
        }
        break;

      case 'CUSTOM':
        // TODO: Implement custom scoring based on customWeights
        break;
    }

    return null;
  }

  async recalculateRankings(engagementId: string): Promise<void> {
    log.info({ engagementId }, 'Recalculating feature rankings');

    const framework = await prisma.featurePrioritization.findUnique({
      where: { engagementId },
      include: { features: true },
    });

    if (!framework) return;

    // Sort by score descending
    const sortedFeatures = framework.features
      .filter((f) => f.score !== null)
      .sort((a, b) => (b.score?.toNumber() || 0) - (a.score?.toNumber() || 0));

    // Update ranks
    await Promise.all(
      sortedFeatures.map((feature, index) =>
        prisma.prioritizedFeature.update({
          where: { id: feature.id },
          data: { rank: index + 1 },
        })
      )
    );

    log.info({ engagementId, rankedCount: sortedFeatures.length }, 'Rankings updated');
  }

  // ==================== Queries ====================

  async getRankedFeatures(
    engagementId: string,
    filters?: { status?: string; tier?: string; category?: string }
  ): Promise<PrioritizedFeature[]> {
    const framework = await prisma.featurePrioritization.findUnique({
      where: { engagementId },
    });

    if (!framework) return [];

    const where: Prisma.PrioritizedFeatureWhereInput = {
      prioritizationId: framework.id,
    };

    if (filters?.status) {
      where.status = filters.status as PrioritizedFeature['status'];
    }
    if (filters?.tier) {
      where.tier = filters.tier;
    }
    if (filters?.category) {
      where.category = filters.category;
    }

    return prisma.prioritizedFeature.findMany({
      where,
      orderBy: { rank: 'asc' },
    });
  }

  async getTopFeatures(engagementId: string, limit: number = 5): Promise<PrioritizedFeature[]> {
    const framework = await prisma.featurePrioritization.findUnique({
      where: { engagementId },
    });

    if (!framework) return [];

    return prisma.prioritizedFeature.findMany({
      where: { prioritizationId: framework.id },
      orderBy: { rank: 'asc' },
      take: limit,
    });
  }

  // ==================== Priority Matrix ====================

  async generatePriorityMatrix(engagementId: string): Promise<PriorityMatrixData> {
    const framework = await this.getFramework(engagementId);

    if (!framework) {
      return {
        quadrants: {
          quickWins: [],
          bigBets: [],
          fillIns: [],
          moneyPits: [],
        },
        framework: 'RICE',
      };
    }

    const features = framework.features;
    const quadrants: PriorityMatrixData['quadrants'] = {
      quickWins: [],
      bigBets: [],
      fillIns: [],
      moneyPits: [],
    };

    for (const feature of features) {
      // Use value/effort if available, otherwise use tier
      if (feature.valueScore !== null && feature.effortScore !== null) {
        const quadrant = getValueEffortQuadrant({
          value: feature.valueScore,
          effort: feature.effortScore,
        });

        switch (quadrant) {
          case 'quick-wins':
            quadrants.quickWins.push(feature);
            break;
          case 'big-bets':
            quadrants.bigBets.push(feature);
            break;
          case 'fill-ins':
            quadrants.fillIns.push(feature);
            break;
          case 'money-pits':
            quadrants.moneyPits.push(feature);
            break;
        }
      } else if (feature.tier) {
        // Fall back to tier-based assignment
        switch (feature.tier) {
          case 'Must Have':
            quadrants.quickWins.push(feature);
            break;
          case 'Should Have':
            quadrants.bigBets.push(feature);
            break;
          case 'Nice to Have':
            quadrants.fillIns.push(feature);
            break;
          default:
            quadrants.moneyPits.push(feature);
        }
      }
    }

    return {
      quadrants,
      framework: framework.framework,
    };
  }

  // ==================== External Sync ====================

  async syncFromExternal(
    engagementId: string,
    features: ExternalFeatureSync[]
  ): Promise<SyncResult> {
    log.info({ engagementId, count: features.length }, 'Syncing features from external source');

    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const externalFeature of features) {
      try {
        // Check if feature already exists
        const existing = await prisma.prioritizedFeature.findFirst({
          where: {
            prioritization: { engagementId },
            externalId: externalFeature.externalId,
            externalSource: externalFeature.source,
          },
          include: { prioritization: true },
        });

        if (existing) {
          // Update existing
          await this.updateFeature(existing.id, {
            title: externalFeature.title,
            description: externalFeature.description,
            externalUrl: externalFeature.url,
          });
          result.updated++;
        } else {
          // Create new
          await this.addFeature(engagementId, {
            title: externalFeature.title,
            description: externalFeature.description,
            externalId: externalFeature.externalId,
            externalSource: externalFeature.source,
            externalUrl: externalFeature.url,
            status: 'BACKLOG',
          });
          result.created++;
        }
      } catch (error) {
        result.errors.push({
          externalId: externalFeature.externalId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    log.info({ engagementId, result }, 'External sync completed');
    return result;
  }

  // ==================== Stats ====================

  async getStats(engagementId: string): Promise<{
    totalFeatures: number;
    scoredFeatures: number;
    byStatus: Record<string, number>;
    byTier: Record<string, number>;
    avgScore: number;
    framework: PrioritizationFramework | null;
  }> {
    const framework = await this.getFramework(engagementId);

    if (!framework) {
      return {
        totalFeatures: 0,
        scoredFeatures: 0,
        byStatus: {},
        byTier: {},
        avgScore: 0,
        framework: null,
      };
    }

    const features = framework.features;

    const byStatus: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    let totalScore = 0;
    let scoredCount = 0;

    for (const feature of features) {
      // By status
      byStatus[feature.status] = (byStatus[feature.status] || 0) + 1;

      // By tier
      if (feature.tier) {
        byTier[feature.tier] = (byTier[feature.tier] || 0) + 1;
      }

      // Score stats
      if (feature.score !== null) {
        totalScore += typeof feature.score === 'number' ? feature.score : Number(feature.score);
        scoredCount++;
      }
    }

    return {
      totalFeatures: features.length,
      scoredFeatures: scoredCount,
      byStatus,
      byTier,
      avgScore: scoredCount > 0 ? totalScore / scoredCount : 0,
      framework: framework.framework,
    };
  }
}

// Singleton instance
export const prioritizationService = new PrioritizationService();
