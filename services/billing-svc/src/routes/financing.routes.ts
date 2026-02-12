// @ts-nocheck
/**
 * Financing API Routes
 * Invoice financing endpoints
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';
import { Router, type Request, type Response } from 'express';

import { getAdvanceManager } from '../financing/advance-manager.js';
import { getFinancingLimitsService } from '../financing/financing-limits.js';
import { getInvoiceFinancingService } from '../financing/invoice-financing-service.js';
import { getRiskScoringService } from '../financing/risk-scoring.js';

const logger = createLogger({ serviceName: 'financing-routes' });
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
 * GET /financing/eligibility
 * Check user's eligibility for invoice financing
 */
router.get(
  '/eligibility',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const financingService = getInvoiceFinancingService();
    const eligibility = await financingService.checkEligibility(userId);

    res.json(eligibility);
  })
);

/**
 * GET /financing/invoices
 * List eligible invoices for financing
 */
router.get(
  '/invoices',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const financingService = getInvoiceFinancingService();
    const invoices = await financingService.getEligibleInvoices(userId);

    res.json({ invoices });
  })
);

/**
 * POST /financing/advance
 * Request an advance on one or more invoices
 */
router.post(
  '/advance',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { invoiceIds, advancePercent } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      res.status(400).json({ error: 'invoiceIds required' });
      return;
    }

    const advanceManager = getAdvanceManager();
    const result = await advanceManager.requestAdvance({
      userId,
      invoiceIds,
      advancePercent: advancePercent || 85,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ advance: result.advance });
  })
);

/**
 * GET /financing/advances
 * List user's active advances
 */
router.get(
  '/advances',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = req.query.status as string | undefined;
    const advanceManager = getAdvanceManager();
    const advances = await advanceManager.getAdvances(userId, status);

    res.json({ advances });
  })
);

/**
 * GET /financing/advances/:id
 * Get advance details
 */
router.get(
  '/advances/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const advanceManager = getAdvanceManager();
    const advance = await advanceManager.getAdvanceById(id);

    if (!advance || advance.userId !== userId) {
      res.status(404).json({ error: 'Advance not found' });
      return;
    }

    res.json({ advance });
  })
);

/**
 * GET /financing/history
 * Get financing history
 */
router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = Number.parseInt(req.query.limit as string) || 50;
    const offset = Number.parseInt(req.query.offset as string) || 0;

    const advanceManager = getAdvanceManager();
    const history = await advanceManager.getHistory(userId, { limit, offset });

    res.json(history);
  })
);

/**
 * GET /financing/limits
 * Get user's current financing limits
 */
router.get(
  '/limits',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limitsService = getFinancingLimitsService();
    const limits = await limitsService.getUserLimits(userId);

    res.json({ limits });
  })
);

/**
 * POST /financing/calculate
 * Calculate advance details without requesting
 */
router.post(
  '/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { invoiceIds, advancePercent } = req.body;

    const financingService = getInvoiceFinancingService();
    const calculation = await financingService.calculateAdvance({
      userId,
      invoiceIds,
      advancePercent: advancePercent || 85,
    });

    res.json({ calculation });
  })
);

export default router;
