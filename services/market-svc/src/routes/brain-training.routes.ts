/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Brain Training Module Routes
 *
 * Provides endpoints for:
 * - Browsing brain training exercises
 * - Tracking training sessions
 * - Progress and statistics
 * - Achievements and gamification
 */

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

interface BrainTrainingDependencies {
  prisma: PrismaClient;
  logger: Logger;
}

// =============================================================================
// Schemas
// =============================================================================

const startSessionSchema = z.object({
  exerciseId: z.string().uuid(),
});

const completeSessionSchema = z.object({
  score: z.number().int().min(0),
  accuracy: z.number().min(0).max(100).optional(),
  timeSpentSeconds: z.number().int().min(0),
  metrics: z.record(z.unknown()).optional(),
});

const updateProgressSchema = z.object({
  dailyGoalMinutes: z.number().int().min(1).max(120).optional(),
  weeklyGoalSessions: z.number().int().min(1).max(50).optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerBrainTrainingRoutes(
  fastify: FastifyInstance,
  deps: BrainTrainingDependencies
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
  // GET /brain-training/exercises - List all exercises
  // -------------------------------------------------------------------------
  fastify.get('/exercises', async (request: any, reply: any) => {
    try {
      const { category, difficulty, page = '1', limit = '20' } = request.query;
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

      logger.info({ category, difficulty, page: pageNum }, 'Fetching brain training exercises');

      const where: Record<string, unknown> = { isActive: true };
      if (category) where.category = category;
      if (difficulty) where.difficulty = difficulty;

      const [exercises, total] = await Promise.all([
        prisma.brainTrainingExercise.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.brainTrainingExercise.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: exercises.map((e: any) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          instructions: e.instructions,
          category: e.category,
          targetSkills: e.targetSkills,
          difficulty: e.difficulty,
          exerciseType: e.exerciseType,
          estimatedMinutes: e.estimatedMinutes,
          isPremium: e.isPremium,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch exercises');
      return reply.status(500).send({ error: 'Failed to fetch exercises' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /brain-training/exercises/:id - Get exercise details
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>('/exercises/:id', async (request: any, reply: any) => {
    try {
      const { id } = request.params;

      logger.info({ exerciseId: id }, 'Fetching exercise details');

      const exercise = await prisma.brainTrainingExercise.findUnique({
        where: { id, isActive: true },
      });

      if (!exercise) {
        return reply.status(404).send({ error: 'Exercise not found' });
      }

      return reply.send({
        success: true,
        data: {
          id: exercise.id,
          name: exercise.name,
          description: exercise.description,
          instructions: exercise.instructions,
          category: exercise.category,
          targetSkills: exercise.targetSkills,
          difficulty: exercise.difficulty,
          exerciseType: exercise.exerciseType,
          config: exercise.config,
          estimatedMinutes: exercise.estimatedMinutes,
          isPremium: exercise.isPremium,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch exercise');
      return reply.status(500).send({ error: 'Failed to fetch exercise' });
    }
  });

  // -------------------------------------------------------------------------
  // POST /brain-training/sessions - Start a training session
  // -------------------------------------------------------------------------
  fastify.post('/sessions', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = startSessionSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      const { exerciseId } = validation.data;
      logger.info({ userId, exerciseId }, 'Starting brain training session');

      // Verify exercise exists
      const exercise = await prisma.brainTrainingExercise.findUnique({
        where: { id: exerciseId, isActive: true },
      });

      if (!exercise) {
        return reply.status(404).send({ error: 'Exercise not found' });
      }

      // Create session
      const session = await prisma.brainTrainingSession.create({
        data: {
          userId,
          exerciseId,
          status: 'IN_PROGRESS',
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          sessionId: session.id,
          exerciseId: session.exerciseId,
          startedAt: session.startedAt.toISOString(),
          exercise: {
            name: exercise.name,
            exerciseType: exercise.exerciseType,
            config: exercise.config,
            instructions: exercise.instructions,
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start session');
      return reply.status(500).send({ error: 'Failed to start session' });
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /brain-training/sessions/:id/complete - Complete a session
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/sessions/:id/complete',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { id: sessionId } = request.params;

        const validation = completeSessionSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
        }

        logger.info({ userId, sessionId }, 'Completing brain training session');

        // Verify session belongs to user
        const session = await prisma.brainTrainingSession.findFirst({
          where: { id: sessionId, userId, status: 'IN_PROGRESS' },
          include: { exercise: true },
        });

        if (!session) {
          return reply.status(404).send({ error: 'Session not found or already completed' });
        }

        const { score, accuracy, timeSpentSeconds, metrics } = validation.data;

        // Update session
        const updatedSession = await prisma.brainTrainingSession.update({
          where: { id: sessionId },
          data: {
            completedAt: new Date(),
            score,
            accuracy: accuracy ?? null,
            timeSpentSeconds,
            metrics: metrics ?? null,
            status: 'COMPLETED',
          },
        });

        // Update progress
        await updateUserProgress(prisma, userId, session.exercise, updatedSession);

        return reply.send({
          success: true,
          data: {
            sessionId: updatedSession.id,
            score: updatedSession.score,
            accuracy: updatedSession.accuracy,
            timeSpentSeconds: updatedSession.timeSpentSeconds,
            completedAt: updatedSession.completedAt?.toISOString(),
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to complete session');
        return reply.status(500).send({ error: 'Failed to complete session' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /brain-training/progress - Get user's progress
  // -------------------------------------------------------------------------
  fastify.get('/progress', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching brain training progress');

      let progress = await prisma.brainTrainingProgress.findUnique({
        where: { userId },
      });

      // Create progress record if it doesn't exist
      if (!progress) {
        progress = await prisma.brainTrainingProgress.create({
          data: { userId },
        });
      }

      // Get recent sessions
      const recentSessions = await prisma.brainTrainingSession.findMany({
        where: { userId, status: 'COMPLETED' },
        include: { exercise: { select: { name: true, category: true } } },
        orderBy: { completedAt: 'desc' },
        take: 10,
      });

      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStats = await prisma.brainTrainingSession.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { gte: today },
        },
        _count: true,
        _sum: { timeSpentSeconds: true },
        _avg: { score: true },
      });

      // Get this week's stats
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStats = await prisma.brainTrainingSession.aggregate({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { gte: weekStart },
        },
        _count: true,
        _sum: { timeSpentSeconds: true },
      });

      return reply.send({
        success: true,
        data: {
          overall: {
            level: progress.overallLevel,
            experiencePoints: progress.experiencePoints,
            totalSessions: progress.totalSessions,
            totalTimeMinutes: progress.totalTimeMinutes,
            currentStreak: progress.currentStreak,
            longestStreak: progress.longestStreak,
            achievements: progress.achievements,
          },
          categoryProgress: progress.categoryProgress,
          goals: {
            dailyGoalMinutes: progress.dailyGoalMinutes,
            weeklyGoalSessions: progress.weeklyGoalSessions,
          },
          today: {
            sessions: todayStats._count,
            timeMinutes: Math.round((todayStats._sum.timeSpentSeconds ?? 0) / 60),
            averageScore: Math.round(todayStats._avg.score ?? 0),
            goalProgress: Math.min(
              100,
              Math.round(((todayStats._sum.timeSpentSeconds ?? 0) / 60 / progress.dailyGoalMinutes) * 100)
            ),
          },
          thisWeek: {
            sessions: weekStats._count,
            timeMinutes: Math.round((weekStats._sum.timeSpentSeconds ?? 0) / 60),
            goalProgress: Math.min(
              100,
              Math.round((weekStats._count / progress.weeklyGoalSessions) * 100)
            ),
          },
          recentSessions: recentSessions.map((s: any) => ({
            id: s.id,
            exerciseName: s.exercise.name,
            category: s.exercise.category,
            score: s.score,
            accuracy: s.accuracy,
            timeSpentSeconds: s.timeSpentSeconds,
            completedAt: s.completedAt?.toISOString(),
          })),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch progress');
      return reply.status(500).send({ error: 'Failed to fetch progress' });
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /brain-training/progress - Update goals
  // -------------------------------------------------------------------------
  fastify.patch('/progress', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = updateProgressSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Updating brain training goals');

      const progress = await prisma.brainTrainingProgress.upsert({
        where: { userId },
        update: validation.data,
        create: { userId, ...validation.data },
      });

      return reply.send({
        success: true,
        data: {
          dailyGoalMinutes: progress.dailyGoalMinutes,
          weeklyGoalSessions: progress.weeklyGoalSessions,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update goals');
      return reply.status(500).send({ error: 'Failed to update goals' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /brain-training/stats - Get detailed statistics
  // -------------------------------------------------------------------------
  fastify.get('/stats', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;
      const { period = '30d' } = request.query;

      logger.info({ userId, period }, 'Fetching brain training stats');

      const periodDays = parseInt(period.replace('d', ''), 10) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Get sessions in period
      const sessions = await prisma.brainTrainingSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: { gte: startDate },
        },
        include: { exercise: { select: { category: true, difficulty: true } } },
      });

      // Calculate category breakdown
      const categoryStats = sessions.reduce(
        (acc: any, session: any) => {
          const category = session.exercise.category;
          if (!acc[category]) {
            acc[category] = { sessions: 0, totalTime: 0, totalScore: 0, avgAccuracy: [] };
          }
          acc[category].sessions++;
          acc[category].totalTime += session.timeSpentSeconds ?? 0;
          acc[category].totalScore += session.score ?? 0;
          if (session.accuracy) {
            acc[category].avgAccuracy.push(Number(session.accuracy));
          }
          return acc;
        },
        {} as Record<string, { sessions: number; totalTime: number; totalScore: number; avgAccuracy: number[] }>
      );

      // Calculate daily activity
      const dailyActivity = sessions.reduce(
        (acc: any, session: any) => {
          if (!session.completedAt) return acc;
          const date = session.completedAt.toISOString().split('T')[0];
          if (!acc[date]) {
            acc[date] = { sessions: 0, timeMinutes: 0 };
          }
          acc[date].sessions++;
          acc[date].timeMinutes += Math.round((session.timeSpentSeconds ?? 0) / 60);
          return acc;
        },
        {} as Record<string, { sessions: number; timeMinutes: number }>
      );

      return reply.send({
        success: true,
        data: {
          period: { days: periodDays, startDate: startDate.toISOString() },
          summary: {
            totalSessions: sessions.length,
            totalTimeMinutes: Math.round(
              sessions.reduce((sum: number, s: any) => sum + (s.timeSpentSeconds ?? 0), 0) / 60
            ),
            averageScore: Math.round(
              sessions.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0) / sessions.length || 0
            ),
          },
          categoryBreakdown: Object.entries(categoryStats).map(([category, stats]: [string, any]) => ({
            category,
            sessions: stats.sessions,
            timeMinutes: Math.round(stats.totalTime / 60),
            averageScore: Math.round(stats.totalScore / stats.sessions),
            averageAccuracy:
              stats.avgAccuracy.length > 0
                ? Math.round(stats.avgAccuracy.reduce((a: number, b: number) => a + b, 0) / stats.avgAccuracy.length)
                : null,
          })),
          dailyActivity: Object.entries(dailyActivity)
            .map(([date, stats]: [string, any]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch stats');
      return reply.status(500).send({ error: 'Failed to fetch stats' });
    }
  });

  // -------------------------------------------------------------------------
  // GET /brain-training/categories - Get available categories
  // -------------------------------------------------------------------------
  fastify.get('/categories', async (_request: any, reply: any) => {
    const categories = [
      {
        id: 'MEMORY',
        name: 'Memory',
        description: 'Improve working memory and recall abilities',
        icon: 'brain',
        color: '#8B5CF6',
      },
      {
        id: 'ATTENTION',
        name: 'Attention',
        description: 'Enhance focus and concentration skills',
        icon: 'target',
        color: '#3B82F6',
      },
      {
        id: 'PROBLEM_SOLVING',
        name: 'Problem Solving',
        description: 'Develop logical reasoning and critical thinking',
        icon: 'puzzle',
        color: '#10B981',
      },
      {
        id: 'FLEXIBILITY',
        name: 'Flexibility',
        description: 'Improve cognitive flexibility and adaptability',
        icon: 'refresh',
        color: '#F59E0B',
      },
      {
        id: 'SPEED',
        name: 'Speed',
        description: 'Boost processing speed and quick thinking',
        icon: 'zap',
        color: '#EF4444',
      },
      {
        id: 'LANGUAGE',
        name: 'Language',
        description: 'Expand vocabulary and verbal fluency',
        icon: 'book',
        color: '#EC4899',
      },
      {
        id: 'SPATIAL',
        name: 'Spatial',
        description: 'Enhance visual-spatial reasoning',
        icon: 'cube',
        color: '#14B8A6',
      },
      {
        id: 'PLANNING',
        name: 'Planning',
        description: 'Strengthen executive planning and organization',
        icon: 'map',
        color: '#6366F1',
      },
    ];

    return reply.send({ success: true, data: categories });
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

interface Exercise {
  category: string;
  difficulty: string;
}

interface Session {
  score: number | null;
  timeSpentSeconds: number | null;
  accuracy: unknown;
}

async function updateUserProgress(
  prisma: PrismaClient,
  userId: string,
  exercise: Exercise,
  session: Session
) {
  const timeMinutes = Math.round((session.timeSpentSeconds ?? 0) / 60);

  // Get or create progress record
  let progress = await prisma.brainTrainingProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.brainTrainingProgress.create({
      data: { userId },
    });
  }

  // Calculate XP earned
  const baseXP = 10;
  const difficultyMultiplier: Record<string, number> = {
    BEGINNER: 1,
    INTERMEDIATE: 1.5,
    ADVANCED: 2,
    EXPERT: 3,
  };
  const scoreBonus = Math.round((session.score ?? 0) / 10);
  const xpEarned = Math.round(baseXP * (difficultyMultiplier[exercise.difficulty] ?? 1) + scoreBonus);

  // Calculate new level
  const totalXP = progress.experiencePoints + xpEarned;
  const newLevel = Math.floor(totalXP / 100) + 1;

  // Update category progress
  const categoryProgress =
    typeof progress.categoryProgress === 'object' && progress.categoryProgress !== null
      ? (progress.categoryProgress as Record<string, { level: number; xp: number }>)
      : {};

  if (!categoryProgress[exercise.category]) {
    categoryProgress[exercise.category] = { level: 1, xp: 0 };
  }
  categoryProgress[exercise.category].xp += xpEarned;
  categoryProgress[exercise.category].level =
    Math.floor(categoryProgress[exercise.category].xp / 100) + 1;

  // Check streak
  const lastActivity = progress.lastActivityAt;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = progress.currentStreak;
  if (lastActivity) {
    const lastActivityDate = new Date(lastActivity);
    lastActivityDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      currentStreak++;
    } else if (daysDiff > 1) {
      currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }

  // Update progress
  await prisma.brainTrainingProgress.update({
    where: { userId },
    data: {
      totalSessions: { increment: 1 },
      totalTimeMinutes: { increment: timeMinutes },
      experiencePoints: totalXP,
      overallLevel: newLevel,
      categoryProgress,
      currentStreak,
      longestStreak: Math.max(progress.longestStreak, currentStreak),
      lastActivityAt: new Date(),
    },
  });
}
