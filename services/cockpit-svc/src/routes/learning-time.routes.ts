// @ts-nocheck
/**
 * Learning Time API Routes
 */

import { PrismaClient, LearningGoalType, GoalPeriodType, GoalStatus } from '@skillancer/database';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { LearningGoalRepository } from '../repositories/learning-goal.repository.js';
import { LearningTimeEntryRepository } from '../repositories/learning-time-entry.repository.js';
import { SkillLearningProgressRepository } from '../repositories/skill-learning-progress.repository.js';

const router = Router();
const prisma = new PrismaClient();
const timeRepo = new LearningTimeEntryRepository(prisma);
const goalRepo = new LearningGoalRepository(prisma);
const skillRepo = new SkillLearningProgressRepository(prisma);

// GET /learning/dashboard
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [weekEntries, monthEntries, yearEntries, goals, skills, recent] = await Promise.all([
      timeRepo.findByDateRange(userId, weekStart, now),
      timeRepo.findByDateRange(userId, monthStart, now),
      timeRepo.findByDateRange(userId, yearStart, now),
      goalRepo.findByUser(userId, { status: [GoalStatus.ACTIVE] }),
      skillRepo.findByUser(userId),
      timeRepo.findRecent(userId, 10),
    ]);

    const weekMinutes = weekEntries.reduce((sum, e) => sum + e.activeMinutes, 0);
    const monthMinutes = monthEntries.reduce((sum, e) => sum + e.activeMinutes, 0);
    const yearMinutes = yearEntries.reduce((sum, e) => sum + e.activeMinutes, 0);

    res.json({
      thisWeek: {
        totalHours: Math.round((weekMinutes / 60) * 10) / 10,
        lessonsCompleted: weekEntries.filter((e) => e.isCompleted).length,
      },
      thisMonth: {
        totalHours: Math.round((monthMinutes / 60) * 10) / 10,
      },
      yearToDate: {
        totalHours: Math.round((yearMinutes / 60) * 10) / 10,
      },
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        goalType: g.goalType,
        targetValue: Number(g.targetValue),
        currentValue: Number(g.currentValue),
        progressPercent: Number(g.progressPercent),
        periodEnd: g.periodEnd,
      })),
      topSkills: skills.slice(0, 5).map((s) => ({
        skillId: s.skillId,
        skillName: s.skillName,
        totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
        level: s.currentLevel,
      })),
      recentActivity: recent.map((e) => ({
        id: e.id,
        date: e.date,
        contentTitle: e.contentTitle,
        contentType: e.contentType,
        duration: e.activeMinutes,
        skills: e.skillNames,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /learning/time-entries
router.get('/time-entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { startDate, endDate, limit } = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        limit: z.coerce.number().min(1).max(100).default(50),
      })
      .parse(req.query);

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end = endDate ? new Date(endDate) : new Date();

    const entries = await timeRepo.findByDateRange(userId, start, end);

    res.json({
      entries: entries.slice(0, limit).map((e) => ({
        id: e.id,
        date: e.date,
        contentTitle: e.contentTitle,
        contentType: e.contentType,
        courseTitle: e.courseTitle,
        totalMinutes: e.totalMinutes,
        activeMinutes: e.activeMinutes,
        skills: e.skillNames,
        isCompleted: e.isCompleted,
        progressGained: Number(e.progressGained),
      })),
      total: entries.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /learning/goals
router.post('/goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = z
      .object({
        goalType: z.nativeEnum(LearningGoalType),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        targetValue: z.number().positive(),
        targetUnit: z.string(),
        targetSkillId: z.string().optional(),
        targetSkillName: z.string().optional(),
        targetCourseId: z.string().optional(),
        targetCertificationId: z.string().optional(),
        periodType: z.nativeEnum(GoalPeriodType),
        reminderEnabled: z.boolean().default(true),
      })
      .parse(req.body);

    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now);

    if (body.periodType === 'WEEKLY') {
      periodEnd.setDate(periodEnd.getDate() + 7);
    } else if (body.periodType === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (body.periodType === 'QUARTERLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 3);
    } else if (body.periodType === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const goal = await goalRepo.create({
      userId,
      goalType: body.goalType,
      title: body.title,
      description: body.description,
      targetValue: body.targetValue,
      targetUnit: body.targetUnit,
      targetSkillId: body.targetSkillId,
      targetSkillName: body.targetSkillName,
      targetCourseId: body.targetCourseId,
      targetCertificationId: body.targetCertificationId,
      periodType: body.periodType,
      periodStart,
      periodEnd,
      reminderEnabled: body.reminderEnabled,
    });

    res.status(201).json({ goal });
  } catch (error) {
    next(error);
  }
});

// GET /learning/goals
router.get('/goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { status } = z
      .object({ status: z.array(z.nativeEnum(GoalStatus)).optional() })
      .parse(req.query);

    const goals = await goalRepo.findByUser(userId, { status });

    res.json({
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        goalType: g.goalType,
        targetValue: Number(g.targetValue),
        currentValue: Number(g.currentValue),
        progressPercent: Number(g.progressPercent),
        targetUnit: g.targetUnit,
        status: g.status,
        periodStart: g.periodStart,
        periodEnd: g.periodEnd,
        achievedAt: g.achievedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /learning/skills
router.get('/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const skills = await skillRepo.findByUser(userId);

    res.json({
      skills: skills.map((s) => ({
        skillId: s.skillId,
        skillName: s.skillName,
        totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
        currentLevel: s.currentLevel,
        coursesCompleted: s.coursesCompleted,
        assessmentsPassed: s.assessmentsPassed,
        credentialsEarned: s.credentialsEarned.length,
        lastLearningDate: s.lastLearningDate,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
