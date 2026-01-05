// @ts-nocheck
/**
 * Treasury API Routes
 * Sprint M5: Freelancer Financial Services
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getTreasuryService } from '../../treasury/treasury-service';
import { getInstantPayoutService } from '../../treasury/instant-payout';
import { getBalanceManager } from '../../treasury/balance-manager';
import { createLogger } from '@skillancer/logger';

const router = Router();
const logger = createLogger({ name: 'TreasuryRoutes' });

// Stub notification service until proper integration is done
// TODO: Replace with @skillancer/service-client notification client
const getFinancialNotificationsService = () => ({
  sendNotification: async (userId: string, type: string, data: Record<string, unknown>) => {
    logger.info('Notification stub', { userId, type, data });
  },
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================================================
// SCHEMAS
// ============================================================================

const PayoutRequestSchema = z.object({
  amount: z.number().min(5).max(50000),
  speed: z.enum(['instant', 'standard']),
  destination: z.enum(['skillancer_card', 'external_debit', 'bank_account']),
  destinationId: z.string(),
});

const TransferToTaxVaultSchema = z.object({
  amount: z.number().min(1),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/treasury/account
 * Get treasury account details for the authenticated user
 */
router.get(
  '/account',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const treasuryService = getTreasuryService();

    const account = await treasuryService.getAccountDetails(userId);

    if (!account) {
      res.status(404).json({ error: 'Treasury account not found' });
      return;
    }

    res.json(account);
  })
);

/**
 * POST /api/treasury/account
 * Create a treasury account for the authenticated user
 */
router.post(
  '/account',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const treasuryService = getTreasuryService();

    const existingAccount = await treasuryService.getAccount(userId);
    if (existingAccount) {
      res.status(400).json({ error: 'Treasury account already exists' });
      return;
    }

    const account = await treasuryService.createAccount(userId, req.user!.stripeConnectId);

    logger.info('Treasury account created', { userId });

    res.status(201).json(account);
  })
);

/**
 * GET /api/treasury/balance
 * Get current balance breakdown
 */
router.get(
  '/balance',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const balanceManager = getBalanceManager();

    const balances = await balanceManager.getBalances(userId);

    res.json(balances);
  })
);

/**
 * GET /api/treasury/balance/history
 * Get balance history
 */
router.get(
  '/balance/history',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const days = Number.parseInt(req.query.days as string) || 30;
    const balanceManager = getBalanceManager();

    const history = await balanceManager.getBalanceHistory(userId, days);

    res.json({ history });
  })
);

/**
 * GET /api/treasury/transactions
 * Get transaction history
 */
router.get(
  '/transactions',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const limit = Number.parseInt(req.query.limit as string) || 50;
    const startingAfter = req.query.starting_after as string | undefined;
    const treasuryService = getTreasuryService();

    const transactions = await treasuryService.listTransactions(userId, {
      limit,
      startingAfter,
    });

    res.json(transactions);
  })
);

/**
 * GET /api/treasury/payout/options
 * Get payout options and eligibility
 */
router.get(
  '/payout/options',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const payoutService = getInstantPayoutService();

    const eligibility = await payoutService.checkEligibility(userId);
    const options = await payoutService.getPayoutOptions(userId);

    res.json({
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      limits: eligibility.limits,
      options,
    });
  })
);

/**
 * POST /api/treasury/payout
 * Request a payout
 */
router.post(
  '/payout',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const validation = PayoutRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    const { amount, speed, destination, destinationId } = validation.data;
    const payoutService = getInstantPayoutService();
    const notificationService = getFinancialNotificationsService();

    // Check eligibility
    const eligibility = await payoutService.checkEligibility(userId);
    if (!eligibility.eligible) {
      res.status(400).json({ error: 'Not eligible for payout', reasons: eligibility.reasons });
      return;
    }

    // Initiate payout
    const payout = await payoutService.initiatePayout(userId, {
      amount,
      speed,
      destination,
      destinationId,
    });

    // Send notification
    await notificationService.sendNotification(userId, 'payout_initiated', {
      payoutId: payout.id,
      amount: payout.amount,
      fee: payout.fee,
      netAmount: payout.netAmount,
      destination,
      destinationLast4: payout.destinationLast4,
      speed,
      status: payout.status,
    });

    logger.info('Payout initiated', { userId, payoutId: payout.id, amount, speed });

    res.status(201).json(payout);
  })
);

/**
 * GET /api/treasury/payouts
 * List payout history
 */
router.get(
  '/payouts',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Number.parseInt(req.query.limit as string) || 20;
    const payoutService = getInstantPayoutService();

    const payouts = await payoutService.listPayouts(userId, { page, limit });

    res.json(payouts);
  })
);

/**
 * GET /api/treasury/payouts/:payoutId
 * Get payout details
 */
router.get(
  '/payouts/:payoutId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { payoutId } = req.params;
    const payoutService = getInstantPayoutService();

    const payout = await payoutService.getPayout(payoutId);

    if (!payout || payout.userId !== userId) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    res.json(payout);
  })
);

/**
 * POST /api/treasury/payouts/:payoutId/cancel
 * Cancel a pending payout
 */
router.post(
  '/payouts/:payoutId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { payoutId } = req.params;
    const payoutService = getInstantPayoutService();

    const payout = await payoutService.getPayout(payoutId);

    if (!payout || payout.userId !== userId) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    const cancelled = await payoutService.cancelPayout(payoutId);

    if (!cancelled) {
      res.status(400).json({ error: 'Cannot cancel payout' });
      return;
    }

    logger.info('Payout cancelled', { userId, payoutId });

    res.json({ success: true });
  })
);

/**
 * POST /api/treasury/tax-vault/transfer
 * Transfer funds to tax vault
 */
router.post(
  '/tax-vault/transfer',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const validation = TransferToTaxVaultSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    const { amount } = validation.data;
    const balanceManager = getBalanceManager();

    await balanceManager.reserveForTaxes(userId, amount);

    logger.info('Transferred to tax vault', { userId, amount });

    res.json({ success: true, amount });
  })
);

/**
 * GET /api/treasury/statements
 * Get account statements
 */
router.get(
  '/statements',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const month = req.query.month as string;
    const year = Number.parseInt(req.query.year as string) || new Date().getFullYear();
    const treasuryService = getTreasuryService();

    const statements = await treasuryService.getStatements(userId, { month, year });

    res.json(statements);
  })
);

export default router;

