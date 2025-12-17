/**
 * @module @skillancer/market-svc/services/rate-data-collector
 * Rate Data Collection Service - Collects rate data from various sources
 */

import type { RateDataRepository } from '../repositories/rate-data.repository.js';
import type { RateHistoryRepository } from '../repositories/rate-history.repository.js';
import type { RateType, ExperienceLevel } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const SKILL_CATEGORIES: Record<string, string[]> = {
  DEVELOPMENT: ['javascript', 'react', 'python', 'java', 'node.js', 'typescript', 'vue', 'angular'],
  DESIGN: ['ui design', 'ux design', 'graphic design', 'figma', 'sketch', 'adobe'],
  DATA: ['data science', 'machine learning', 'sql', 'tableau', 'power bi', 'ai'],
  MARKETING: ['seo', 'social media', 'content marketing', 'google ads', 'facebook ads'],
  WRITING: ['copywriting', 'content writing', 'technical writing', 'editing'],
  MOBILE: ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
};

const REGION_MAP: Record<string, string> = {
  US: 'US',
  CA: 'US',
  GB: 'EU',
  DE: 'EU',
  FR: 'EU',
  NL: 'EU',
  ES: 'EU',
  IT: 'EU',
  IN: 'ASIA',
  PH: 'ASIA',
  PK: 'ASIA',
  BD: 'ASIA',
  AU: 'OCEANIA',
  NZ: 'OCEANIA',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getSkillCategory(skill: string): string {
  const normalizedSkill = skill.toLowerCase();
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.some((s) => normalizedSkill.includes(s) || s.includes(normalizedSkill))) {
      return category;
    }
  }
  return 'OTHER';
}

function getRegion(country: string | null | undefined): string {
  if (!country) return 'GLOBAL';
  return REGION_MAP[country] ?? 'GLOBAL';
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface ContractData {
  id: string;
  rateType: RateType;
  rate: number;
  totalAmount: number;
  estimatedDurationDays?: number | null;
  freelancerUserId: string;
  clientUserId: string;
  createdAt: Date;
  project: {
    requiredSkills: string[];
    complianceRequirements?: string[] | null;
  };
  freelancer: {
    experienceLevel?: ExperienceLevel | null;
    user: {
      country?: string | null;
    };
  };
  client?: {
    country?: string | null;
  } | null;
}

export interface BidData {
  id: string;
  bidType: RateType;
  proposedRate: number;
  proposedTimeline: number;
  freelancerUserId: string;
  createdAt: Date;
  project: {
    clientUserId: string;
    requiredSkills: string[];
    complianceRequirements?: string[] | null;
    client?: {
      country?: string | null;
    } | null;
  };
  freelancer: {
    experienceLevel?: ExperienceLevel | null;
    user: {
      country?: string | null;
    };
  };
}

export interface ServiceOrderData {
  id: string;
  total: number;
  deliveryDays: number;
  sellerUserId: string;
  buyerUserId: string;
  status: string;
  completedAt?: Date | null;
  createdAt: Date;
  service: {
    skills: string[];
    category: string;
  };
  seller: {
    experienceLevel?: ExperienceLevel | null;
    country?: string | null;
  };
  buyer: {
    country?: string | null;
  };
  review?: {
    overallRating?: number | null;
  } | null;
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

export interface RateDataCollectorDeps {
  rateDataRepository: RateDataRepository;
  rateHistoryRepository: RateHistoryRepository;
  logger: Logger;
}

/**
 * Calculate effective hourly rate from contract data
 */
function calculateEffectiveHourlyRateFromContract(contract: ContractData): number {
  if (contract.rateType === 'HOURLY') {
    return contract.rate;
  }

  // For fixed rate, estimate based on duration (assume 6 hours/day)
  const estimatedHours = (contract.estimatedDurationDays ?? 30) * 6;
  return contract.totalAmount / Math.max(estimatedHours, 1);
}

/**
 * Calculate effective hourly rate from bid data
 */
function calculateEffectiveHourlyRateFromBid(bid: BidData): number {
  if (bid.bidType === 'HOURLY') {
    return bid.proposedRate;
  }

  // For fixed rate, estimate based on timeline (assume 6 hours/day)
  const estimatedHours = bid.proposedTimeline * 6;
  return bid.proposedRate / Math.max(estimatedHours, 1);
}

/**
 * Estimate hourly rate from service order
 */
function estimateHourlyRateFromServiceOrder(order: ServiceOrderData): number {
  // Assume 5 hours of work per delivery day
  const estimatedHours = order.deliveryDays * 5;
  return order.total / Math.max(estimatedHours, 1);
}

export function createRateDataCollectorService(deps: RateDataCollectorDeps) {
  const { rateDataRepository, rateHistoryRepository, logger } = deps;

  /**
   * Collect rate data from a contract
   */
  async function collectFromContract(contract: ContractData): Promise<void> {
    try {
      const primarySkill = contract.project.requiredSkills[0] ?? 'general';
      const effectiveHourlyRate = calculateEffectiveHourlyRateFromContract(contract);

      await rateDataRepository.create({
        sourceType: 'CONTRACT',
        sourceId: contract.id,
        primarySkill,
        secondarySkills: contract.project.requiredSkills.slice(1),
        skillCategory: getSkillCategory(primarySkill),
        rateType: contract.rateType,
        hourlyRate: contract.rateType === 'HOURLY' ? contract.rate : null,
        fixedRate: contract.rateType === 'FIXED' ? contract.totalAmount : null,
        projectDurationDays: contract.estimatedDurationDays,
        effectiveHourlyRate,
        experienceLevel: contract.freelancer.experienceLevel ?? 'INTERMEDIATE',
        freelancerUserId: contract.freelancerUserId,
        clientUserId: contract.clientUserId,
        freelancerCountry: contract.freelancer.user.country,
        freelancerRegion: getRegion(contract.freelancer.user.country),
        clientCountry: contract.client?.country,
        wasAccepted: true,
        complianceRequired: contract.project.complianceRequirements ?? [],
        hasCompliancePremium: (contract.project.complianceRequirements ?? []).length > 0,
        occurredAt: contract.createdAt,
      });

      logger.info({ msg: 'Collected rate data from contract', contractId: contract.id });
    } catch (error) {
      logger.error({
        msg: 'Failed to collect rate data from contract',
        contractId: contract.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Collect rate data from a bid
   */
  async function collectFromBid(bid: BidData): Promise<void> {
    try {
      const primarySkill = bid.project.requiredSkills[0] ?? 'general';
      const effectiveHourlyRate = calculateEffectiveHourlyRateFromBid(bid);

      await rateDataRepository.create({
        sourceType: 'BID',
        sourceId: bid.id,
        primarySkill,
        secondarySkills: bid.project.requiredSkills.slice(1),
        skillCategory: getSkillCategory(primarySkill),
        rateType: bid.bidType,
        hourlyRate: bid.bidType === 'HOURLY' ? bid.proposedRate : null,
        fixedRate: bid.bidType === 'FIXED' ? bid.proposedRate : null,
        projectDurationDays: bid.proposedTimeline,
        effectiveHourlyRate,
        experienceLevel: bid.freelancer.experienceLevel ?? 'INTERMEDIATE',
        freelancerUserId: bid.freelancerUserId,
        clientUserId: bid.project.clientUserId,
        freelancerCountry: bid.freelancer.user.country,
        freelancerRegion: getRegion(bid.freelancer.user.country),
        clientCountry: bid.project.client?.country,
        wasAccepted: false, // Will be updated when bid is accepted
        complianceRequired: bid.project.complianceRequirements ?? [],
        hasCompliancePremium: (bid.project.complianceRequirements ?? []).length > 0,
        occurredAt: bid.createdAt,
      });

      logger.info({ msg: 'Collected rate data from bid', bidId: bid.id });
    } catch (error) {
      logger.error({
        msg: 'Failed to collect rate data from bid',
        bidId: bid.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update bid acceptance status
   */
  async function updateBidAccepted(bidId: string): Promise<void> {
    try {
      const dataPoint = await rateDataRepository.findBySource('BID', bidId);
      if (dataPoint) {
        await rateDataRepository.update(dataPoint.id, {
          wasAccepted: true,
        });
        logger.info({ msg: 'Updated bid acceptance status', bidId });
      }
    } catch (error) {
      logger.error({
        msg: 'Failed to update bid acceptance status',
        bidId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update project completion status
   */
  async function updateProjectCompleted(contractId: string, clientRating?: number): Promise<void> {
    try {
      const dataPoint = await rateDataRepository.findBySource('CONTRACT', contractId);
      if (dataPoint) {
        await rateDataRepository.update(dataPoint.id, {
          projectCompleted: true,
          ...(clientRating !== undefined && { clientRating }),
        });
        logger.info({ msg: 'Updated project completion status', contractId });
      }
    } catch (error) {
      logger.error({
        msg: 'Failed to update project completion status',
        contractId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Collect rate data from a service order
   */
  async function collectFromServiceOrder(order: ServiceOrderData): Promise<void> {
    if (order.status !== 'COMPLETED') {
      return;
    }

    try {
      const primarySkill = order.service.skills[0] ?? order.service.category;
      const effectiveHourlyRate = estimateHourlyRateFromServiceOrder(order);

      await rateDataRepository.create({
        sourceType: 'SERVICE_ORDER',
        sourceId: order.id,
        primarySkill,
        secondarySkills: order.service.skills.slice(1),
        skillCategory: order.service.category,
        rateType: 'FIXED',
        fixedRate: order.total,
        projectDurationDays: order.deliveryDays,
        effectiveHourlyRate,
        experienceLevel: order.seller.experienceLevel ?? 'INTERMEDIATE',
        freelancerUserId: order.sellerUserId,
        clientUserId: order.buyerUserId,
        freelancerCountry: order.seller.country,
        freelancerRegion: getRegion(order.seller.country),
        clientCountry: order.buyer.country,
        wasAccepted: true,
        projectCompleted: true,
        clientRating: order.review?.overallRating ?? null,
        complianceRequired: [],
        hasCompliancePremium: false,
        occurredAt: order.completedAt ?? order.createdAt,
      });

      logger.info({ msg: 'Collected rate data from service order', orderId: order.id });
    } catch (error) {
      logger.error({
        msg: 'Failed to collect rate data from service order',
        orderId: order.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Record a rate change for a freelancer
   */
  async function recordRateChange(params: {
    userId: string;
    previousRate: number | null;
    newRate: number;
    reason:
      | 'MARKET_ADJUSTMENT'
      | 'EXPERIENCE_INCREASE'
      | 'SKILL_ADDITION'
      | 'DEMAND_BASED'
      | 'RECOMMENDATION_FOLLOWED'
      | 'MANUAL_CHANGE';
    marketPosition?: string;
    percentile?: number;
  }): Promise<void> {
    try {
      await rateHistoryRepository.create({
        userId: params.userId,
        previousHourlyRate: params.previousRate,
        newHourlyRate: params.newRate,
        changeReason: params.reason,
        marketPosition: params.marketPosition,
        percentileAtChange: params.percentile,
        changedAt: new Date(),
      });

      logger.info({
        msg: 'Recorded rate change',
        userId: params.userId,
        previousRate: params.previousRate,
        newRate: params.newRate,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to record rate change',
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Collect rate data from profile rate setting
   */
  async function collectFromProfileRate(params: {
    userId: string;
    hourlyRate: number;
    skills: string[];
    experienceLevel: ExperienceLevel;
    country?: string | null;
  }): Promise<void> {
    try {
      const primarySkill = params.skills[0] ?? 'general';

      await rateDataRepository.create({
        sourceType: 'PROFILE_RATE',
        sourceId: params.userId,
        primarySkill,
        secondarySkills: params.skills.slice(1),
        skillCategory: getSkillCategory(primarySkill),
        rateType: 'HOURLY',
        hourlyRate: params.hourlyRate,
        effectiveHourlyRate: params.hourlyRate,
        experienceLevel: params.experienceLevel,
        freelancerUserId: params.userId,
        clientUserId: params.userId, // Self-reference for profile rates
        freelancerCountry: params.country,
        freelancerRegion: getRegion(params.country),
        wasAccepted: true, // Profile rates are considered "accepted"
        complianceRequired: [],
        hasCompliancePremium: false,
        occurredAt: new Date(),
      });

      logger.info({ msg: 'Collected rate data from profile', userId: params.userId });
    } catch (error) {
      logger.error({
        msg: 'Failed to collect rate data from profile',
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    collectFromContract,
    collectFromBid,
    updateBidAccepted,
    updateProjectCompleted,
    collectFromServiceOrder,
    recordRateChange,
    collectFromProfileRate,
  };
}

export type RateDataCollectorService = ReturnType<typeof createRateDataCollectorService>;
