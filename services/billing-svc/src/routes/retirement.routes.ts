// @ts-nocheck
/**
 * Retirement API Routes
 * SEP-IRA and auto-contribution endpoints
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';
import { Router, type Request, type Response } from 'express';

import { getContributionManager } from '../retirement/contribution-manager.js';
import { getRetirementService } from '../retirement/retirement-service.js';

const logger = createLogger({ serviceName: 'retirement-routes' });
const router = Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      logger.error('Route error', { error, path: req.path });
      res.status(500).json({ error: 'Internal server error' });
    });
  };
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /retirement/account
 * Get connected retirement account
 */
router.get(
  '/account',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const retirementService = getRetirementService();
    const account = await retirementService.getAccount(userId);

    res.json({ account });
  })
);

/**
 * POST /retirement/connect/:provider
 * Connect to a retirement provider
 */
router.post(
  '/connect/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { provider } = req.params;
    const { authCode, redirectUri, accountType } = req.body;

    const validProviders = ['betterment', 'wealthfront', 'vanguard'];
    if (!validProviders.includes(provider)) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }

    const retirementService = getRetirementService();
    const result = await retirementService.connectProvider({
      userId,
      provider: provider as 'betterment' | 'wealthfront' | 'vanguard',
      authCode,
      redirectUri,
      accountType: accountType || 'SEP-IRA',
    });

    res.json(result);
  })
);

/**
 * DELETE /retirement/disconnect
 * Disconnect retirement account
 */
router.delete(
  '/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const retirementService = getRetirementService();
    await retirementService.disconnect(userId);

    res.json({ success: true });
  })
);

/**
 * GET /retirement/contributions
 * List contributions
 */
router.get(
  '/contributions',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const contributionManager = getContributionManager();
    const contributions = await contributionManager.getContributions(userId, {
      year,
      limit,
      offset,
    });

    res.json(contributions);
  })
);

/**
 * PUT /retirement/settings
 * Update auto-contribution settings
 */
router.put(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { enabled, percentage, frequency } = req.body;

    const contributionManager = getContributionManager();
    const settings = await contributionManager.updateSettings(userId, {
      enabled,
      percentage,
      frequency,
    });

    res.json({ settings });
  })
);

/**
 * GET /retirement/settings
 * Get auto-contribution settings
 */
router.get(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const contributionManager = getContributionManager();
    const settings = await contributionManager.getSettings(userId);

    res.json({ settings });
  })
);

/**
 * GET /retirement/limits
 * Get contribution limits
 */
router.get(
  '/limits',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const retirementService = getRetirementService();
    const limits = await retirementService.getContributionLimits(userId, year);

    res.json({ limits });
  })
);

/**
 * POST /retirement/contribute
 * Make a manual contribution
 */
router.post(
  '/contribute',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Valid amount required' });
      return;
    }

    const contributionManager = getContributionManager();
    const result = await contributionManager.makeContribution(userId, amount);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ contribution: result.contribution });
  })
);

/**
 * GET /retirement/tax-benefit
 * Calculate tax benefit from contributions
 */
router.get(
  '/tax-benefit',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const retirementService = getRetirementService();
    const benefit = await retirementService.calculateTaxBenefit(userId, year);

    res.json({ benefit });
  })
);

export default router;

