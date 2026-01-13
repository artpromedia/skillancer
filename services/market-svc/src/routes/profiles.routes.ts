// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
/**
 * Profiles Routes - Sprint 13: Profile Integration & Endorsements
 *
 * Provides endpoints for:
 * - Trust score calculation
 * - Endorsements management
 * - Recommendations management
 * - Verified skills showcase
 * - Learning activity tracking
 * - Compliance certifications
 */

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

interface ProfileDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Types
// ============================================================================

interface ProfileParams {
  userId: string;
}

interface EndorsementBody {
  skillId: string;
  skillName: string;
  relationship: 'client' | 'colleague' | 'manager' | 'mentor' | 'collaborator' | 'other';
  endorsementText?: string;
  projectId?: string;
}

interface EndorsementRequestBody {
  skillName: string;
  message?: string;
  targetUserId: string;
}

interface RecommendationBody {
  recipientId: string;
  relationship: string;
  duration: string;
  text: string;
  skillsHighlighted?: string[];
}

// ============================================================================
// Route Handler
// ============================================================================

export function registerProfileRoutes(fastify: FastifyInstance, deps: ProfileDependencies): void {
  const { logger } = deps;

  // --------------------------------------------------------------------------
  // Trust Score
  // --------------------------------------------------------------------------

  /**
   * GET /profiles/:userId/trust-score
   * Get comprehensive trust score with all factors
   */
  fastify.get<{ Params: ProfileParams }>(
    '/:userId/trust-score',
    async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      logger.info({ userId }, 'Fetching trust score');

      try {
        // Calculate trust score from various factors
        const trustScore = await calculateTrustScore(deps, userId);
        return await reply.send(trustScore);
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch trust score');
        return await reply.status(500).send({ error: 'Failed to fetch trust score' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Endorsements
  // --------------------------------------------------------------------------

  /**
   * GET /profiles/:userId/endorsements
   * Get endorsements for a user
   */
  fastify.get<{ Params: ProfileParams }>(
    '/:userId/endorsements',
    async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      logger.info({ userId }, 'Fetching endorsements');

      try {
        const endorsements = await getEndorsements(deps, userId);
        return await reply.send(endorsements);
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch endorsements');
        return await reply.status(500).send({ error: 'Failed to fetch endorsements' });
      }
    }
  );

  /**
   * POST /profiles/:userId/endorsements
   * Give an endorsement
   */
  fastify.post<{ Params: ProfileParams; Body: EndorsementBody }>(
    '/:userId/endorsements',
    async (
      request: FastifyRequest<{ Params: ProfileParams; Body: EndorsementBody }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const endorsement = request.body;
      const endorserId = (request.user as { id: string })?.id;

      if (!endorserId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      logger.info({ userId, endorserId }, 'Creating endorsement');

      try {
        const result = await createEndorsement(deps, endorserId, userId, endorsement);
        return await reply.status(201).send(result);
      } catch (error) {
        logger.error({ error, userId, endorserId }, 'Failed to create endorsement');
        return await reply.status(500).send({ error: 'Failed to create endorsement' });
      }
    }
  );

  /**
   * POST /endorsements/request
   * Request an endorsement
   */
  fastify.post<{ Body: EndorsementRequestBody }>(
    '/endorsements/request',
    async (request: FastifyRequest<{ Body: EndorsementRequestBody }>, reply: FastifyReply) => {
      const requestData = request.body;
      const requesterId = (request.user as { id: string })?.id;

      if (!requesterId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      logger.info(
        { requesterId, targetUserId: requestData.targetUserId },
        'Requesting endorsement'
      );

      try {
        const result = await requestEndorsement(deps, requesterId, requestData);
        return await reply.status(201).send(result);
      } catch (error) {
        logger.error({ error, requesterId }, 'Failed to request endorsement');
        return await reply.status(500).send({ error: 'Failed to request endorsement' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Recommendations
  // --------------------------------------------------------------------------

  /**
   * GET /profiles/:userId/recommendations
   * Get recommendations for a user
   */
  fastify.get<{ Params: ProfileParams }>(
    '/:userId/recommendations',
    async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      logger.info({ userId }, 'Fetching recommendations');

      try {
        const recommendations = await getRecommendations(deps, userId);
        return await reply.send(recommendations);
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch recommendations');
        return await reply.status(500).send({ error: 'Failed to fetch recommendations' });
      }
    }
  );

  /**
   * POST /recommendations
   * Write a recommendation
   */
  fastify.post<{ Body: RecommendationBody }>(
    '/recommendations',
    async (request: FastifyRequest<{ Body: RecommendationBody }>, reply: FastifyReply) => {
      const recommendationData = request.body;
      const recommenderId = (request.user as { id: string })?.id;

      if (!recommenderId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      logger.info(
        { recommenderId, recipientId: recommendationData.recipientId },
        'Writing recommendation'
      );

      try {
        const result = await createRecommendation(deps, recommenderId, recommendationData);
        return await reply.status(201).send(result);
      } catch (error) {
        logger.error({ error, recommenderId }, 'Failed to create recommendation');
        return await reply.status(500).send({ error: 'Failed to create recommendation' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Verified Skills
  // --------------------------------------------------------------------------

  /**
   * GET /profiles/:userId/verified-skills
   * Get verified skills with tier information
   */
  fastify.get<{ Params: ProfileParams }>(
    '/:userId/verified-skills',
    async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      logger.info({ userId }, 'Fetching verified skills');

      try {
        const skills = await getVerifiedSkills(deps, userId);
        return await reply.send(skills);
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch verified skills');
        return await reply.status(500).send({ error: 'Failed to fetch verified skills' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Learning Activity
  // --------------------------------------------------------------------------

  /**
   * GET /profiles/:userId/learning-activity
   * Get learning activity for a user
   */
  fastify.get<{ Params: ProfileParams }>(
    '/:userId/learning-activity',
    async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      logger.info({ userId }, 'Fetching learning activity');

      try {
        const activity = await getLearningActivity(deps, userId);
        return await reply.send(activity);
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch learning activity');
        return await reply.status(500).send({ error: 'Failed to fetch learning activity' });
      }
    }
  );

  // --------------------------------------------------------------------------
  // Compliance
  // --------------------------------------------------------------------------

  /**
   * GET /profiles/:userId/compliance
   * Get compliance certifications and clearances
   */
  fastify.get<{ Params: ProfileParams }>(
    '/:userId/compliance',
    async (request: FastifyRequest<{ Params: ProfileParams }>, reply: FastifyReply) => {
      const { userId } = request.params;
      logger.info({ userId }, 'Fetching compliance data');

      try {
        const compliance = getComplianceData(deps, userId);
        return await reply.send(compliance);
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch compliance data');
        return await reply.status(500).send({ error: 'Failed to fetch compliance data' });
      }
    }
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

async function calculateTrustScore(deps: ProfileDependencies, userId: string) {
  const { prisma } = deps;

  // Fetch user data for trust score calculation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      freelancerProfile: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate trust factors
  const factors = [
    {
      id: 'identity',
      name: 'Identity Verification',
      score: user.emailVerified ? 20 : 0,
      maxScore: 25,
      status: user.emailVerified ? ('verified' as const) : ('unverified' as const),
      description: 'Government ID and identity verification',
    },
    {
      id: 'skills',
      name: 'Skills Verification',
      score: 15, // Would calculate from actual assessments
      maxScore: 25,
      status: 'partial' as const,
      description: 'Skills verified through assessments',
    },
    {
      id: 'track-record',
      name: 'Track Record',
      score: 18, // Would calculate from job success rate
      maxScore: 25,
      status: 'verified' as const,
      description: 'Completion rate and client satisfaction',
    },
    {
      id: 'endorsements',
      name: 'Peer Endorsements',
      score: 12, // Would calculate from endorsement count
      maxScore: 25,
      status: 'partial' as const,
      description: 'Professional endorsements from clients and peers',
    },
  ];

  const overallScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxPossible = factors.reduce((sum, f) => sum + f.maxScore, 0);

  return {
    overallScore: Math.round((overallScore / maxPossible) * 100),
    factors,
    badges: [],
    averageScore: 72, // Platform average
    lastUpdated: new Date().toISOString(),
  };
}

async function getEndorsements(deps: ProfileDependencies, userId: string) {
  const { prisma } = deps;

  // Fetch endorsements from database
  const endorsements = await prisma.skillEndorsement.findMany({
    where: { endorseeId: userId, isVisible: true },
    include: {
      endorser: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          freelancerProfile: {
            select: { title: true },
          },
        },
      },
      skill: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by skill
  const skillSummaries = endorsements.reduce(
    (acc, e) => {
      const existing = acc.find((s) => s.skillId === e.skillId);
      if (existing) {
        existing.totalEndorsements++;
        if (existing.topEndorsers.length < 3) {
          existing.topEndorsers.push({
            id: e.endorser.id,
            name: e.endorser.displayName ?? 'Anonymous',
            avatar: e.endorser.avatarUrl ?? undefined,
            title: e.endorser.freelancerProfile?.title ?? undefined,
          });
        }
      } else {
        acc.push({
          skillId: e.skillId,
          skillName: e.skill?.name ?? 'Unknown',
          category: e.skill?.category ?? 'General',
          totalEndorsements: 1,
          topEndorsers: [
            {
              id: e.endorser.id,
              name: e.endorser.displayName ?? 'Anonymous',
              avatar: e.endorser.avatarUrl ?? undefined,
              title: e.endorser.freelancerProfile?.title ?? undefined,
            },
          ],
        });
      }
      return acc;
    },
    [] as Array<{
      skillId: string;
      skillName: string;
      category: string;
      totalEndorsements: number;
      topEndorsers: Array<{ id: string; name: string; avatar?: string; title?: string }>;
    }>
  );

  return {
    endorsements: endorsements.map((e) => ({
      id: e.id,
      skill: {
        id: e.skillId,
        name: e.skill?.name ?? 'Unknown',
        category: e.skill?.category ?? 'General',
      },
      endorser: {
        id: e.endorser.id,
        name: e.endorser.displayName ?? 'Anonymous',
        avatar: e.endorser.avatarUrl ?? undefined,
        title: e.endorser.freelancerProfile?.title ?? undefined,
      },
      relationship: e.relationship,
      endorsementText: e.testimonial ?? undefined,
      createdAt: e.createdAt.toISOString(),
      featured: e.isFeatured,
    })),
    skillSummaries,
    totalEndorsements: endorsements.length,
  };
}

async function createEndorsement(
  deps: ProfileDependencies,
  endorserId: string,
  endorseeId: string,
  data: EndorsementBody
) {
  const { prisma } = deps;

  const endorsement = await prisma.skillEndorsement.create({
    data: {
      endorserId,
      endorseeId,
      skillId: data.skillId,
      relationship: data.relationship,
      testimonial: data.endorsementText,
      projectId: data.projectId,
      isVisible: true,
      isFeatured: false,
    },
  });

  return endorsement;
}

async function requestEndorsement(
  deps: ProfileDependencies,
  requesterId: string,
  data: EndorsementRequestBody
) {
  const { prisma } = deps;

  const request = await prisma.endorsementRequest.create({
    data: {
      requesterId,
      targetUserId: data.targetUserId,
      skillName: data.skillName,
      message: data.message,
      status: 'PENDING',
    },
  });

  return request;
}

async function getRecommendations(deps: ProfileDependencies, userId: string) {
  const { prisma } = deps;

  const recommendations = await prisma.recommendation.findMany({
    where: { recipientId: userId, status: 'DISPLAYED' },
    include: {
      recommender: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          freelancerProfile: {
            select: { title: true },
          },
        },
      },
    },
    orderBy: { displayOrder: 'asc' },
  });

  return recommendations.map((r) => ({
    id: r.id,
    recommender: {
      id: r.recommender.id,
      name: r.recommender.displayName ?? 'Anonymous',
      title: r.recommender.freelancerProfile?.title ?? '',
      avatar: r.recommender.avatarUrl ?? undefined,
    },
    relationship: r.relationship,
    duration: r.duration,
    text: r.text,
    skillsMentioned: r.skillsHighlighted,
    date: r.createdAt.toISOString(),
  }));
}

async function createRecommendation(
  deps: ProfileDependencies,
  recommenderId: string,
  data: RecommendationBody
) {
  const { prisma } = deps;

  const recommendation = await prisma.recommendation.create({
    data: {
      recommenderId,
      recipientId: data.recipientId,
      relationship: data.relationship,
      duration: data.duration,
      text: data.text,
      skillsHighlighted: data.skillsHighlighted ?? [],
      status: 'PENDING',
    },
  });

  return recommendation;
}

async function getVerifiedSkills(deps: ProfileDependencies, userId: string) {
  const { prisma } = deps;

  const userSkills = await prisma.userSkill.findMany({
    where: { userId },
    include: {
      skill: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { proficiencyLevel: 'desc' }],
  });

  return userSkills.map((us) => ({
    id: us.id,
    name: us.skill.name,
    category: us.skill.category ?? 'General',
    proficiencyLevel: getProficiencyNumber(us.proficiencyLevel),
    yearsOfExperience: us.yearsOfExperience,
    verificationTier: getVerificationTier(us),
    assessmentScore: us.assessmentScore ?? undefined,
    endorsementCount: us.endorsementCount,
    credentialId: us.credentialId ?? undefined,
    isPrimary: us.isPrimary,
  }));
}

function getProficiencyNumber(level: string): number {
  const levels: Record<string, number> = {
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3,
    EXPERT: 4,
  };
  return levels[level] ?? 1;
}

function getVerificationTier(skill: {
  isVerified: boolean;
  assessmentScore: number | null;
  endorsementCount: number;
  credentialId: string | null;
}): string {
  if (skill.credentialId) return 'certified';
  if (skill.assessmentScore && skill.assessmentScore >= 70) return 'assessed';
  if (skill.endorsementCount >= 3) return 'endorsed';
  if (skill.isVerified) return 'self-assessed';
  return 'unverified';
}

async function getLearningActivity(deps: ProfileDependencies, userId: string) {
  const { prisma } = deps;

  // Fetch recent learning completions
  const credentials = await prisma.userCredential.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
    take: 5,
  });

  const getCredentialType = (type: string): 'assessment' | 'certification' | 'course' => {
    if (type === 'ASSESSMENT') return 'assessment';
    if (type === 'CERTIFICATION') return 'certification';
    return 'course';
  };

  const recentCompletions = credentials.map((c) => ({
    id: c.id,
    title: c.title,
    type: getCredentialType(c.type),
    completedAt: c.earnedAt.toISOString(),
  }));

  // Calculate learning streak (simplified)
  const firstCredential = credentials[0];
  const isActiveLearner =
    credentials.length > 0 &&
    firstCredential !== undefined &&
    Date.now() - new Date(firstCredential.earnedAt ?? 0).getTime() < 30 * 24 * 60 * 60 * 1000;

  return {
    isActiveLearner,
    learningStreak: isActiveLearner ? 7 : 0, // Would calculate actual streak
    recentCompletions,
    skillUpdates: [],
    lastActivityAt: firstCredential?.earnedAt?.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getComplianceData(_deps: ProfileDependencies, _userId: string) {
  // Fetch compliance certifications (if table exists)
  // For now, return empty data
  return {
    certifications: [],
    clearances: [],
  };
}

