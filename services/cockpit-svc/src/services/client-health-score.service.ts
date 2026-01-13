/**
 * @module @skillancer/cockpit-svc/services/client-health-score
 * Client Health Score Service - Calculates and manages client relationship health
 */

import { ClientRepository, InteractionRepository } from '../repositories/index.js';

import type { HealthScoreBreakdown } from '../types/crm.types.js';
import type { PrismaClient, Client } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Health score weights
const WEIGHTS = {
  recency: 0.25, // How recently they engaged
  frequency: 0.2, // How often they engage
  monetary: 0.2, // Lifetime value
  satisfaction: 0.2, // Project ratings
  responsiveness: 0.15, // Response times
};

export class ClientHealthScoreService {
  private readonly clientRepository: ClientRepository;
  private readonly interactionRepository: InteractionRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.clientRepository = new ClientRepository(prisma);
    this.interactionRepository = new InteractionRepository(prisma);
  }

  /**
   * Calculate and update health score for a client
   */
  async calculateAndUpdate(clientId: string): Promise<number> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) return 0;

    const score = await this.calculateScore(client);

    await this.clientRepository.update(clientId, {
      healthScore: score,
      healthScoreUpdatedAt: new Date(),
    });

    this.logger.debug(
      {
        clientId,
        score,
      },
      'Health score updated'
    );

    return score;
  }

  /**
   * Calculate health score for a client
   */
  async calculateScore(client: Client): Promise<number> {
    const [recencyScore, frequencyScore, monetaryScore, satisfactionScore, responsivenessScore] =
      await Promise.all([
        Promise.resolve(this.calculateRecencyScore(client)),
        this.calculateFrequencyScore(client),
        Promise.resolve(this.calculateMonetaryScore(client)),
        this.calculateSatisfactionScore(client),
        this.calculateResponsivenessScore(client),
      ]);

    const weightedScore =
      recencyScore * WEIGHTS.recency +
      frequencyScore * WEIGHTS.frequency +
      monetaryScore * WEIGHTS.monetary +
      satisfactionScore * WEIGHTS.satisfaction +
      responsivenessScore * WEIGHTS.responsiveness;

    return Math.round(weightedScore);
  }

  /**
   * Calculate recency score based on last contact
   */
  private calculateRecencyScore(client: Client): number {
    if (!client.lastContactAt) return 0;

    const daysSinceContact = Math.floor(
      (Date.now() - client.lastContactAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Score decreases as days increase
    if (daysSinceContact <= 7) return 100;
    if (daysSinceContact <= 14) return 90;
    if (daysSinceContact <= 30) return 75;
    if (daysSinceContact <= 60) return 50;
    if (daysSinceContact <= 90) return 25;
    return 10;
  }

  /**
   * Calculate frequency score based on interaction count
   */
  private async calculateFrequencyScore(client: Client): Promise<number> {
    // Count interactions in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const interactions = await this.interactionRepository.countByClient(client.id, {
      since: ninetyDaysAgo,
    });

    // More interactions = higher score
    if (interactions >= 20) return 100;
    if (interactions >= 15) return 90;
    if (interactions >= 10) return 75;
    if (interactions >= 5) return 50;
    if (interactions >= 2) return 25;
    return 10;
  }

  /**
   * Calculate monetary score based on lifetime value
   */
  private calculateMonetaryScore(client: Client): number {
    const ltv = Number(client.lifetimeValue || 0);

    // Score based on lifetime value
    if (ltv >= 50000) return 100;
    if (ltv >= 25000) return 90;
    if (ltv >= 10000) return 75;
    if (ltv >= 5000) return 50;
    if (ltv >= 1000) return 25;
    return 10;
  }

  /**
   * Calculate satisfaction score based on ratings
   */
  private async calculateSatisfactionScore(client: Client): Promise<number> {
    if (!client.platformUserId) {
      // No platform data, return neutral score
      return 50;
    }

    // Get ratings from completed contracts via reviews
    const reviews = await this.prisma.review.findMany({
      where: {
        contract: {
          freelancerId: client.freelancerUserId,
          clientId: client.platformUserId,
          status: 'COMPLETED',
        },
      },
      select: {
        overallRating: true,
      },
    });

    if (reviews.length === 0) return 50;

    const ratings = reviews
      .filter((r) => r.overallRating !== null)
      .map((r) => Number(r.overallRating));

    if (ratings.length === 0) return 50;

    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    // Convert 1-5 rating to 0-100 score
    return Math.round((avgRating - 1) * 25);
  }

  /**
   * Calculate responsiveness score based on interaction patterns
   */
  private async calculateResponsivenessScore(client: Client): Promise<number> {
    // Calculate based on interaction patterns
    const { interactions } = await this.interactionRepository.findByClient(client.id, {
      limit: 20,
    });

    if (interactions.length < 2) return 50;

    // Check for positive sentiment and quick follow-ups
    const positiveInteractions = interactions.filter((i) => i.sentiment === 'POSITIVE').length;
    const sentimentScore = (positiveInteractions / interactions.length) * 100;

    return Math.round(sentimentScore);
  }

  /**
   * Get clients that need attention (low health score)
   */
  async getClientsNeedingAttention(freelancerUserId: string) {
    const clients = await this.clientRepository.findByHealthScoreRange(freelancerUserId, 0, 50);

    const results = [];
    for (const client of clients) {
      const breakdown = await this.getHealthScoreBreakdown(client.id);
      results.push({
        id: client.id,
        displayName: this.getClientDisplayName(client),
        healthScore: client.healthScore,
        lastContactAt: client.lastContactAt,
        recommendations: breakdown.recommendations,
      });
    }

    return results;
  }

  /**
   * Get detailed health score breakdown
   */
  async getHealthScoreBreakdown(clientId: string): Promise<HealthScoreBreakdown> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) {
      return {
        overall: 0,
        components: {
          recency: { score: 0, weight: WEIGHTS.recency },
          frequency: { score: 0, weight: WEIGHTS.frequency },
          monetary: { score: 0, weight: WEIGHTS.monetary },
          satisfaction: { score: 0, weight: WEIGHTS.satisfaction },
          responsiveness: { score: 0, weight: WEIGHTS.responsiveness },
        },
        recommendations: ['Client not found'],
      };
    }

    const [recency, frequency, monetary, satisfaction, responsiveness] = await Promise.all([
      Promise.resolve(this.calculateRecencyScore(client)),
      this.calculateFrequencyScore(client),
      Promise.resolve(this.calculateMonetaryScore(client)),
      this.calculateSatisfactionScore(client),
      this.calculateResponsivenessScore(client),
    ]);

    return {
      overall: client.healthScore || 0,
      components: {
        recency: { score: recency, weight: WEIGHTS.recency },
        frequency: { score: frequency, weight: WEIGHTS.frequency },
        monetary: { score: monetary, weight: WEIGHTS.monetary },
        satisfaction: { score: satisfaction, weight: WEIGHTS.satisfaction },
        responsiveness: { score: responsiveness, weight: WEIGHTS.responsiveness },
      },
      recommendations: this.generateRecommendations(
        { recency, frequency, monetary, satisfaction, responsiveness },
        client
      ),
    };
  }

  /**
   * Bulk update health scores for all clients of a freelancer
   */
  async updateAllForFreelancer(freelancerUserId: string): Promise<void> {
    const clients = await this.clientRepository.findByFreelancer(freelancerUserId);

    for (const client of clients) {
      try {
        await this.calculateAndUpdate(client.id);
      } catch (error) {
        this.logger.error(
          {
            clientId: client.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to update health score'
        );
      }
    }

    this.logger.info(
      {
        freelancerUserId,
        count: clients.length,
      },
      'Health scores updated'
    );
  }

  /**
   * Generate recommendations based on scores
   */
  private generateRecommendations(
    scores: Record<string, number | undefined>,
    client: Client
  ): string[] {
    const recommendations: string[] = [];

    if ((scores.recency ?? 0) < 50) {
      recommendations.push('Schedule a check-in call or send a follow-up message');
    }

    if ((scores.frequency ?? 0) < 50) {
      recommendations.push('Increase engagement frequency with regular updates');
    }

    if ((scores.monetary ?? 0) < 50 && client.totalProjects > 0) {
      recommendations.push('Consider upselling additional services');
    }

    if ((scores.satisfaction ?? 0) < 50) {
      recommendations.push('Address any concerns and improve service quality');
    }

    if ((scores.responsiveness ?? 0) < 50) {
      recommendations.push('Focus on positive interactions and quick responses');
    }

    if (client.status === 'INACTIVE') {
      recommendations.push('Reach out to re-engage this dormant client');
    }

    if (recommendations.length === 0) {
      recommendations.push('Keep up the good work! This client relationship is healthy.');
    }

    return recommendations;
  }

  /**
   * Get client display name
   */
  private getClientDisplayName(client: {
    companyName: string | null;
    firstName: string | null;
    lastName: string | null;
  }): string {
    if (client.companyName) {
      return client.companyName;
    }
    const parts = [client.firstName, client.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown Client';
  }
}
