/**
 * @module @skillancer/executive-svc/routes/financial
 * Financial Routes for CFO Tool Suite
 *
 * API endpoints for:
 * - Cash flow forecasts
 * - Runway calculations
 * - Board deck management
 * - Investor updates
 * - Budget management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@skillancer/database';
import {
  createFinancialModelService,
  type ForecastAssumptions,
  type ExpenseItem,
  type OneTimeItem,
} from '../services/financial-model.service.js';
import {
  createRunwayCalculatorService,
  type HiringPlanItem,
} from '../services/runway-calculator.service.js';

// ==================== Validation Schemas ====================

const expenseItemSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'annual']),
  category: z.string(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const oneTimeItemSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime(),
  type: z.enum(['inflow', 'outflow']),
  category: z.string(),
  probability: z.number().min(0).max(1).optional(),
});

const createForecastSchema = z.object({
  engagementId: z.string().uuid(),
  startingCash: z.number().positive(),
  startDate: z.string().datetime().optional(),
  weeks: z.number().int().positive().max(104).optional(),
  revenueAssumptions: z.object({
    monthlyGrowthRate: z.number(),
    seasonality: z.record(z.number()).optional(),
    churnRate: z.number().optional(),
    arpu: z.number().optional(),
  }),
  expenseAssumptions: z.object({
    fixed: z.array(expenseItemSchema),
    variable: z.array(expenseItemSchema),
    growthRate: z.number().optional(),
  }),
  oneTimeItems: z.array(oneTimeItemSchema).optional(),
  includeScenarios: z.boolean().optional(),
});

const runwayCalculationSchema = z.object({
  currentCash: z.number().positive(),
  monthlyRevenue: z.number().min(0),
  monthlyExpenses: z.number().positive(),
  revenueGrowthRate: z.number().optional(),
  expenseGrowthRate: z.number().optional(),
});

const runwayScenariosSchema = z.object({
  engagementId: z.string().uuid(),
  ...runwayCalculationSchema.shape,
});

const hiringPlanItemSchema = z.object({
  role: z.string().min(1),
  monthlyCost: z.number().positive(),
  startMonth: z.number().int().positive(),
});

const runwayWithHiringSchema = z.object({
  ...runwayCalculationSchema.shape,
  hiringPlan: z.array(hiringPlanItemSchema),
});

const createBoardDeckSchema = z.object({
  engagementId: z.string().uuid(),
  title: z.string().min(1).max(200),
  period: z.string().min(1),
  templateId: z.string().optional(),
  slides: z
    .array(
      z.object({
        order: z.number().int(),
        type: z.string(),
        title: z.string(),
        content: z.record(z.unknown()),
      })
    )
    .optional(),
});

const updateBoardDeckSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slides: z
    .array(
      z.object({
        order: z.number().int(),
        type: z.string(),
        title: z.string(),
        content: z.record(z.unknown()),
      })
    )
    .optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'SENT', 'ARCHIVED']).optional(),
  pdfUrl: z.string().url().optional(),
  googleSlidesUrl: z.string().url().optional(),
  pptxUrl: z.string().url().optional(),
});

const createInvestorUpdateSchema = z.object({
  engagementId: z.string().uuid(),
  period: z.string().min(1),
  subject: z.string().min(1).max(200),
  content: z.object({
    highlights: z.array(z.string()).optional(),
    metrics: z
      .array(
        z.object({
          name: z.string(),
          value: z.string(),
          change: z.string().optional(),
        })
      )
      .optional(),
    challenges: z.array(z.string()).optional(),
    asks: z.array(z.string()).optional(),
    body: z.string().optional(),
  }),
  scheduledFor: z.string().datetime().optional(),
  recipients: z.array(z.string()).optional(),
});

const updateInvestorUpdateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  content: z.record(z.unknown()).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT']).optional(),
  scheduledFor: z.string().datetime().optional(),
  recipients: z.array(z.string()).optional(),
});

const createBudgetSchema = z.object({
  engagementId: z.string().uuid(),
  name: z.string().min(1).max(200),
  fiscalYear: z.number().int().min(2020).max(2100),
  categories: z.array(
    z.object({
      name: z.string(),
      budgeted: z.number(),
      actual: z.number().optional(),
      notes: z.string().optional(),
    })
  ),
  totalBudget: z.number().positive(),
});

const updateBudgetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  categories: z
    .array(
      z.object({
        name: z.string(),
        budgeted: z.number(),
        actual: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  totalBudget: z.number().positive().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED']).optional(),
});

// ==================== Route Registration ====================

export async function financialRoutes(fastify: FastifyInstance) {
  const financialModelService = createFinancialModelService(prisma);
  const runwayService = createRunwayCalculatorService(prisma);

  // ==================== Cash Flow Forecast Routes ====================

  // Create cash flow forecast
  fastify.post('/forecasts', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createForecastSchema.parse(request.body);

    const result = await financialModelService.createForecast({
      engagementId: body.engagementId,
      startingCash: body.startingCash,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      weeks: body.weeks,
      revenueAssumptions: {
        monthlyGrowthRate: body.revenueAssumptions.monthlyGrowthRate,
        seasonality: body.revenueAssumptions.seasonality as Record<number, number> | undefined,
        churnRate: body.revenueAssumptions.churnRate,
        arpu: body.revenueAssumptions.arpu,
      },
      expenseAssumptions: {
        fixed: body.expenseAssumptions.fixed as unknown as ExpenseItem[],
        variable: body.expenseAssumptions.variable as unknown as ExpenseItem[],
        growthRate: body.expenseAssumptions.growthRate,
      },
      oneTimeItems: body.oneTimeItems?.map((item) => ({
        ...item,
        date: new Date(item.date),
      })) as OneTimeItem[],
      includeScenarios: body.includeScenarios,
    });

    return reply.status(201).send({ success: true, data: result });
  });

  // Get forecasts for engagement
  fastify.get('/forecasts/:engagementId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { engagementId } = request.params as { engagementId: string };
    const forecasts = await financialModelService.getForecasts(engagementId);
    return reply.send({ success: true, data: forecasts });
  });

  // Get latest forecast
  fastify.get(
    '/forecasts/:engagementId/latest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { engagementId } = request.params as { engagementId: string };
      const forecast = await financialModelService.getLatestForecast(engagementId);
      if (!forecast) {
        return reply.status(404).send({ success: false, error: 'No forecast found' });
      }
      return reply.send({ success: true, data: forecast });
    }
  );

  // ==================== Runway Calculation Routes ====================

  // Calculate runway
  fastify.post('/runway/calculate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = runwayCalculationSchema.parse(request.body);
    const result = runwayService.calculateRunway({
      currentCash: body.currentCash,
      monthlyRevenue: body.monthlyRevenue,
      monthlyExpenses: body.monthlyExpenses,
      revenueGrowthRate: body.revenueGrowthRate,
      expenseGrowthRate: body.expenseGrowthRate,
    });
    return reply.send({ success: true, data: result });
  });

  // Generate runway scenarios
  fastify.post('/runway/scenarios', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = runwayScenariosSchema.parse(request.body);
    const scenarios = runwayService.generateScenarios({
      currentCash: body.currentCash,
      monthlyRevenue: body.monthlyRevenue,
      monthlyExpenses: body.monthlyExpenses,
      revenueGrowthRate: body.revenueGrowthRate,
      expenseGrowthRate: body.expenseGrowthRate,
    });
    return reply.send({ success: true, data: scenarios });
  });

  // Calculate runway with hiring plan
  fastify.post('/runway/with-hiring', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = runwayWithHiringSchema.parse(request.body);
    const result = runwayService.calculateWithHiring(
      {
        currentCash: body.currentCash,
        monthlyRevenue: body.monthlyRevenue,
        monthlyExpenses: body.monthlyExpenses,
        revenueGrowthRate: body.revenueGrowthRate,
        expenseGrowthRate: body.expenseGrowthRate,
      },
      body.hiringPlan as HiringPlanItem[]
    );
    return reply.send({ success: true, data: result });
  });

  // Check "default alive" status
  fastify.post('/runway/default-alive', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = runwayCalculationSchema.parse(request.body);
    const result = runwayService.isDefaultAlive({
      currentCash: body.currentCash,
      monthlyRevenue: body.monthlyRevenue,
      monthlyExpenses: body.monthlyExpenses,
      revenueGrowthRate: body.revenueGrowthRate,
      expenseGrowthRate: body.expenseGrowthRate,
    });
    return reply.send({ success: true, data: result });
  });

  // ==================== Board Deck Routes ====================

  // Create board deck
  fastify.post('/board-decks', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createBoardDeckSchema.parse(request.body);

    const deck = await prisma.boardDeck.create({
      data: {
        engagementId: body.engagementId,
        title: body.title,
        period: body.period,
        templateId: body.templateId,
        slides: (body.slides || []) as any,
        status: 'DRAFT',
      },
    });

    return reply.status(201).send({ success: true, data: deck });
  });

  // Get board decks for engagement
  fastify.get(
    '/board-decks/:engagementId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { engagementId } = request.params as { engagementId: string };

      const decks = await prisma.boardDeck.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ success: true, data: decks });
    }
  );

  // Get single board deck
  fastify.get('/board-decks/deck/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const deck = await prisma.boardDeck.findUnique({
      where: { id },
    });

    if (!deck) {
      return reply.status(404).send({ success: false, error: 'Board deck not found' });
    }

    return reply.send({ success: true, data: deck });
  });

  // Update board deck
  fastify.patch('/board-decks/deck/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateBoardDeckSchema.parse(request.body);

    const deck = await prisma.boardDeck.update({
      where: { id },
      data: body as any,
    });

    return reply.send({ success: true, data: deck });
  });

  // Delete board deck
  fastify.delete('/board-decks/deck/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    await prisma.boardDeck.delete({
      where: { id },
    });

    return reply.status(204).send();
  });

  // ==================== Investor Update Routes ====================

  // Create investor update
  fastify.post('/investor-updates', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createInvestorUpdateSchema.parse(request.body);

    const update = await prisma.investorUpdate.create({
      data: {
        engagementId: body.engagementId,
        period: body.period,
        subject: body.subject,
        content: body.content,
        status: body.scheduledFor ? 'SCHEDULED' : 'DRAFT',
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        recipients: body.recipients || [],
      },
    });

    return reply.status(201).send({ success: true, data: update });
  });

  // Get investor updates for engagement
  fastify.get(
    '/investor-updates/:engagementId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { engagementId } = request.params as { engagementId: string };

      const updates = await prisma.investorUpdate.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ success: true, data: updates });
    }
  );

  // Update investor update
  fastify.patch('/investor-updates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateInvestorUpdateSchema.parse(request.body);

    const update = await prisma.investorUpdate.update({
      where: { id },
      data: {
        ...body,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      } as any,
    });

    return reply.send({ success: true, data: update });
  });

  // Send investor update
  fastify.post(
    '/investor-updates/:id/send',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const update = await prisma.investorUpdate.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // TODO: Integrate with notification service to actually send emails

      return reply.send({ success: true, data: update, message: 'Update sent successfully' });
    }
  );

  // ==================== Budget Routes ====================

  // Create budget
  fastify.post('/budgets', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createBudgetSchema.parse(request.body);

    const budget = await prisma.budget.create({
      data: {
        engagementId: body.engagementId,
        name: body.name,
        fiscalYear: body.fiscalYear,
        categories: body.categories,
        totalBudget: body.totalBudget,
        status: 'DRAFT',
      },
    });

    return reply.status(201).send({ success: true, data: budget });
  });

  // Get budgets for engagement
  fastify.get('/budgets/:engagementId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { engagementId } = request.params as { engagementId: string };

    const budgets = await prisma.budget.findMany({
      where: { engagementId },
      orderBy: { fiscalYear: 'desc' },
    });

    return reply.send({ success: true, data: budgets });
  });

  // Update budget
  fastify.patch('/budgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateBudgetSchema.parse(request.body);

    const budget = await prisma.budget.update({
      where: { id },
      data: body,
    });

    return reply.send({ success: true, data: budget });
  });

  // Approve budget
  fastify.post('/budgets/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { approvedBy } = request.body as { approvedBy?: string };

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });

    return reply.send({ success: true, data: budget });
  });

  // Delete budget
  fastify.delete('/budgets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    await prisma.budget.delete({
      where: { id },
    });

    return reply.status(204).send();
  });
}

export default financialRoutes;
