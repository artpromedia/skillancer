// @ts-nocheck
/**
 * @module @skillancer/auth-svc/routes/skills-verification
 * Skills Verification Routes
 *
 * Endpoints for:
 * - Getting available skill assessments
 * - Starting skill assessments
 * - Getting skill verification status
 * - Requesting peer endorsements
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const logger = createLogger({ serviceName: 'skills-verification' });

// =============================================================================
// SCHEMAS
// =============================================================================

const getAssessmentsQuerySchema = z.object({
  skillId: z.string().uuid().optional(),
  category: z.string().optional(),
});

const startAssessmentSchema = z.object({
  skillId: z.string().uuid(),
  assessmentType: z.enum(['QUICK', 'STANDARD', 'COMPREHENSIVE']).default('STANDARD'),
  proctored: z.boolean().default(false),
});

const submitAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.union([z.string(), z.number(), z.array(z.string())]),
      timeSpent: z.number().int().positive(), // seconds
    })
  ),
});

const requestEndorsementSchema = z.object({
  skillId: z.string().uuid(),
  endorserEmail: z.string().email(),
  message: z.string().max(500).optional(),
  relationshipType: z.enum(['COLLEAGUE', 'MANAGER', 'CLIENT', 'MENTOR', 'OTHER']),
});

const skillIdParamSchema = z.object({
  skillId: z.string().uuid(),
});

// =============================================================================
// TYPES
// =============================================================================

interface SkillAssessmentResult {
  id: string;
  skillId: string;
  skillName: string;
  score: number;
  maxScore: number;
  percentile: number | null;
  proficiencyLevel: string;
  verifiedAt: string;
  validUntil: string | null;
  proctored: boolean;
  questionBreakdown: Record<string, { correct: number; total: number }>;
}

interface SkillVerificationStatus {
  skillId: string;
  skillName: string;
  category: string;
  currentLevel: string | null;
  verifications: {
    type: string;
    score: number | null;
    verifiedAt: string;
    validUntil: string | null;
    isActive: boolean;
  }[];
  endorsements: {
    endorserId: string;
    endorserName: string;
    endorserTitle: string | null;
    relationshipType: string;
    endorsedAt: string;
    message: string | null;
  }[];
  assessmentAvailable: boolean;
  nextAssessmentAvailableAt: string | null;
}

// =============================================================================
// ROUTES
// =============================================================================

const skillsVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET VERIFIED SKILLS STATUS
  // ===========================================================================

  /**
   * GET /skills-verification/status
   * Get user's skills verification status
   */
  fastify.get(
    '/status',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Get user's skills with verification data
      const verifiedSkills = await prisma.skillVerification.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          skill: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { verifiedAt: 'desc' },
      });

      // Get pending endorsement requests
      const pendingEndorsements = await prisma.endorsementRequest.findMany({
        where: {
          requesterId: userId,
          status: 'PENDING',
        },
        select: {
          id: true,
          skillId: true,
          endorserEmail: true,
          createdAt: true,
        },
      });

      // Group by skill
      const skillsMap = new Map<string, SkillVerificationStatus>();

      for (const verification of verifiedSkills) {
        const skillId = verification.skillId;
        if (!skillsMap.has(skillId)) {
          skillsMap.set(skillId, {
            skillId,
            skillName: verification.skill.name,
            category: verification.skill.category || 'General',
            currentLevel: null,
            verifications: [],
            endorsements: [],
            assessmentAvailable: true,
            nextAssessmentAvailableAt: null,
          });
        }

        const skillStatus = skillsMap.get(skillId)!;
        skillStatus.verifications.push({
          type: verification.verificationType,
          score: verification.score ? Number(verification.score) : null,
          verifiedAt: verification.verifiedAt.toISOString(),
          validUntil: verification.validUntil?.toISOString() ?? null,
          isActive: verification.isActive,
        });

        // Set current level to highest verified level
        if (
          !skillStatus.currentLevel ||
          getLevelPriority(verification.proficiencyLevel) >
            getLevelPriority(skillStatus.currentLevel)
        ) {
          skillStatus.currentLevel = verification.proficiencyLevel;
        }
      }

      // Get endorsements
      const endorsements = await prisma.skillEndorsement.findMany({
        where: {
          endorsedUserId: userId,
        },
        include: {
          endorser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          skill: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      for (const endorsement of endorsements) {
        const skillId = endorsement.skillId;
        if (!skillsMap.has(skillId)) {
          skillsMap.set(skillId, {
            skillId,
            skillName: endorsement.skill.name,
            category: 'General',
            currentLevel: null,
            verifications: [],
            endorsements: [],
            assessmentAvailable: true,
            nextAssessmentAvailableAt: null,
          });
        }

        skillsMap.get(skillId)!.endorsements.push({
          endorserId: endorsement.endorser.id,
          endorserName: `${endorsement.endorser.firstName} ${endorsement.endorser.lastName}`,
          endorserTitle: null,
          relationshipType: endorsement.relationshipType || 'COLLEAGUE',
          endorsedAt: endorsement.createdAt.toISOString(),
          message: endorsement.message,
        });
      }

      // Calculate summary
      const totalVerified = verifiedSkills.length;
      const assessmentVerified = verifiedSkills.filter(
        (v) => v.verificationType === 'ASSESSMENT'
      ).length;
      const endorsementCount = endorsements.length;

      return reply.send({
        summary: {
          totalVerifiedSkills: totalVerified,
          assessmentVerified,
          endorsementCount,
          pendingEndorsementRequests: pendingEndorsements.length,
        },
        skills: Array.from(skillsMap.values()),
        pendingEndorsements: pendingEndorsements.map((pe) => ({
          id: pe.id,
          skillId: pe.skillId,
          endorserEmail: pe.endorserEmail,
          requestedAt: pe.createdAt.toISOString(),
        })),
      });
    }
  );

  // ===========================================================================
  // GET AVAILABLE ASSESSMENTS
  // ===========================================================================

  /**
   * GET /skills-verification/assessments
   * Get available skill assessments
   */
  fastify.get(
    '/assessments',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = getAssessmentsQuerySchema.parse(request.query ?? {});

      // Get available skills with assessments
      const skillsQuery: Record<string, unknown> = {
        where: {
          isActive: true,
          hasAssessment: true,
        },
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          assessmentConfig: true,
        },
        orderBy: { name: 'asc' },
      };

      if (query.skillId) {
        skillsQuery.where = { ...skillsQuery.where, id: query.skillId };
      }
      if (query.category) {
        skillsQuery.where = { ...skillsQuery.where, category: query.category };
      }

      const skills = await prisma.skill.findMany(skillsQuery);

      // For each skill, check user's previous attempts
      const userId = request.user!.id;
      const userVerifications = await prisma.skillVerification.findMany({
        where: {
          userId,
          skillId: { in: skills.map((s) => s.id) },
          verificationType: 'ASSESSMENT',
        },
        orderBy: { verifiedAt: 'desc' },
      });

      const verificationMap = new Map(userVerifications.map((v) => [v.skillId, v]));

      const assessments = skills.map((skill) => {
        const lastVerification = verificationMap.get(skill.id);
        const config = (skill.assessmentConfig as Record<string, unknown>) || {};

        // Check cooldown period (24 hours by default)
        const cooldownHours = (config.cooldownHours as number) || 24;
        const canRetake =
          !lastVerification ||
          new Date(lastVerification.verifiedAt).getTime() + cooldownHours * 60 * 60 * 1000 <
            Date.now();

        return {
          skillId: skill.id,
          skillName: skill.name,
          category: skill.category || 'General',
          description: skill.description,
          assessmentTypes: [
            {
              type: 'QUICK',
              duration: 15,
              questions: 15,
              description: 'Quick assessment for basic proficiency',
            },
            {
              type: 'STANDARD',
              duration: 30,
              questions: 30,
              description: 'Standard assessment for intermediate proficiency',
            },
            {
              type: 'COMPREHENSIVE',
              duration: 60,
              questions: 50,
              description: 'Comprehensive assessment for expert proficiency',
            },
          ],
          proctoredAvailable: Boolean(config.proctoredAvailable),
          lastAttempt: lastVerification
            ? {
                score: Number(lastVerification.score),
                maxScore: Number(lastVerification.maxScore),
                proficiencyLevel: lastVerification.proficiencyLevel,
                verifiedAt: lastVerification.verifiedAt.toISOString(),
              }
            : null,
          canRetake,
          nextAttemptAt: canRetake
            ? null
            : new Date(
                lastVerification.verifiedAt.getTime() + cooldownHours * 60 * 60 * 1000
              ).toISOString(),
        };
      });

      return reply.send({
        assessments,
        categories: [...new Set(skills.map((s) => s.category).filter(Boolean))],
      });
    }
  );

  // ===========================================================================
  // START ASSESSMENT
  // ===========================================================================

  /**
   * POST /skills-verification/assessments/start
   * Start a new skill assessment
   */
  fastify.post(
    '/assessments/start',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = startAssessmentSchema.parse(request.body);

      // Verify skill exists and has assessment
      const skill = await prisma.skill.findUnique({
        where: { id: body.skillId },
      });

      if (!skill) {
        return reply.status(404).send({ error: 'Skill not found' });
      }

      if (!skill.hasAssessment) {
        return reply.status(400).send({ error: 'No assessment available for this skill' });
      }

      // Check cooldown
      const lastAttempt = await prisma.skillVerification.findFirst({
        where: {
          userId,
          skillId: body.skillId,
          verificationType: 'ASSESSMENT',
        },
        orderBy: { verifiedAt: 'desc' },
      });

      const config = (skill.assessmentConfig as Record<string, unknown>) || {};
      const cooldownHours = (config.cooldownHours as number) || 24;

      if (
        lastAttempt &&
        lastAttempt.verifiedAt.getTime() + cooldownHours * 60 * 60 * 1000 > Date.now()
      ) {
        return reply.status(429).send({
          error: 'COOLDOWN',
          message: 'Please wait before attempting this assessment again',
          nextAttemptAt: new Date(
            lastAttempt.verifiedAt.getTime() + cooldownHours * 60 * 60 * 1000
          ).toISOString(),
        });
      }

      // Create assessment session
      const assessment = await prisma.skillAssessmentSession.create({
        data: {
          userId,
          skillId: body.skillId,
          assessmentType: body.assessmentType,
          proctored: body.proctored,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + getAssessmentDuration(body.assessmentType) * 60 * 1000),
        },
      });

      // Generate questions (simplified - in production would use question bank)
      const questionCount = getQuestionCount(body.assessmentType);
      const questions = await generateAssessmentQuestions(body.skillId, questionCount);

      logger.info(
        { userId, skillId: body.skillId, assessmentId: assessment.id },
        'Assessment started'
      );

      return reply.status(201).send({
        assessmentId: assessment.id,
        skillId: body.skillId,
        skillName: skill.name,
        assessmentType: body.assessmentType,
        proctored: body.proctored,
        duration: getAssessmentDuration(body.assessmentType),
        expiresAt: assessment.expiresAt.toISOString(),
        questions: questions.map((q, index) => ({
          id: q.id,
          number: index + 1,
          text: q.text,
          type: q.type,
          options: q.options,
          category: q.category,
        })),
      });
    }
  );

  // ===========================================================================
  // SUBMIT ASSESSMENT
  // ===========================================================================

  /**
   * POST /skills-verification/assessments/submit
   * Submit assessment answers
   */
  fastify.post(
    '/assessments/submit',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = submitAssessmentSchema.parse(request.body);

      // Get assessment session
      const assessment = await prisma.skillAssessmentSession.findUnique({
        where: { id: body.assessmentId },
        include: { skill: true },
      });

      if (!assessment) {
        return reply.status(404).send({ error: 'Assessment session not found' });
      }

      if (assessment.userId !== userId) {
        return reply.status(403).send({ error: 'Not authorized' });
      }

      if (assessment.status !== 'IN_PROGRESS') {
        return reply.status(400).send({ error: 'Assessment is not in progress' });
      }

      if (assessment.expiresAt < new Date()) {
        await prisma.skillAssessmentSession.update({
          where: { id: body.assessmentId },
          data: { status: 'EXPIRED' },
        });
        return reply.status(400).send({ error: 'Assessment has expired' });
      }

      // Score the assessment
      const result = await scoreAssessment(body.assessmentId, body.answers);

      // Update assessment session
      await prisma.skillAssessmentSession.update({
        where: { id: body.assessmentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          score: result.score,
          maxScore: result.maxScore,
          answers: body.answers,
        },
      });

      // Create skill verification record
      await prisma.skillVerification.upsert({
        where: {
          userId_skillId_verificationType: {
            userId,
            skillId: assessment.skillId,
            verificationType: 'ASSESSMENT',
          },
        },
        update: {
          score: result.score,
          maxScore: result.maxScore,
          percentile: result.percentile,
          proficiencyLevel: result.proficiencyLevel,
          confidenceScore: result.confidenceScore,
          confidenceFactors: result.confidenceFactors,
          proctored: assessment.proctored,
          assessmentDuration: Math.ceil(
            (new Date().getTime() - assessment.startedAt.getTime()) / 60000
          ),
          questionBreakdown: result.questionBreakdown,
          verifiedAt: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
          isActive: true,
        },
        create: {
          userId,
          skillId: assessment.skillId,
          verificationType: 'ASSESSMENT',
          score: result.score,
          maxScore: result.maxScore,
          percentile: result.percentile,
          proficiencyLevel: result.proficiencyLevel,
          confidenceScore: result.confidenceScore,
          confidenceFactors: result.confidenceFactors,
          proctored: assessment.proctored,
          assessmentDuration: Math.ceil(
            (new Date().getTime() - assessment.startedAt.getTime()) / 60000
          ),
          questionBreakdown: result.questionBreakdown,
          verifiedAt: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
          showOnProfile: true,
          showScore: true,
          showPercentile: true,
        },
      });

      logger.info(
        { userId, skillId: assessment.skillId, score: result.score },
        'Assessment completed'
      );

      return reply.send({
        assessmentId: body.assessmentId,
        skillId: assessment.skillId,
        skillName: assessment.skill.name,
        score: result.score,
        maxScore: result.maxScore,
        percentage: Math.round((result.score / result.maxScore) * 100),
        percentile: result.percentile,
        proficiencyLevel: result.proficiencyLevel,
        badge: {
          type: 'SKILL_VERIFIED',
          level: result.proficiencyLevel,
          issuedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        breakdown: result.questionBreakdown,
      });
    }
  );

  // ===========================================================================
  // REQUEST ENDORSEMENT
  // ===========================================================================

  /**
   * POST /skills-verification/endorsements/request
   * Request a peer endorsement for a skill
   */
  fastify.post(
    '/endorsements/request',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = requestEndorsementSchema.parse(request.body);

      // Verify skill exists
      const skill = await prisma.skill.findUnique({
        where: { id: body.skillId },
      });

      if (!skill) {
        return reply.status(404).send({ error: 'Skill not found' });
      }

      // Check for existing pending request to same endorser for same skill
      const existingRequest = await prisma.endorsementRequest.findFirst({
        where: {
          requesterId: userId,
          skillId: body.skillId,
          endorserEmail: body.endorserEmail,
          status: 'PENDING',
        },
      });

      if (existingRequest) {
        return reply.status(400).send({
          error: 'ALREADY_REQUESTED',
          message: 'You already have a pending endorsement request to this person for this skill',
        });
      }

      // Create endorsement request
      const endorsementRequest = await prisma.endorsementRequest.create({
        data: {
          requesterId: userId,
          skillId: body.skillId,
          endorserEmail: body.endorserEmail,
          message: body.message,
          relationshipType: body.relationshipType,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // TODO: Send email notification to endorser

      logger.info(
        { userId, skillId: body.skillId, endorserEmail: body.endorserEmail },
        'Endorsement request created'
      );

      return reply.status(201).send({
        id: endorsementRequest.id,
        skillId: body.skillId,
        skillName: skill.name,
        endorserEmail: body.endorserEmail,
        status: 'PENDING',
        expiresAt: endorsementRequest.expiresAt.toISOString(),
      });
    }
  );

  // ===========================================================================
  // GET SKILL VERIFICATION DETAILS
  // ===========================================================================

  /**
   * GET /skills-verification/:skillId
   * Get detailed verification status for a specific skill
   */
  fastify.get(
    '/:skillId',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { skillId } = skillIdParamSchema.parse(request.params);

      // Get skill
      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
      });

      if (!skill) {
        return reply.status(404).send({ error: 'Skill not found' });
      }

      // Get verifications
      const verifications = await prisma.skillVerification.findMany({
        where: {
          userId,
          skillId,
        },
        orderBy: { verifiedAt: 'desc' },
      });

      // Get endorsements
      const endorsements = await prisma.skillEndorsement.findMany({
        where: {
          endorsedUserId: userId,
          skillId,
        },
        include: {
          endorser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Get pending requests
      const pendingRequests = await prisma.endorsementRequest.findMany({
        where: {
          requesterId: userId,
          skillId,
          status: 'PENDING',
        },
      });

      // Calculate confidence score
      const activeVerification = verifications.find((v) => v.isActive);
      const endorsementCount = endorsements.length;
      const hasAssessment = verifications.some((v) => v.verificationType === 'ASSESSMENT');

      return reply.send({
        skillId,
        skillName: skill.name,
        category: skill.category || 'General',
        currentLevel: activeVerification?.proficiencyLevel ?? null,
        confidenceScore: activeVerification ? Number(activeVerification.confidenceScore) : 0,
        verifications: verifications.map((v) => ({
          id: v.id,
          type: v.verificationType,
          score: v.score ? Number(v.score) : null,
          maxScore: v.maxScore ? Number(v.maxScore) : null,
          percentile: v.percentile ? Number(v.percentile) : null,
          proficiencyLevel: v.proficiencyLevel,
          proctored: v.proctored,
          verifiedAt: v.verifiedAt.toISOString(),
          validUntil: v.validUntil?.toISOString() ?? null,
          isActive: v.isActive,
          showOnProfile: v.showOnProfile,
        })),
        endorsements: endorsements.map((e) => ({
          id: e.id,
          endorser: {
            id: e.endorser.id,
            name: `${e.endorser.firstName} ${e.endorser.lastName}`,
            avatar: e.endorser.avatarUrl,
          },
          relationshipType: e.relationshipType,
          message: e.message,
          endorsedAt: e.createdAt.toISOString(),
        })),
        pendingRequests: pendingRequests.map((r) => ({
          id: r.id,
          endorserEmail: r.endorserEmail,
          requestedAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
        })),
        stats: {
          endorsementCount,
          hasAssessment,
          lastVerifiedAt: activeVerification?.verifiedAt.toISOString() ?? null,
        },
      });
    }
  );
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getLevelPriority(level: string): number {
  const priorities: Record<string, number> = {
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3,
    EXPERT: 4,
  };
  return priorities[level] || 0;
}

function getAssessmentDuration(type: string): number {
  const durations: Record<string, number> = {
    QUICK: 15,
    STANDARD: 30,
    COMPREHENSIVE: 60,
  };
  return durations[type] || 30;
}

function getQuestionCount(type: string): number {
  const counts: Record<string, number> = {
    QUICK: 15,
    STANDARD: 30,
    COMPREHENSIVE: 50,
  };
  return counts[type] || 30;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'CODE' | 'TRUE_FALSE';
  options?: string[];
  category: string;
  correctAnswer: string | string[];
}

async function generateAssessmentQuestions(skillId: string, count: number): Promise<Question[]> {
  // In production, this would fetch from a question bank
  // For now, generate placeholder questions
  const questions: Question[] = [];

  for (let i = 0; i < count; i++) {
    questions.push({
      id: `q_${skillId}_${i}`,
      text: `Sample question ${i + 1} for this skill assessment`,
      type: 'MULTIPLE_CHOICE',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      category: i % 3 === 0 ? 'Fundamentals' : i % 3 === 1 ? 'Application' : 'Advanced',
      correctAnswer: ['Option A', 'Option B', 'Option C', 'Option D'][
        Math.floor(Math.random() * 4)
      ],
    });
  }

  return questions;
}

interface AssessmentResult {
  score: number;
  maxScore: number;
  percentile: number;
  proficiencyLevel: string;
  confidenceScore: number;
  confidenceFactors: Record<string, unknown>;
  questionBreakdown: Record<string, { correct: number; total: number }>;
}

async function scoreAssessment(
  assessmentId: string,
  answers: { questionId: string; answer: unknown; timeSpent: number }[]
): Promise<AssessmentResult> {
  // Simplified scoring logic - in production would compare against correct answers
  const totalQuestions = answers.length;
  const totalTime = answers.reduce((sum, a) => sum + a.timeSpent, 0);

  // Simulate scoring (random for demo)
  const correctAnswers = Math.floor(totalQuestions * (0.5 + Math.random() * 0.5));
  const score = correctAnswers;
  const maxScore = totalQuestions;
  const percentage = (score / maxScore) * 100;

  // Calculate percentile (mock)
  const percentile = Math.min(99, Math.round(percentage + (Math.random() * 10 - 5)));

  // Determine proficiency level
  let proficiencyLevel: string;
  if (percentage >= 90) proficiencyLevel = 'EXPERT';
  else if (percentage >= 75) proficiencyLevel = 'ADVANCED';
  else if (percentage >= 60) proficiencyLevel = 'INTERMEDIATE';
  else proficiencyLevel = 'BEGINNER';

  // Calculate confidence score
  const avgTimePerQuestion = totalTime / totalQuestions;
  const confidenceScore = Math.min(
    100,
    percentage * 0.7 + (avgTimePerQuestion > 30 ? 20 : 10) + 10
  );

  // Question breakdown by category
  const breakdown: Record<string, { correct: number; total: number }> = {
    Fundamentals: {
      correct: Math.floor(correctAnswers * 0.4),
      total: Math.floor(totalQuestions * 0.4),
    },
    Application: {
      correct: Math.floor(correctAnswers * 0.35),
      total: Math.floor(totalQuestions * 0.35),
    },
    Advanced: {
      correct: Math.floor(correctAnswers * 0.25),
      total: Math.floor(totalQuestions * 0.25),
    },
  };

  return {
    score,
    maxScore,
    percentile,
    proficiencyLevel,
    confidenceScore,
    confidenceFactors: {
      scorePercentage: percentage,
      averageTimePerQuestion: avgTimePerQuestion,
      questionCount: totalQuestions,
    },
    questionBreakdown: breakdown,
  };
}

export default skillsVerificationRoutes;
