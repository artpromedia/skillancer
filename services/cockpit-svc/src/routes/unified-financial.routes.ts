/**
 * Unified Financial Reporting API Routes
 */

import {
  PrismaClient,
  FinancialPeriodType,
  FinancialReportType,
  UnifiedTransactionSource,
} from '@skillancer/database';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { UnifiedTransactionRepository } from '../repositories/unified-transaction.repository';
import { ReportGeneratorService } from '../services/report-generator.service';
import { UnifiedFinancialService } from '../services/unified-financial.service';

const router = Router();
const prisma = new PrismaClient();
const financialService = new UnifiedFinancialService(prisma);
const reportService = new ReportGeneratorService(prisma);
const txRepo = new UnifiedTransactionRepository(prisma);

// Validation schemas
const TransactionFiltersSchema = z.object({
  sources: z.array(z.nativeEnum(UnifiedTransactionSource)).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  category: z.string().optional(),
  clientId: z.string().uuid().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

const ReportParamsSchema = z.object({
  reportType: z.nativeEnum(FinancialReportType),
  periodType: z.nativeEnum(FinancialPeriodType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  baseCurrency: z.string().length(3).default('USD'),
});

// GET /unified-financial/dashboard
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const currency = (req.query.currency as string) || 'USD';
    const dashboard = await financialService.getDashboard(userId, currency);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// GET /unified-financial/transactions
router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const filters = TransactionFiltersSchema.parse(req.query);
    const result = await txRepo.findMany(
      {
        userId,
        ...filters,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
      },
      { page: filters.page, pageSize: filters.pageSize }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /unified-financial/transactions/:id
router.get('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await txRepo.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (error) {
    next(error);
  }
});

// POST /unified-financial/reports/profit-loss
router.post('/reports/profit-loss', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const params = ReportParamsSchema.parse(req.body);
    const report = await reportService.generateProfitLoss({
      userId,
      reportType: FinancialReportType.PROFIT_LOSS,
      periodType: params.periodType,
      startDate: new Date(params.startDate),
      endDate: new Date(params.endDate),
      baseCurrency: params.baseCurrency,
    });
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// POST /unified-financial/reports/tax-summary
router.post('/reports/tax-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { taxYear, currency } = z
      .object({
        taxYear: z.number().min(2020).max(2030),
        currency: z.string().length(3).default('USD'),
      })
      .parse(req.body);

    const report = await reportService.generateTaxSummary(userId, taxYear, currency);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// GET /unified-financial/aggregates/by-source
router.get('/aggregates/by-source', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { startDate, endDate } = z
      .object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
      .parse(req.query);

    const aggregates = await txRepo.getAggregatesBySource(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(aggregates);
  } catch (error) {
    next(error);
  }
});

// GET /unified-financial/aggregates/by-category
router.get('/aggregates/by-category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { startDate, endDate } = z
      .object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
      .parse(req.query);

    const aggregates = await txRepo.getAggregatesByCategory(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(aggregates);
  } catch (error) {
    next(error);
  }
});

// GET /unified-financial/monthly-trend
router.get('/monthly-trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { months } = z.object({ months: z.number().min(1).max(24).default(12) }).parse(req.query);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const trend = await txRepo.getMonthlyTotals(userId, startDate, endDate);
    res.json(trend);
  } catch (error) {
    next(error);
  }
});

export default router;
