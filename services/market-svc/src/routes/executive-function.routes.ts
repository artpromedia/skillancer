/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Executive Function Tools Routes
 *
 * Provides endpoints for:
 * - Executive function assessments
 * - Goal setting and tracking
 * - Strategies and interventions
 * - Progress monitoring
 */

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

interface ExecutiveFunctionDependencies {
  prisma: PrismaClient;
  logger: Logger;
}

// =============================================================================
// Schemas
// =============================================================================

const createAssessmentSchema = z.object({
  assessmentType: z.enum([
    'SELF_ASSESSMENT',
    'PROFESSIONAL_ASSESSMENT',
    'SCREENING',
    'FOLLOW_UP',
  ]),
  overallScore: z.number().int().min(0).max(100),
  subScores: z.record(z.number().int().min(0).max(100)),
  notes: z.string().optional(),
});

const createGoalSchema = z.object({
  assessmentId: z.string().uuid(),
  targetArea: z.enum([
    'INHIBITION',
    'WORKING_MEMORY',
    'COGNITIVE_FLEXIBILITY',
    'PLANNING',
    'ORGANIZATION',
    'TIME_MANAGEMENT',
    'SELF_MONITORING',
    'EMOTIONAL_CONTROL',
    'TASK_INITIATION',
    'SUSTAINED_ATTENTION',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  targetScore: z.number().int().min(0).max(100).optional(),
  targetDate: z.string().datetime().optional(),
  strategies: z.array(z.string()).optional(),
});

const createCheckInSchema = z.object({
  progress: z.number().int().min(0).max(100),
  notes: z.string().optional(),
  challenges: z.array(z.string()).optional(),
  wins: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
});

const updateGoalSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PAUSED', 'CANCELLED']).optional(),
  currentProgress: z.number().int().min(0).max(100).optional(),
  strategies: z.array(z.string()).optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerExecutiveFunctionRoutes(
  fastify: FastifyInstance,
  deps: ExecutiveFunctionDependencies
): void {
  const { prisma, logger } = deps;

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string };
  };

  // -------------------------------------------------------------------------
  // Assessment Routes
  // -------------------------------------------------------------------------

  /**
   * GET /executive-function/assessments - List user's assessments
   */
  fastify.get('/assessments', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching executive function assessments');

      const assessments = await prisma.executiveFunctionAssessment.findMany({
        where: { userId },
        include: {
          goals: {
            select: {
              id: true,
              targetArea: true,
              title: true,
              status: true,
              currentProgress: true,
            },
          },
        },
        orderBy: { assessmentDate: 'desc' },
      });

      return reply.send({
        success: true,
        data: assessments.map((a: any) => ({
          id: a.id,
          assessmentType: a.assessmentType,
          assessmentDate: a.assessmentDate.toISOString(),
          overallScore: a.overallScore,
          subScores: a.subScores,
          goalsCount: a.goals.length,
          activeGoals: a.goals.filter((g: any) => g.status === 'IN_PROGRESS').length,
          achievedGoals: a.goals.filter((g: any) => g.status === 'ACHIEVED').length,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch assessments');
      return reply.status(500).send({ error: 'Failed to fetch assessments' });
    }
  });

  /**
   * POST /executive-function/assessments - Create assessment
   */
  fastify.post('/assessments', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = createAssessmentSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating executive function assessment');

      const assessment = await prisma.executiveFunctionAssessment.create({
        data: {
          userId,
          ...validation.data,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: assessment.id,
          assessmentType: assessment.assessmentType,
          assessmentDate: assessment.assessmentDate.toISOString(),
          overallScore: assessment.overallScore,
          subScores: assessment.subScores,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create assessment');
      return reply.status(500).send({ error: 'Failed to create assessment' });
    }
  });

  /**
   * GET /executive-function/assessments/:id - Get assessment details
   */
  fastify.get<{ Params: { id: string } }>(
    '/assessments/:id',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { id } = request.params;

        logger.info({ userId, assessmentId: id }, 'Fetching assessment details');

        const assessment = await prisma.executiveFunctionAssessment.findFirst({
          where: { id, userId },
          include: {
            goals: {
              include: {
                checkIns: {
                  orderBy: { checkInDate: 'desc' },
                  take: 5,
                },
              },
            },
          },
        });

        if (!assessment) {
          return reply.status(404).send({ error: 'Assessment not found' });
        }

        return reply.send({
          success: true,
          data: {
            id: assessment.id,
            assessmentType: assessment.assessmentType,
            assessmentDate: assessment.assessmentDate.toISOString(),
            overallScore: assessment.overallScore,
            subScores: assessment.subScores,
            notes: assessment.notes,
            goals: assessment.goals.map((g: any) => ({
              id: g.id,
              targetArea: g.targetArea,
              title: g.title,
              description: g.description,
              targetScore: g.targetScore,
              currentProgress: g.currentProgress,
              startDate: g.startDate.toISOString(),
              targetDate: g.targetDate?.toISOString(),
              status: g.status,
              strategies: g.strategies,
              recentCheckIns: g.checkIns.map((c: any) => ({
                id: c.id,
                progress: c.progress,
                notes: c.notes,
                checkInDate: c.checkInDate.toISOString(),
              })),
            })),
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to fetch assessment');
        return reply.status(500).send({ error: 'Failed to fetch assessment' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // Goal Routes
  // -------------------------------------------------------------------------

  /**
   * POST /executive-function/goals - Create goal
   */
  fastify.post('/goals', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = createGoalSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating executive function goal');

      // Verify assessment belongs to user
      const assessment = await prisma.executiveFunctionAssessment.findFirst({
        where: { id: validation.data.assessmentId, userId },
      });

      if (!assessment) {
        return reply.status(404).send({ error: 'Assessment not found' });
      }

      const data = validation.data;
      const goal = await prisma.executiveFunctionGoal.create({
        data: {
          assessmentId: data.assessmentId,
          userId,
          targetArea: data.targetArea,
          title: data.title,
          description: data.description,
          targetScore: data.targetScore,
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          strategies: data.strategies ?? [],
          status: 'NOT_STARTED',
        },
      });

      return reply.status(201).send({
        success: true,
        data: goal,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create goal');
      return reply.status(500).send({ error: 'Failed to create goal' });
    }
  });

  /**
   * GET /executive-function/goals - List user's active goals
   */
  fastify.get('/goals', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;
      const { status, targetArea } = request.query;

      logger.info({ userId, status, targetArea }, 'Fetching executive function goals');

      const where: Record<string, unknown> = { userId };
      if (status) where.status = status;
      if (targetArea) where.targetArea = targetArea;

      const goals = await prisma.executiveFunctionGoal.findMany({
        where,
        include: {
          checkIns: {
            orderBy: { checkInDate: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: goals.map((g: any) => ({
          id: g.id,
          targetArea: g.targetArea,
          title: g.title,
          description: g.description,
          currentProgress: g.currentProgress,
          targetScore: g.targetScore,
          startDate: g.startDate.toISOString(),
          targetDate: g.targetDate?.toISOString(),
          status: g.status,
          strategies: g.strategies,
          lastCheckIn: g.checkIns[0]
            ? {
                progress: g.checkIns[0].progress,
                date: g.checkIns[0].checkInDate.toISOString(),
              }
            : null,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch goals');
      return reply.status(500).send({ error: 'Failed to fetch goals' });
    }
  });

  /**
   * PATCH /executive-function/goals/:id - Update goal
   */
  fastify.patch<{ Params: { id: string } }>(
    '/goals/:id',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { id } = request.params;

        const validation = updateGoalSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
        }

        logger.info({ userId, goalId: id }, 'Updating executive function goal');

        const goal = await prisma.executiveFunctionGoal.findFirst({
          where: { id, userId },
        });

        if (!goal) {
          return reply.status(404).send({ error: 'Goal not found' });
        }

        const updatedGoal = await prisma.executiveFunctionGoal.update({
          where: { id },
          data: {
            ...validation.data,
            completedAt:
              validation.data.status === 'ACHIEVED' && !goal.completedAt ? new Date() : undefined,
          },
        });

        return reply.send({
          success: true,
          data: updatedGoal,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to update goal');
        return reply.status(500).send({ error: 'Failed to update goal' });
      }
    }
  );

  /**
   * POST /executive-function/goals/:id/check-ins - Add check-in to goal
   */
  fastify.post<{ Params: { id: string } }>(
    '/goals/:id/check-ins',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { id: goalId } = request.params;

        const validation = createCheckInSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
        }

        logger.info({ userId, goalId }, 'Adding check-in to goal');

        const goal = await prisma.executiveFunctionGoal.findFirst({
          where: { id: goalId, userId },
        });

        if (!goal) {
          return reply.status(404).send({ error: 'Goal not found' });
        }

        const checkIn = await prisma.executiveFunctionCheckIn.create({
          data: {
            goalId,
            ...validation.data,
          },
        });

        // Update goal's current progress
        await prisma.executiveFunctionGoal.update({
          where: { id: goalId },
          data: {
            currentProgress: validation.data.progress,
            status:
              validation.data.progress >= 100
                ? 'ACHIEVED'
                : validation.data.progress > 0
                  ? 'IN_PROGRESS'
                  : undefined,
            completedAt: validation.data.progress >= 100 ? new Date() : undefined,
          },
        });

        return reply.status(201).send({
          success: true,
          data: {
            id: checkIn.id,
            progress: checkIn.progress,
            checkInDate: checkIn.checkInDate.toISOString(),
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to add check-in');
        return reply.status(500).send({ error: 'Failed to add check-in' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // Strategies Routes
  // -------------------------------------------------------------------------

  /**
   * GET /executive-function/strategies - Get strategies for a target area
   */
  fastify.get('/strategies', async (request: any, reply: any) => {
    try {
      const { targetArea, difficulty } = request.query;

      logger.info({ targetArea, difficulty }, 'Fetching executive function strategies');

      const where: Record<string, unknown> = { isActive: true };
      if (targetArea) where.targetArea = targetArea;
      if (difficulty) where.difficulty = difficulty;

      const strategies = await prisma.executiveFunctionStrategy.findMany({
        where,
        orderBy: { title: 'asc' },
      });

      return reply.send({
        success: true,
        data: strategies.map((s: any) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          targetArea: s.targetArea,
          steps: s.steps,
          tips: s.tips,
          resources: s.resources,
          difficulty: s.difficulty,
          estimatedTimeMinutes: s.estimatedTimeMinutes,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch strategies');
      return reply.status(500).send({ error: 'Failed to fetch strategies' });
    }
  });

  // -------------------------------------------------------------------------
  // Summary and Dashboard Routes
  // -------------------------------------------------------------------------

  /**
   * GET /executive-function/dashboard - Get dashboard summary
   */
  fastify.get('/dashboard', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching executive function dashboard');

      // Get latest assessment
      const latestAssessment = await prisma.executiveFunctionAssessment.findFirst({
        where: { userId },
        orderBy: { assessmentDate: 'desc' },
      });

      // Get active goals count
      const goalsStats = await prisma.executiveFunctionGoal.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      });

      // Get recent check-ins
      const recentCheckIns = await prisma.executiveFunctionCheckIn.findMany({
        where: {
          goal: { userId },
        },
        include: {
          goal: {
            select: { title: true, targetArea: true },
          },
        },
        orderBy: { checkInDate: 'desc' },
        take: 5,
      });

      // Get goals by area
      const goalsByArea = await prisma.executiveFunctionGoal.groupBy({
        by: ['targetArea'],
        where: { userId },
        _count: true,
        _avg: { currentProgress: true },
      });

      return reply.send({
        success: true,
        data: {
          latestAssessment: latestAssessment
            ? {
                id: latestAssessment.id,
                assessmentDate: latestAssessment.assessmentDate.toISOString(),
                overallScore: latestAssessment.overallScore,
                subScores: latestAssessment.subScores,
              }
            : null,
          goals: {
            total: goalsStats.reduce((sum: number, g: any) => sum + g._count, 0),
            byStatus: Object.fromEntries(goalsStats.map((g: any) => [g.status, g._count])),
          },
          goalsByArea: goalsByArea.map((g: any) => ({
            area: g.targetArea,
            count: g._count,
            averageProgress: Math.round(g._avg.currentProgress ?? 0),
          })),
          recentCheckIns: recentCheckIns.map((c: any) => ({
            id: c.id,
            goalTitle: c.goal.title,
            targetArea: c.goal.targetArea,
            progress: c.progress,
            checkInDate: c.checkInDate.toISOString(),
          })),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch dashboard');
      return reply.status(500).send({ error: 'Failed to fetch dashboard' });
    }
  });

  // -------------------------------------------------------------------------
  // Target Areas Reference Data
  // -------------------------------------------------------------------------

  /**
   * GET /executive-function/areas - Get target areas info
   */
  fastify.get('/areas', async (_request: any, reply: any) => {
    const areas = [
      {
        id: 'INHIBITION',
        name: 'Inhibition',
        description: 'The ability to stop or control automatic responses and impulses',
        examples: ['Thinking before acting', 'Avoiding distractions', 'Waiting your turn'],
        icon: 'pause-circle',
        color: '#EF4444',
      },
      {
        id: 'WORKING_MEMORY',
        name: 'Working Memory',
        description: 'The ability to hold and manipulate information in mind',
        examples: ['Following multi-step directions', 'Mental math', 'Remembering what you just read'],
        icon: 'brain',
        color: '#8B5CF6',
      },
      {
        id: 'COGNITIVE_FLEXIBILITY',
        name: 'Cognitive Flexibility',
        description: 'The ability to shift between tasks or think about things from different perspectives',
        examples: ['Adjusting to changes in routine', 'Problem-solving', 'Seeing others\' viewpoints'],
        icon: 'refresh-cw',
        color: '#10B981',
      },
      {
        id: 'PLANNING',
        name: 'Planning',
        description: 'The ability to create and follow a roadmap to reach a goal',
        examples: ['Breaking down large projects', 'Setting priorities', 'Anticipating obstacles'],
        icon: 'map',
        color: '#3B82F6',
      },
      {
        id: 'ORGANIZATION',
        name: 'Organization',
        description: 'The ability to keep track of information and belongings',
        examples: ['Keeping workspace tidy', 'Using calendars/planners', 'Filing documents'],
        icon: 'folder',
        color: '#F59E0B',
      },
      {
        id: 'TIME_MANAGEMENT',
        name: 'Time Management',
        description: 'The ability to estimate, allocate, and track time effectively',
        examples: ['Meeting deadlines', 'Estimating task duration', 'Pacing yourself'],
        icon: 'clock',
        color: '#EC4899',
      },
      {
        id: 'SELF_MONITORING',
        name: 'Self-Monitoring',
        description: 'The ability to observe and evaluate your own behavior and performance',
        examples: ['Checking work for errors', 'Noticing when you\'re off-track', 'Self-reflection'],
        icon: 'eye',
        color: '#14B8A6',
      },
      {
        id: 'EMOTIONAL_CONTROL',
        name: 'Emotional Control',
        description: 'The ability to manage emotional responses to situations',
        examples: ['Staying calm under pressure', 'Handling frustration', 'Managing anxiety'],
        icon: 'heart',
        color: '#F43F5E',
      },
      {
        id: 'TASK_INITIATION',
        name: 'Task Initiation',
        description: 'The ability to begin tasks without undue procrastination',
        examples: ['Getting started on homework', 'Beginning unpleasant tasks', 'Starting new projects'],
        icon: 'play',
        color: '#6366F1',
      },
      {
        id: 'SUSTAINED_ATTENTION',
        name: 'Sustained Attention',
        description: 'The ability to maintain focus on a task over time',
        examples: ['Completing long assignments', 'Staying engaged in meetings', 'Reading for extended periods'],
        icon: 'target',
        color: '#0EA5E9',
      },
    ];

    return reply.send({ success: true, data: areas });
  });

  // -------------------------------------------------------------------------
  // Self-Assessment Questionnaire
  // -------------------------------------------------------------------------

  /**
   * GET /executive-function/self-assessment - Get self-assessment questions
   */
  fastify.get('/self-assessment', async (_request: any, reply: any) => {
    const questionnaire = {
      title: 'Executive Function Self-Assessment',
      description: 'Rate each statement from 1 (Never) to 5 (Very Often)',
      instructions:
        'Think about your experiences over the past 6 months. There are no right or wrong answers.',
      sections: [
        {
          area: 'INHIBITION',
          questions: [
            'I act impulsively without thinking about consequences',
            'I interrupt others when they are speaking',
            'I have trouble stopping activities even when I should',
          ],
        },
        {
          area: 'WORKING_MEMORY',
          questions: [
            'I forget what I was going to say mid-sentence',
            'I have difficulty following multi-step instructions',
            'I lose track of my thoughts during conversations',
          ],
        },
        {
          area: 'COGNITIVE_FLEXIBILITY',
          questions: [
            'I get upset when my routine is disrupted',
            'I have difficulty switching between tasks',
            'I struggle to see things from others\' perspectives',
          ],
        },
        {
          area: 'PLANNING',
          questions: [
            'I have trouble breaking large tasks into smaller steps',
            'I underestimate how long tasks will take',
            'I start projects without a clear plan',
          ],
        },
        {
          area: 'ORGANIZATION',
          questions: [
            'My workspace/room is usually disorganized',
            'I have trouble keeping track of my belongings',
            'I struggle to maintain filing systems',
          ],
        },
        {
          area: 'TIME_MANAGEMENT',
          questions: [
            'I frequently run late',
            'I have difficulty estimating how long things take',
            'I procrastinate on tasks until the last minute',
          ],
        },
        {
          area: 'SELF_MONITORING',
          questions: [
            'I don\'t notice my own mistakes',
            'I have trouble recognizing when I\'m off-topic',
            'I\'m unaware of how my behavior affects others',
          ],
        },
        {
          area: 'EMOTIONAL_CONTROL',
          questions: [
            'I have emotional outbursts',
            'I get easily frustrated',
            'Small problems feel overwhelming',
          ],
        },
        {
          area: 'TASK_INITIATION',
          questions: [
            'I have trouble getting started on tasks',
            'I need external pressure to begin work',
            'I put off tasks I don\'t enjoy',
          ],
        },
        {
          area: 'SUSTAINED_ATTENTION',
          questions: [
            'I have difficulty concentrating for long periods',
            'I get easily distracted',
            'I zone out during conversations or meetings',
          ],
        },
      ],
      scoring: {
        scale: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very Often'],
        interpretation: [
          { range: [0, 33], level: 'Strength', description: 'This is an area of strength for you' },
          { range: [34, 66], level: 'Typical', description: 'You have typical functioning in this area' },
          { range: [67, 100], level: 'Challenge', description: 'This area may benefit from strategies and support' },
        ],
      },
    };

    return reply.send({ success: true, data: questionnaire });
  });
}
