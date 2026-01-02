// @ts-nocheck
/**
 * Cards API Routes
 * Endpoints for Skillancer debit card management
 * Sprint M5: Freelancer Financial Services
 */

import { logger } from '@skillancer/logger';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getCardService } from '../cards/card-service.js';
import { getSpendingControlsService } from '../cards/spending-controls.js';
import { getTransactionProcessor } from '../cards/transaction-processor.js';
import { authenticate, requireKyc, requireReauth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

const router = Router();
const cardService = getCardService();
const transactionProcessor = getTransactionProcessor();
const spendingControls = getSpendingControlsService();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const issueVirtualCardSchema = z.object({
  nickname: z.string().max(50).optional(),
  spendingLimits: z
    .object({
      perTransaction: z.number().min(100).max(5000).optional(),
      daily: z.number().min(100).max(10000).optional(),
      weekly: z.number().min(100).max(25000).optional(),
      monthly: z.number().min(100).max(50000).optional(),
    })
    .optional(),
});

const issuePhysicalCardSchema = z.object({
  nickname: z.string().max(50).optional(),
  shippingAddress: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(2),
    postalCode: z.string().min(5).max(10),
    country: z.string().min(2).max(2).default('US'),
  }),
  expeditedShipping: z.boolean().optional(),
  spendingLimits: z
    .object({
      perTransaction: z.number().min(100).max(5000).optional(),
      daily: z.number().min(100).max(10000).optional(),
      monthly: z.number().min(100).max(50000).optional(),
    })
    .optional(),
});

const activateCardSchema = z.object({
  last4: z.string().length(4),
});

const updateSpendingLimitsSchema = z.object({
  perTransaction: z.number().min(100).max(5000).optional(),
  daily: z.number().min(100).max(10000).optional(),
  weekly: z.number().min(100).max(25000).optional(),
  monthly: z.number().min(100).max(50000).optional(),
});

const cancelCardSchema = z.object({
  reason: z.enum(['lost', 'stolen', 'user_request']),
});

const replacementCardSchema = z.object({
  shippingAddress: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(2),
    postalCode: z.string().min(5).max(10),
    country: z.string().min(2).max(2).default('US'),
  }),
  reason: z.enum(['lost', 'stolen', 'damaged', 'expired']),
});

const transactionFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: z.string().optional(),
  status: z.enum(['pending', 'authorized', 'captured', 'declined', 'refunded']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

const updateCategorySchema = z.object({
  category: z.enum([
    'software_subscriptions',
    'office_supplies',
    'travel',
    'meals_entertainment',
    'professional_services',
    'advertising',
    'utilities',
    'equipment',
    'education',
    'health',
    'personal',
    'other',
  ]),
  isBusinessExpense: z.boolean().optional(),
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
// CARD MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /cards
 * List user's cards
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const cards = await cardService.getCards(userId);

    res.json({ cards });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /cards/virtual
 * Issue a new virtual card
 */
router.post(
  '/virtual',
  authenticate,
  requireKyc,
  validateBody(issueVirtualCardSchema),
  rateLimit({ windowMs: 60000, max: 5 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { nickname, spendingLimits } = req.body;

      const card = await cardService.issueVirtualCard(userId, {
        nickname,
        spendingLimits,
      });

      logger.info('Virtual card issued via API', { userId, cardId: card.id });

      res.status(201).json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/physical
 * Issue a new physical card
 */
router.post(
  '/physical',
  authenticate,
  requireKyc,
  validateBody(issuePhysicalCardSchema),
  rateLimit({ windowMs: 86400000, max: 3 }), // 3 per day
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { nickname, shippingAddress, expeditedShipping, spendingLimits } = req.body;

      const card = await cardService.issuePhysicalCard(userId, shippingAddress, {
        nickname,
        expeditedShipping,
        spendingLimits,
      });

      logger.info('Physical card ordered via API', {
        userId,
        cardId: card.id,
        expedited: expeditedShipping,
      });

      res.status(201).json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cards/:id
 * Get card details
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const cardId = req.params.id;

    const card = await cardService.getCard(userId, cardId);

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    res.json({ card });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /cards/:id/activate
 * Activate a physical card
 */
router.post(
  '/:id/activate',
  authenticate,
  validateBody(activateCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;
      const { last4 } = req.body;

      const card = await cardService.activateCard(userId, cardId, last4);

      logger.info('Physical card activated via API', { userId, cardId });

      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/:id/freeze
 * Freeze a card
 */
router.post(
  '/:id/freeze',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;

      const card = await cardService.freezeCard(userId, cardId);

      logger.info('Card frozen via API', { userId, cardId });

      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/:id/unfreeze
 * Unfreeze a card
 */
router.post(
  '/:id/unfreeze',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;

      const card = await cardService.unfreezeCard(userId, cardId);

      logger.info('Card unfrozen via API', { userId, cardId });

      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/:id/cancel
 * Cancel a card
 */
router.post(
  '/:id/cancel',
  authenticate,
  validateBody(cancelCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;
      const { reason } = req.body;

      const card = await cardService.cancelCard(userId, cardId, reason);

      logger.info('Card cancelled via API', { userId, cardId, reason });

      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/:id/replace
 * Request a replacement card
 */
router.post(
  '/:id/replace',
  authenticate,
  requireKyc,
  validateBody(replacementCardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;
      const { shippingAddress, reason } = req.body;

      const newCard = await cardService.requestReplacement(userId, cardId, shippingAddress, reason);

      logger.info('Replacement card requested via API', {
        userId,
        oldCardId: cardId,
        newCardId: newCard.id,
        reason,
      });

      res.status(201).json({ card: newCard });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// CARD DETAILS ROUTES (SENSITIVE)
// ============================================================================

/**
 * GET /cards/:id/details
 * Get sensitive card details (number, CVV) - requires re-authentication
 */
router.get(
  '/:id/details',
  authenticate,
  requireReauth,
  rateLimit({ windowMs: 60000, max: 3 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;

      const details = await cardService.getCardDetails(userId, cardId);

      logger.info('Card details accessed via API', { userId, cardId });

      // Details expire after 60 seconds on client
      res.json({
        details,
        expiresIn: 60,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/:id/wallet
 * Enable digital wallet for card
 */
router.post(
  '/:id/wallet',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;

      const result = await cardService.enableDigitalWallet(userId, cardId);

      logger.info('Digital wallet enabled via API', { userId, cardId });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// SPENDING CONTROLS ROUTES
// ============================================================================

/**
 * PUT /cards/:id/controls
 * Update spending controls
 */
router.put(
  '/:id/controls',
  authenticate,
  validateBody(updateSpendingLimitsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;

      const card = await cardService.updateSpendingLimits(userId, cardId, req.body);

      logger.info('Spending limits updated via API', { userId, cardId });

      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cards/:id/controls
 * Get spending controls for a card
 */
router.get(
  '/:id/controls',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;

      const controls = await spendingControls.getControls(userId, cardId);

      res.json({ controls });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/controls/profile
 * Apply a spending profile
 */
router.post(
  '/controls/profile',
  authenticate,
  validateBody(
    z.object({
      profileName: z.enum(['conservative', 'balanced', 'flexible', 'business_only']),
      cardId: z.string().optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { profileName, cardId } = req.body;

      const controls = await spendingControls.applyProfile(userId, profileName, cardId);

      logger.info('Spending profile applied via API', { userId, profileName, cardId });

      res.json({ controls });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// TRANSACTION ROUTES
// ============================================================================

/**
 * GET /cards/:id/transactions
 * Get card transactions
 */
router.get(
  '/:id/transactions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const cardId = req.params.id;
      const filter = transactionFilterSchema.parse(req.query);

      const result = await transactionProcessor.getTransactions(userId, {
        cardId,
        startDate: filter.startDate ? new Date(filter.startDate) : undefined,
        endDate: filter.endDate ? new Date(filter.endDate) : undefined,
        category: filter.category as any,
        status: filter.status as any,
        limit: filter.limit,
        offset: filter.offset,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cards/transactions
 * Get all card transactions
 */
router.get(
  '/transactions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const filter = transactionFilterSchema.parse(req.query);

      const result = await transactionProcessor.getTransactions(userId, {
        startDate: filter.startDate ? new Date(filter.startDate) : undefined,
        endDate: filter.endDate ? new Date(filter.endDate) : undefined,
        category: filter.category as any,
        status: filter.status as any,
        limit: filter.limit,
        offset: filter.offset,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cards/transactions/:id
 * Get single transaction
 */
router.get(
  '/transactions/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const transactionId = req.params.id;

      const transaction = await transactionProcessor.getTransaction(userId, transactionId);

      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /cards/transactions/:id/category
 * Update transaction category
 */
router.patch(
  '/transactions/:id/category',
  authenticate,
  validateBody(updateCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const transactionId = req.params.id;
      const { category, isBusinessExpense } = req.body;

      const transaction = await transactionProcessor.updateCategory(
        userId,
        transactionId,
        category,
        isBusinessExpense
      );

      res.json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /cards/transactions/:id/receipt
 * Attach receipt to transaction
 */
router.post(
  '/transactions/:id/receipt',
  authenticate,
  validateBody(z.object({ receiptUrl: z.string().url() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const transactionId = req.params.id;
      const { receiptUrl } = req.body;

      const receipt = await transactionProcessor.attachReceipt(userId, transactionId, receiptUrl);

      res.json({ receipt });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /cards/spending/summary
 * Get spending summary by category
 */
router.get(
  '/spending/summary',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { startDate, endDate } = req.query;

      const summary = await transactionProcessor.getSpendingSummary(userId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({ summary });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

