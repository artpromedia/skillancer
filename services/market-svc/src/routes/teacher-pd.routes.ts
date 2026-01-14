/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Teacher Professional Development (PD) Tracking Routes
 *
 * Provides endpoints for:
 * - Teacher profile management
 * - Certification tracking
 * - PD activity logging and verification
 * - PD plans and goal setting
 * - Portfolio management
 */

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

interface TeacherPDDependencies {
  prisma: PrismaClient;
  logger: Logger;
}

// =============================================================================
// Schemas
// =============================================================================

const teacherProfileSchema = z.object({
  currentRole: z.enum([
    'CLASSROOM_TEACHER',
    'SPECIAL_EDUCATION',
    'INTERVENTION_SPECIALIST',
    'INSTRUCTIONAL_COACH',
    'CURRICULUM_SPECIALIST',
    'DEPARTMENT_HEAD',
    'ASSISTANT_PRINCIPAL',
    'PRINCIPAL',
    'DISTRICT_ADMINISTRATOR',
    'OTHER',
  ]),
  gradeLevel: z.array(z.string()),
  subjects: z.array(z.string()),
  schoolName: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  annualPDHoursRequired: z.number().int().min(0).max(200).optional(),
});

const certificationSchema = z.object({
  type: z.enum([
    'TEACHING_LICENSE',
    'SUBJECT_ENDORSEMENT',
    'SPECIAL_EDUCATION',
    'GIFTED_EDUCATION',
    'ESL_ELL',
    'READING_SPECIALIST',
    'ADMINISTRATION',
    'NATIONAL_BOARD',
    'OTHER',
  ]),
  name: z.string().min(1).max(200),
  issuingAuthority: z.string().min(1).max(200),
  certificationNumber: z.string().optional(),
  issueDate: z.string().datetime(),
  expirationDate: z.string().datetime().optional(),
  renewalRequirements: z.string().optional(),
  renewalPDHours: z.number().int().optional(),
});

const pdActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  activityType: z.enum([
    'WORKSHOP',
    'CONFERENCE',
    'WEBINAR',
    'COURSE',
    'SELF_STUDY',
    'BOOK_STUDY',
    'PEER_OBSERVATION',
    'MENTORING',
    'ACTION_RESEARCH',
    'PROFESSIONAL_LEARNING_COMMUNITY',
    'CERTIFICATION_PROGRAM',
    'GRADUATE_COURSE',
    'OTHER',
  ]),
  category: z.enum([
    'INSTRUCTIONAL_STRATEGIES',
    'CONTENT_KNOWLEDGE',
    'ASSESSMENT',
    'TECHNOLOGY',
    'CLASSROOM_MANAGEMENT',
    'SPECIAL_EDUCATION',
    'ELL_ESL',
    'SOCIAL_EMOTIONAL_LEARNING',
    'EQUITY_INCLUSION',
    'LEADERSHIP',
    'FAMILY_ENGAGEMENT',
    'DATA_LITERACY',
    'CURRICULUM_DEVELOPMENT',
    'STUDENT_SUPPORT',
    'PROFESSIONAL_ETHICS',
    'OTHER',
  ]),
  provider: z.string().optional(),
  providerType: z
    .enum([
      'SCHOOL_DISTRICT',
      'STATE_AGENCY',
      'UNIVERSITY',
      'PROFESSIONAL_ORGANIZATION',
      'VENDOR',
      'ONLINE_PLATFORM',
      'PEER_LED',
      'SELF_DIRECTED',
      'OTHER',
    ])
    .optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  totalHours: z.number().min(0.5).max(500),
  verificationCode: z.string().optional(),
  certificateUrl: z.string().url().optional(),
  learningOutcomes: z.array(z.string()).optional(),
  reflections: z.string().optional(),
  applicationPlan: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const pdPlanSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
  targetHours: z.number().int().min(1).max(500),
  focusAreas: z.array(z.string()),
});

const pdPlanItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string(),
  targetHours: z.number().int().min(1).max(100),
  targetQuarter: z.string().optional(),
  targetMonth: z.string().optional(),
});

const professionalGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string(),
  targetDate: z.string().datetime().optional(),
  milestones: z.array(z.object({ title: z.string(), completed: z.boolean() })).optional(),
});

// =============================================================================
// Route Registration
// =============================================================================

export function registerTeacherPDRoutes(
  fastify: FastifyInstance,
  deps: TeacherPDDependencies
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
  // Teacher Profile Routes
  // -------------------------------------------------------------------------

  /**
   * GET /teacher-pd/profile - Get teacher profile
   */
  fastify.get('/profile', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching teacher profile');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
        include: {
          certifications: {
            orderBy: { expirationDate: 'asc' },
          },
        },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      return reply.send({
        success: true,
        data: {
          id: profile.id,
          currentRole: profile.currentRole,
          gradeLevel: profile.gradeLevel,
          subjects: profile.subjects,
          schoolName: profile.schoolName,
          district: profile.district,
          state: profile.state,
          annualPDHoursRequired: profile.annualPDHoursRequired,
          currentPDYearStart: profile.currentPDYearStart?.toISOString(),
          certifications: profile.certifications.map((c: any) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            issuingAuthority: c.issuingAuthority,
            certificationNumber: c.certificationNumber,
            issueDate: c.issueDate.toISOString(),
            expirationDate: c.expirationDate?.toISOString(),
            status: c.status,
            renewalRequirements: c.renewalRequirements,
            renewalPDHours: c.renewalPDHours,
          })),
          createdAt: profile.createdAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch teacher profile');
      return reply.status(500).send({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * POST /teacher-pd/profile - Create teacher profile
   */
  fastify.post('/profile', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = teacherProfileSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating teacher profile');

      const existingProfile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (existingProfile) {
        return reply.status(409).send({ error: 'Teacher profile already exists' });
      }

      const profile = await prisma.teacherProfile.create({
        data: {
          userId,
          ...validation.data,
          currentPDYearStart: new Date(new Date().getFullYear(), 6, 1), // July 1st
        },
      });

      return reply.status(201).send({
        success: true,
        data: profile,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create teacher profile');
      return reply.status(500).send({ error: 'Failed to create profile' });
    }
  });

  /**
   * PATCH /teacher-pd/profile - Update teacher profile
   */
  fastify.patch('/profile', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Updating teacher profile');

      const profile = await prisma.teacherProfile.update({
        where: { userId },
        data: request.body,
      });

      return reply.send({
        success: true,
        data: profile,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to update teacher profile');
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });

  // -------------------------------------------------------------------------
  // Certification Routes
  // -------------------------------------------------------------------------

  /**
   * POST /teacher-pd/certifications - Add certification
   */
  fastify.post('/certifications', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = certificationSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Adding certification');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found. Please create a profile first.' });
      }

      const certification = await prisma.teacherCertification.create({
        data: {
          teacherId: profile.id,
          ...validation.data,
          issueDate: new Date(validation.data.issueDate),
          expirationDate: validation.data.expirationDate
            ? new Date(validation.data.expirationDate)
            : null,
          status: 'ACTIVE',
        },
      });

      return reply.status(201).send({
        success: true,
        data: certification,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to add certification');
      return reply.status(500).send({ error: 'Failed to add certification' });
    }
  });

  /**
   * DELETE /teacher-pd/certifications/:id - Remove certification
   */
  fastify.delete<{ Params: { id: string } }>(
    '/certifications/:id',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { id } = request.params;

        logger.info({ userId, certificationId: id }, 'Removing certification');

        const profile = await prisma.teacherProfile.findUnique({
          where: { userId },
        });

        if (!profile) {
          return reply.status(404).send({ error: 'Teacher profile not found' });
        }

        await prisma.teacherCertification.deleteMany({
          where: { id, teacherId: profile.id },
        });

        return reply.send({ success: true, message: 'Certification removed' });
      } catch (error) {
        logger.error({ error }, 'Failed to remove certification');
        return reply.status(500).send({ error: 'Failed to remove certification' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // PD Activity Routes
  // -------------------------------------------------------------------------

  /**
   * GET /teacher-pd/activities - List PD activities
   */
  fastify.get('/activities', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;
      const { status, category, page = '1', limit = '20' } = request.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

      logger.info({ userId, status, category }, 'Fetching PD activities');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      const where: Record<string, unknown> = { teacherId: profile.id };
      if (status) where.status = status;
      if (category) where.category = category;

      const [activities, total] = await Promise.all([
        prisma.pDActivity.findMany({
          where,
          orderBy: { startDate: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.pDActivity.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: activities.map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          activityType: a.activityType,
          category: a.category,
          provider: a.provider,
          startDate: a.startDate.toISOString(),
          endDate: a.endDate?.toISOString(),
          totalHours: Number(a.totalHours),
          status: a.status,
          certificateUrl: a.certificateUrl,
          learningOutcomes: a.learningOutcomes,
          tags: a.tags,
          createdAt: a.createdAt.toISOString(),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch PD activities');
      return reply.status(500).send({ error: 'Failed to fetch activities' });
    }
  });

  /**
   * POST /teacher-pd/activities - Log PD activity
   */
  fastify.post('/activities', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = pdActivitySchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Logging PD activity');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      const data = validation.data;
      const activity = await prisma.pDActivity.create({
        data: {
          teacherId: profile.id,
          title: data.title,
          description: data.description,
          activityType: data.activityType,
          category: data.category,
          provider: data.provider,
          providerType: data.providerType,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          totalHours: data.totalHours,
          verificationCode: data.verificationCode,
          certificateUrl: data.certificateUrl,
          learningOutcomes: data.learningOutcomes ?? [],
          reflections: data.reflections,
          applicationPlan: data.applicationPlan,
          tags: data.tags ?? [],
          status: 'PENDING',
        },
      });

      return reply.status(201).send({
        success: true,
        data: activity,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to log PD activity');
      return reply.status(500).send({ error: 'Failed to log activity' });
    }
  });

  /**
   * GET /teacher-pd/activities/:id - Get activity details
   */
  fastify.get<{ Params: { id: string } }>(
    '/activities/:id',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { id } = request.params;

        logger.info({ userId, activityId: id }, 'Fetching PD activity details');

        const profile = await prisma.teacherProfile.findUnique({
          where: { userId },
        });

        if (!profile) {
          return reply.status(404).send({ error: 'Teacher profile not found' });
        }

        const activity = await prisma.pDActivity.findFirst({
          where: { id, teacherId: profile.id },
        });

        if (!activity) {
          return reply.status(404).send({ error: 'Activity not found' });
        }

        return reply.send({
          success: true,
          data: {
            ...activity,
            totalHours: Number(activity.totalHours),
            startDate: activity.startDate.toISOString(),
            endDate: activity.endDate?.toISOString(),
          },
        });
      } catch (error) {
        logger.error({ error }, 'Failed to fetch activity');
        return reply.status(500).send({ error: 'Failed to fetch activity' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // PD Summary and Progress Routes
  // -------------------------------------------------------------------------

  /**
   * GET /teacher-pd/summary - Get PD summary for current year
   */
  fastify.get('/summary', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching PD summary');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
        include: {
          certifications: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      // Get current PD year dates
      const yearStart = profile.currentPDYearStart ?? new Date(new Date().getFullYear(), 6, 1);
      const yearEnd = new Date(yearStart);
      yearEnd.setFullYear(yearEnd.getFullYear() + 1);

      // Get activities for current year
      const activities = await prisma.pDActivity.findMany({
        where: {
          teacherId: profile.id,
          startDate: { gte: yearStart, lt: yearEnd },
          status: { in: ['COMPLETED', 'VERIFIED'] },
        },
      });

      // Calculate totals
      const totalHours = activities.reduce((sum: number, a: any) => sum + Number(a.totalHours), 0);

      // Category breakdown
      const categoryBreakdown = activities.reduce(
        (acc: any, a: any) => {
          if (!acc[a.category]) {
            acc[a.category] = { hours: 0, count: 0 };
          }
          acc[a.category].hours += Number(a.totalHours);
          acc[a.category].count++;
          return acc;
        },
        {} as Record<string, { hours: number; count: number }>
      );

      // Upcoming certification renewals
      const upcomingRenewals = profile.certifications.filter((c: any) => {
        if (!c.expirationDate) return false;
        const monthsUntilExpiry =
          (c.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
        return monthsUntilExpiry <= 12;
      });

      return reply.send({
        success: true,
        data: {
          currentYear: {
            start: yearStart.toISOString(),
            end: yearEnd.toISOString(),
          },
          progress: {
            completedHours: totalHours,
            requiredHours: profile.annualPDHoursRequired,
            progressPercent: Math.round(
              (totalHours / profile.annualPDHoursRequired) * 100
            ),
            activitiesCount: activities.length,
          },
          categoryBreakdown: Object.entries(categoryBreakdown).map(
            ([category, data]: [string, any]) => ({
              category,
              hours: data.hours,
              activitiesCount: data.count,
            })
          ),
          upcomingRenewals: upcomingRenewals.map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            expirationDate: c.expirationDate?.toISOString(),
            renewalPDHours: c.renewalPDHours,
          })),
          recentActivities: activities.slice(0, 5).map((a: any) => ({
            id: a.id,
            title: a.title,
            category: a.category,
            hours: Number(a.totalHours),
            date: a.startDate.toISOString(),
          })),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch PD summary');
      return reply.status(500).send({ error: 'Failed to fetch summary' });
    }
  });

  // -------------------------------------------------------------------------
  // PD Plan Routes
  // -------------------------------------------------------------------------

  /**
   * GET /teacher-pd/plans - List PD plans
   */
  fastify.get('/plans', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching PD plans');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      const plans = await prisma.pDPlan.findMany({
        where: { teacherId: profile.id },
        include: { items: true },
        orderBy: { schoolYear: 'desc' },
      });

      return reply.send({
        success: true,
        data: plans.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          schoolYear: p.schoolYear,
          targetHours: p.targetHours,
          completedHours: Number(p.completedHours),
          focusAreas: p.focusAreas,
          status: p.status,
          itemsCount: p.items.length,
          completedItemsCount: p.items.filter((i: any) => i.status === 'COMPLETED').length,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch PD plans');
      return reply.status(500).send({ error: 'Failed to fetch plans' });
    }
  });

  /**
   * POST /teacher-pd/plans - Create PD plan
   */
  fastify.post('/plans', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = pdPlanSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating PD plan');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      const plan = await prisma.pDPlan.create({
        data: {
          teacherId: profile.id,
          ...validation.data,
          status: 'DRAFT',
        },
      });

      return reply.status(201).send({
        success: true,
        data: plan,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create PD plan');
      return reply.status(500).send({ error: 'Failed to create plan' });
    }
  });

  /**
   * POST /teacher-pd/plans/:planId/items - Add item to PD plan
   */
  fastify.post<{ Params: { planId: string } }>(
    '/plans/:planId/items',
    async (request: any, reply: any) => {
      try {
        const user = getUser(request);
        const userId = user.id;
        const { planId } = request.params;

        const validation = pdPlanItemSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
        }

        logger.info({ userId, planId }, 'Adding item to PD plan');

        const profile = await prisma.teacherProfile.findUnique({
          where: { userId },
        });

        if (!profile) {
          return reply.status(404).send({ error: 'Teacher profile not found' });
        }

        const plan = await prisma.pDPlan.findFirst({
          where: { id: planId, teacherId: profile.id },
        });

        if (!plan) {
          return reply.status(404).send({ error: 'PD plan not found' });
        }

        const item = await prisma.pDPlanItem.create({
          data: {
            planId,
            ...validation.data,
            status: 'PLANNED',
          },
        });

        return reply.status(201).send({
          success: true,
          data: item,
        });
      } catch (error) {
        logger.error({ error }, 'Failed to add plan item');
        return reply.status(500).send({ error: 'Failed to add plan item' });
      }
    }
  );

  // -------------------------------------------------------------------------
  // Professional Goals Routes
  // -------------------------------------------------------------------------

  /**
   * GET /teacher-pd/goals - List professional goals
   */
  fastify.get('/goals', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      logger.info({ userId }, 'Fetching professional goals');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      const goals = await prisma.teacherProfessionalGoal.findMany({
        where: { teacherId: profile.id },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: goals.map((g: any) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          category: g.category,
          startDate: g.startDate.toISOString(),
          targetDate: g.targetDate?.toISOString(),
          status: g.status,
          progress: g.progress,
          milestones: g.milestones,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to fetch goals');
      return reply.status(500).send({ error: 'Failed to fetch goals' });
    }
  });

  /**
   * POST /teacher-pd/goals - Create professional goal
   */
  fastify.post('/goals', async (request: any, reply: any) => {
    try {
      const user = getUser(request);
      const userId = user.id;

      const validation = professionalGoalSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      logger.info({ userId }, 'Creating professional goal');

      const profile = await prisma.teacherProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Teacher profile not found' });
      }

      const data = validation.data;
      const goal = await prisma.teacherProfessionalGoal.create({
        data: {
          teacherId: profile.id,
          title: data.title,
          description: data.description,
          category: data.category,
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          milestones: data.milestones ?? [],
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

  // -------------------------------------------------------------------------
  // PD Categories
  // -------------------------------------------------------------------------

  /**
   * GET /teacher-pd/categories - Get PD categories
   */
  fastify.get('/categories', async (_request: any, reply: any) => {
    const categories = [
      { id: 'INSTRUCTIONAL_STRATEGIES', name: 'Instructional Strategies', icon: 'book-open' },
      { id: 'CONTENT_KNOWLEDGE', name: 'Content Knowledge', icon: 'graduation-cap' },
      { id: 'ASSESSMENT', name: 'Assessment', icon: 'clipboard-check' },
      { id: 'TECHNOLOGY', name: 'Technology Integration', icon: 'laptop' },
      { id: 'CLASSROOM_MANAGEMENT', name: 'Classroom Management', icon: 'users' },
      { id: 'SPECIAL_EDUCATION', name: 'Special Education', icon: 'heart' },
      { id: 'ELL_ESL', name: 'English Language Learners', icon: 'globe' },
      { id: 'SOCIAL_EMOTIONAL_LEARNING', name: 'Social-Emotional Learning', icon: 'smile' },
      { id: 'EQUITY_INCLUSION', name: 'Equity & Inclusion', icon: 'balance-scale' },
      { id: 'LEADERSHIP', name: 'Leadership', icon: 'flag' },
      { id: 'FAMILY_ENGAGEMENT', name: 'Family Engagement', icon: 'home' },
      { id: 'DATA_LITERACY', name: 'Data Literacy', icon: 'chart-bar' },
      { id: 'CURRICULUM_DEVELOPMENT', name: 'Curriculum Development', icon: 'file-text' },
      { id: 'STUDENT_SUPPORT', name: 'Student Support Services', icon: 'life-buoy' },
      { id: 'PROFESSIONAL_ETHICS', name: 'Professional Ethics', icon: 'shield' },
      { id: 'OTHER', name: 'Other', icon: 'more-horizontal' },
    ];

    return reply.send({ success: true, data: categories });
  });
}
