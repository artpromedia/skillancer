// @ts-nocheck
/**
 * Tax API Routes
 * Endpoints for tax vault, estimates, and quarterly payments
 * Sprint M5: Freelancer Financial Services
 */

import { logger } from '@skillancer/logger';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { getQuarterlyRemindersService } from '../tax/quarterly-reminders.js';
import { getTaxCalculator } from '../tax/tax-calculator.js';
import { getTaxVaultService } from '../tax/tax-vault-service.js';

const router = Router();
const taxVaultService = getTaxVaultService();
const taxCalculator = getTaxCalculator();
const quarterlyReminders = getQuarterlyRemindersService();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateVaultSettingsSchema = z.object({
  savingsRate: z.number().min(0).max(50).optional(),
  autoSaveEnabled: z.boolean().optional(),
  autoAdjust: z.boolean().optional(),
  minimumSavePercentage: z.number().min(0).max(30).optional(),
  maximumSavePercentage: z.number().min(20).max(50).optional(),
  roundUp: z.boolean().optional(),
  notifyOnDeposit: z.boolean().optional(),
  notifyOnQuarterlyReminder: z.boolean().optional(),
});

const manualDepositSchema = z.object({
  amount: z.number().min(1).max(50000),
  note: z.string().max(255).optional(),
});

const withdrawalSchema = z.object({
  amount: z.number().min(1),
  reason: z.string().min(1).max(500),
});

const quarterlyPaymentSchema = z.object({
  amount: z.number().min(1),
  quarter: z.number().min(1).max(4),
  year: z.number().min(2020).max(2030),
});

const taxEstimateOptionsSchema = z.object({
  year: z.number().min(2020).max(2030).optional(),
  filingStatus: z
    .enum(['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'])
    .optional(),
  state: z.string().length(2).optional(),
  additionalIncome: z.number().optional(),
  additionalDeductions: z
    .object({
      retirementContributions: z.number().optional(),
      healthInsurance: z.number().optional(),
      homeOffice: z.number().optional(),
      other: z.number().optional(),
    })
    .optional(),
});

const reminderPreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  daysBeforeDue: z.array(z.number().min(1).max(90)).optional(),
  channels: z.array(z.enum(['email', 'push', 'sms', 'in_app'])).optional(),
  includePaymentLink: z.boolean().optional(),
  customMessage: z.string().max(500).optional(),
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };
};

// ============================================================================
// TAX VAULT ROUTES
// ============================================================================

/**
 * GET /taxes/vault
 * Get tax vault details
 */
router.get('/vault', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const vault = await taxVaultService.getOrCreateVault(userId);

    res.json({ vault });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /taxes/vault/summary
 * Get tax vault summary with yearly totals
 */
router.get(
  '/vault/summary',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const summary = await taxVaultService.getVaultSummary(userId);

      res.json({ summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /taxes/vault/settings
 * Update tax vault settings
 */
router.put(
  '/vault/settings',
  authenticate,
  validateBody(updateVaultSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const vault = await taxVaultService.updateSettings(userId, req.body);

      logger.info('Tax vault settings updated via API', { userId });

      res.json({ vault });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /taxes/vault/deposit
 * Manual deposit to tax vault
 */
router.post(
  '/vault/deposit',
  authenticate,
  validateBody(manualDepositSchema),
  rateLimit({ windowMs: 60000, max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, note } = req.body;

      const transaction = await taxVaultService.manualDeposit(userId, amount, note);

      logger.info('Tax vault deposit via API', { userId, amount });

      res.status(201).json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /taxes/vault/withdraw
 * Withdraw from tax vault
 */
router.post(
  '/vault/withdraw',
  authenticate,
  validateBody(withdrawalSchema),
  rateLimit({ windowMs: 60000, max: 5 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, reason } = req.body;

      const transaction = await taxVaultService.withdraw(userId, amount, reason);

      logger.info('Tax vault withdrawal via API', { userId, amount, reason });

      res.json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/vault/transactions
 * Get tax vault transactions
 */
router.get(
  '/vault/transactions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { type, startDate, endDate, limit, offset } = req.query;

      const result = await taxVaultService.getTransactions(userId, {
        type: type as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : undefined,
        offset: offset ? Number.parseInt(offset as string) : undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/vault/recommendation
 * Get savings rate recommendation
 */
router.get(
  '/vault/recommendation',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const recommendation = await taxVaultService.getSavingsRecommendation(userId);

      res.json({ recommendation });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TAX ESTIMATE ROUTES
// ============================================================================

/**
 * GET /taxes/estimate
 * Get tax estimate
 */
router.get('/estimate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const options = taxEstimateOptionsSchema.parse(req.query);

    const estimate = await taxCalculator.calculateEstimate(userId, options);

    res.json({ estimate });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /taxes/estimate/calculate
 * Calculate custom tax estimate
 */
router.post(
  '/estimate/calculate',
  authenticate,
  validateBody(taxEstimateOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const estimate = await taxCalculator.calculateEstimate(userId, req.body);

      res.json({ estimate });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /taxes/estimate/scenarios
 * Compare multiple tax scenarios
 */
router.post(
  '/estimate/scenarios',
  authenticate,
  validateBody(
    z.object({
      scenarios: z.array(
        z.object({
          name: z.string(),
          income: z.number(),
          deductions: z.record(z.number()).optional(),
          filingStatus: z
            .enum([
              'single',
              'married_filing_jointly',
              'married_filing_separately',
              'head_of_household',
            ])
            .optional(),
        })
      ),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { scenarios } = req.body;

      const results = await taxCalculator.compareScenarios(userId, scenarios);

      res.json({ scenarios: results });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/estimate/deduction-impact
 * Calculate impact of a deduction
 */
router.get(
  '/estimate/deduction-impact',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { type, amount } = req.query;

      if (!type || !amount) {
        res.status(400).json({ error: 'type and amount required' });
        return;
      }

      const impact = await taxCalculator.calculateDeductionImpact(
        userId,
        type as any,
        parseFloat(amount as string)
      );

      res.json({ impact });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/estimate/retirement
 * Calculate retirement contribution benefit
 */
router.get(
  '/estimate/retirement',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, accountType } = req.query;

      if (!amount || !accountType) {
        res.status(400).json({ error: 'amount and accountType required' });
        return;
      }

      const benefit = await taxCalculator.calculateRetirementBenefit(
        userId,
        parseFloat(amount as string),
        accountType as 'traditional_ira' | 'sep_ira' | 'solo_401k'
      );

      res.json({ benefit });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// QUARTERLY PAYMENT ROUTES
// ============================================================================

/**
 * GET /taxes/quarterly/status
 * Get current quarterly payment status
 */
router.get(
  '/quarterly/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const status = await quarterlyReminders.getPaymentStatus(userId);

      res.json({ status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/quarterly/schedule
 * Get quarterly payment schedule
 */
router.get(
  '/quarterly/schedule',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const year = req.query.year ? Number.parseInt(req.query.year as string) : undefined;

      const schedule = await taxCalculator.getQuarterlySchedule(userId, year);

      res.json({ schedule });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/quarterly/yearly
 * Get all quarterly statuses for the year
 */
router.get(
  '/quarterly/yearly',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const year = req.query.year ? Number.parseInt(req.query.year as string) : undefined;

      const statuses = await quarterlyReminders.getYearlyStatus(userId, year);

      res.json({ quarters: statuses });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /taxes/quarterly/payment
 * Record quarterly tax payment
 */
router.post(
  '/quarterly/payment',
  authenticate,
  validateBody(quarterlyPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, quarter, year } = req.body;

      const transaction = await taxVaultService.recordQuarterlyPayment(
        userId,
        amount,
        quarter,
        year
      );

      logger.info('Quarterly payment recorded via API', { userId, amount, quarter, year });

      res.status(201).json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/quarterly/instructions
 * Get IRS payment instructions
 */
router.get(
  '/quarterly/instructions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { quarter, year } = req.query;

      const instructions = await quarterlyReminders.getPaymentInstructions(
        userId,
        Number.parseInt(quarter as string) || 1,
        Number.parseInt(year as string) || new Date().getFullYear()
      );

      res.json({ instructions });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// REMINDER ROUTES
// ============================================================================

/**
 * GET /taxes/reminders/preferences
 * Get reminder preferences
 */
router.get(
  '/reminders/preferences',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const preferences = await quarterlyReminders.getPreferences(userId);

      res.json({ preferences });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /taxes/reminders/preferences
 * Update reminder preferences
 */
router.put(
  '/reminders/preferences',
  authenticate,
  validateBody(reminderPreferencesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const preferences = await quarterlyReminders.updatePreferences(userId, req.body);

      logger.info('Reminder preferences updated via API', { userId });

      res.json({ preferences });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /taxes/reminders/upcoming
 * Get upcoming reminders
 */
router.get(
  '/reminders/upcoming',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string) : 5;

      const reminders = await quarterlyReminders.getUpcomingReminders(userId, limit);

      res.json({ reminders });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /taxes/reminders/:id/acknowledge
 * Acknowledge a reminder
 */
router.post(
  '/reminders/:id/acknowledge',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const reminderId = req.params.id;

      await quarterlyReminders.acknowledgeReminder(userId, reminderId);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

