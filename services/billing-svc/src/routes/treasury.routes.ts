// @ts-nocheck
/**
 * Treasury API Routes
 * Endpoints for Treasury account management, balances, and payouts
 * Sprint M5: Freelancer Financial Services
 */

import { logger } from '../lib/logger.js';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { authenticate, requireKyc } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { getBalanceManager } from '../treasury/balance-manager.js';
import { getInstantPayoutService } from '../treasury/instant-payout.js';
import { getTreasuryService } from '../treasury/treasury-service.js';

const router = Router();
const treasuryService = getTreasuryService();
const payoutService = getInstantPayoutService();
const balanceManager = getBalanceManager();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createAccountSchema = z.object({
  acceptedTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

const payoutSchema = z.object({
  amount: z.number().min(5, 'Minimum payout is $5').max(10000, 'Maximum instant payout is $10,000'),
  speed: z.enum(['standard', 'instant']),
  destination: z.enum(['skillancer_card', 'external_debit', 'bank_account']),
  destinationId: z.string().optional(),
  description: z.string().max(255).optional(),
});

const transactionFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: z.enum(['credit', 'debit']).optional(),
  limit: z.number().min(1).max(100).optional(),
  startingAfter: z.string().optional(),
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
// ACCOUNT ROUTES
// ============================================================================

/**
 * GET /treasury/account
 * Get user's Treasury account details
 */
router.get('/account', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const account = await treasuryService.getAccount(userId);

    if (!account) {
      res.status(404).json({ error: 'Treasury account not found' });
      return;
    }

    res.json({ account });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /treasury/account
 * Create a new Treasury account
 */
router.post(
  '/account',
  authenticate,
  requireKyc,
  validateBody(createAccountSchema),
  rateLimit({ windowMs: 60000, max: 3 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { acceptedTerms } = req.body;

      // Get Connect account ID from user profile
      const stripeConnectAccountId = req.user!.stripeConnectAccountId;
      if (!stripeConnectAccountId) {
        res.status(400).json({
          error: 'Stripe Connect account required',
          message: 'Please complete onboarding first',
        });
        return;
      }

      const account = await treasuryService.createAccount({
        userId,
        stripeConnectAccountId,
        acceptedTerms,
      });

      logger.info('Treasury account created via API', { userId });

      res.status(201).json({ account });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /treasury/account/details
 * Get bank account details (account/routing numbers)
 */
router.get(
  '/account/details',
  authenticate,
  rateLimit({ windowMs: 60000, max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const details = await treasuryService.getAccountDetails(userId);

      if (!details) {
        res.status(404).json({ error: 'Account details not available' });
        return;
      }

      // Log access for audit
      logger.info('Bank account details accessed', { userId });

      res.json({ details });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /treasury/account
 * Close Treasury account
 */
router.delete(
  '/account',
  authenticate,
  validateBody(z.object({ reason: z.string().min(1).max(500) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { reason } = req.body;

      await treasuryService.closeAccount(userId, reason);

      logger.info('Treasury account closed via API', { userId, reason });

      res.json({ success: true, message: 'Account closed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// BALANCE ROUTES
// ============================================================================

/**
 * GET /treasury/balance
 * Get current account balances
 */
router.get('/balance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const balance = await balanceManager.getBalances(userId);

    if (!balance) {
      res.status(404).json({ error: 'No balance found' });
      return;
    }

    res.json({ balance });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /treasury/balance/history
 * Get balance history over time
 */
router.get(
  '/balance/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { startDate, endDate, granularity } = req.query;

      const history = await balanceManager.getBalanceHistory(userId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        granularity: granularity as 'day' | 'week' | 'month',
      });

      res.json({ history });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /treasury/balance/alerts
 * Get unread balance alerts
 */
router.get(
  '/balance/alerts',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const alerts = await balanceManager.getUnreadAlerts(userId);

      res.json({ alerts });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /treasury/balance/alerts/read
 * Mark alerts as read
 */
router.post(
  '/balance/alerts/read',
  authenticate,
  validateBody(z.object({ alertIds: z.array(z.string()) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { alertIds } = req.body;

      await balanceManager.markAlertsRead(userId, alertIds);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TRANSACTION ROUTES
// ============================================================================

/**
 * GET /treasury/transactions
 * List account transactions
 */
router.get(
  '/transactions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const filter = transactionFilterSchema.parse(req.query);

      const result = await treasuryService.listTransactions(userId, {
        startDate: filter.startDate ? new Date(filter.startDate) : undefined,
        endDate: filter.endDate ? new Date(filter.endDate) : undefined,
        type: filter.type,
        limit: filter.limit,
        startingAfter: filter.startingAfter,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// PAYOUT ROUTES
// ============================================================================

/**
 * GET /treasury/payout/eligibility
 * Check payout eligibility
 */
router.get(
  '/payout/eligibility',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const eligibility = await payoutService.checkEligibility(userId);

      res.json({ eligibility });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /treasury/payout/options
 * Get payout options with fees
 */
router.get(
  '/payout/options',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const amount = parseFloat(req.query.amount as string) || 100;

      const options = await payoutService.getPayoutOptions(userId, amount);

      res.json(options);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /treasury/payout
 * Initiate a payout
 */
router.post(
  '/payout',
  authenticate,
  requireKyc,
  validateBody(payoutSchema),
  rateLimit({ windowMs: 60000, max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, speed, destination, destinationId, description } = req.body;

      const result = await payoutService.initiatePayout({
        userId,
        amount,
        speed,
        destination,
        destinationId,
        description,
      });

      logger.info('Payout initiated via API', {
        userId,
        payoutId: result.id,
        amount,
        speed,
        destination,
      });

      res.status(201).json({ payout: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /treasury/payout/:id
 * Get payout status
 */
router.get('/payout/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const payoutId = req.params.id;

    const payout = await payoutService.getPayout(payoutId, userId);

    if (!payout) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    res.json({ payout });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /treasury/payouts
 * List user's payouts
 */
router.get('/payouts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { status, limit, startDate, endDate } = req.query;

    const result = await payoutService.listPayouts(userId, {
      status: status as any,
      limit: limit ? Number.parseInt(limit as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /treasury/payout/:id/cancel
 * Cancel a pending payout
 */
router.post(
  '/payout/:id/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const payoutId = req.params.id;

      await payoutService.cancelPayout(payoutId, userId);

      logger.info('Payout cancelled via API', { userId, payoutId });

      res.json({ success: true, message: 'Payout cancelled' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// STATEMENTS ROUTES
// ============================================================================

/**
 * GET /treasury/statements
 * Get account statements
 */
router.get('/statements', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const year = req.query.year ? Number.parseInt(req.query.year as string) : undefined;

    const statements = await treasuryService.getStatements(userId, year);

    res.json({ statements });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// KYC ROUTES
// ============================================================================

/**
 * GET /treasury/kyc/status
 * Get KYC verification status
 */
router.get('/kyc/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const status = await treasuryService.getKycStatus(userId);

    res.json(status);
  } catch (error) {
    next(error);
  }
});

export default router;

