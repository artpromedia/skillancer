// @ts-nocheck
/**
 * Deductions API Routes
 * Expense tracking and mileage endpoints
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';
import { Router, type Request, type Response } from 'express';

import { getDeductionTracker } from '../tax/deduction-tracker.js';

const logger = createLogger({ serviceName: 'deductions-routes' });
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
 * GET /deductions
 * List deductions
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? Number.parseInt(req.query.year as string) : new Date().getFullYear();
    const category = req.query.category as string | undefined;
    const limit = Number.parseInt(req.query.limit as string) || 50;
    const offset = Number.parseInt(req.query.offset as string) || 0;

    const tracker = getDeductionTracker();
    const deductions = await tracker.getDeductions(userId, { year, category, limit, offset });

    res.json(deductions);
  })
);

/**
 * POST /deductions
 * Add a deduction
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { category, description, amount, date, receiptUrl, notes } = req.body;

    if (!category || !description || !amount || !date) {
      res.status(400).json({ error: 'category, description, amount, and date required' });
      return;
    }

    const tracker = getDeductionTracker();
    const deduction = await tracker.addDeduction({
      userId,
      category,
      description,
      amount,
      date,
      receiptUrl,
      notes,
    });

    res.json({ deduction });
  })
);

/**
 * PUT /deductions/:id
 * Update a deduction
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const updates = req.body;

    const tracker = getDeductionTracker();
    const deduction = await tracker.updateDeduction(id, userId, updates);

    if (!deduction) {
      res.status(404).json({ error: 'Deduction not found' });
      return;
    }

    res.json({ deduction });
  })
);

/**
 * DELETE /deductions/:id
 * Delete a deduction
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const tracker = getDeductionTracker();
    const deleted = await tracker.deleteDeduction(id, userId);

    if (!deleted) {
      res.status(404).json({ error: 'Deduction not found' });
      return;
    }

    res.json({ success: true });
  })
);

/**
 * GET /deductions/categories
 * Get categories with totals
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? Number.parseInt(req.query.year as string) : new Date().getFullYear();

    const tracker = getDeductionTracker();
    const categories = await tracker.getCategorySummary(userId, year);

    res.json({ categories });
  })
);

/**
 * GET /deductions/mileage
 * Get mileage log
 */
router.get(
  '/mileage',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = req.query.year ? Number.parseInt(req.query.year as string) : new Date().getFullYear();
    const limit = Number.parseInt(req.query.limit as string) || 50;
    const offset = Number.parseInt(req.query.offset as string) || 0;

    const tracker = getDeductionTracker();
    const mileage = await tracker.getMileageLog(userId, { year, limit, offset });

    res.json(mileage);
  })
);

/**
 * POST /deductions/mileage
 * Add mileage entry
 */
router.post(
  '/mileage',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { date, purpose, startLocation, endLocation, miles, roundTrip } = req.body;

    if (!date || !purpose || !miles) {
      res.status(400).json({ error: 'date, purpose, and miles required' });
      return;
    }

    const tracker = getDeductionTracker();
    const entry = await tracker.addMileageEntry({
      userId,
      date,
      purpose,
      startLocation,
      endLocation,
      miles: roundTrip ? miles * 2 : miles,
    });

    res.json({ entry });
  })
);

/**
 * DELETE /deductions/mileage/:id
 * Delete mileage entry
 */
router.delete(
  '/mileage/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const tracker = getDeductionTracker();
    const deleted = await tracker.deleteMileageEntry(id, userId);

    if (!deleted) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    res.json({ success: true });
  })
);

/**
 * GET /deductions/summary/:year
 * Get annual deduction summary
 */
router.get(
  '/summary/:year',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const year = Number.parseInt(req.params.year);
    if (isNaN(year)) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const tracker = getDeductionTracker();
    const summary = await tracker.getAnnualSummary(userId, year);

    res.json({ summary });
  })
);

export default router;

