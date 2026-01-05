// @ts-nocheck
/**
 * Guild Finance Routes
 * Sprint M8: Guild & Agency Accounts
 */

import { logger } from '@skillancer/logger';
import { Router } from 'express';

import {
  revenueSplitService,
  guildTreasuryService,
  splitCalculatorService,
  CreateRevenueSplitSchema,
  WithdrawFromTreasurySchema,
  DepositToTreasurySchema,
} from '../guilds';

const router = Router();
const log = logger.child({ module: 'guild-finance-routes' });

// =============================================================================
// TREASURY
// =============================================================================

/**
 * Get guild treasury
 * GET /guilds/:guildId/treasury
 */
router.get('/:guildId/treasury', async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const treasury = await guildTreasuryService.getTreasury(guildId);

    res.json({ data: treasury });
  } catch (error) {
    next(error);
  }
});

/**
 * Get treasury summary
 * GET /guilds/:guildId/treasury/summary
 */
router.get('/:guildId/treasury/summary', async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const period = (req.query.period as 'week' | 'month' | 'quarter' | 'year') || 'month';

    const summary = await guildTreasuryService.getTreasurySummary(guildId, period);

    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
});

/**
 * Deposit to treasury
 * POST /guilds/:guildId/treasury/deposit
 */
router.post('/:guildId/treasury/deposit', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { guildId } = req.params;
    const input = DepositToTreasurySchema.parse(req.body);

    const transaction = await guildTreasuryService.deposit(guildId, userId, input);

    res.status(201).json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * Withdraw from treasury
 * POST /guilds/:guildId/treasury/withdraw
 */
router.post('/:guildId/treasury/withdraw', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { guildId } = req.params;
    const input = WithdrawFromTreasurySchema.parse(req.body);

    const transaction = await guildTreasuryService.withdraw(guildId, userId, input);

    res.status(201).json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * Transfer to member
 * POST /guilds/:guildId/treasury/transfer
 */
router.post('/:guildId/treasury/transfer', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { guildId } = req.params;
    const { recipientId, amount, description } = req.body;

    const transaction = await guildTreasuryService.transferToMember(
      guildId,
      userId,
      recipientId,
      amount,
      description
    );

    res.status(201).json({ data: transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * List transactions
 * GET /guilds/:guildId/treasury/transactions
 */
router.get('/:guildId/treasury/transactions', async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const options = {
      type: req.query.type
        ? ((req.query.type as string).split(',') as ('DEPOSIT' | 'WITHDRAWAL')[])
        : undefined,
      status: req.query.status
        ? ((req.query.status as string).split(',') as ('PENDING' | 'COMPLETED')[])
        : undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? Number.parseInt(req.query.offset as string) : undefined,
    };

    const result = await guildTreasuryService.listTransactions(guildId, options);

    res.json({ data: result.transactions, meta: { total: result.total } });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// REVENUE SPLITS
// =============================================================================

/**
 * Create revenue split
 * POST /guilds/:guildId/splits
 */
router.post('/:guildId/splits', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { guildId } = req.params;
    const input = CreateRevenueSplitSchema.parse(req.body);

    const split = await revenueSplitService.createRevenueSplit(guildId, userId, input);

    res.status(201).json({ data: split });
  } catch (error) {
    next(error);
  }
});

/**
 * Get revenue split
 * GET /guilds/splits/:splitId
 */
router.get('/splits/:splitId', async (req, res, next) => {
  try {
    const { splitId } = req.params;
    const split = await revenueSplitService.getRevenueSplit(splitId);

    res.json({ data: split });
  } catch (error) {
    next(error);
  }
});

/**
 * List guild revenue splits
 * GET /guilds/:guildId/splits
 */
router.get('/:guildId/splits', async (req, res, next) => {
  try {
    const { guildId } = req.params;
    const options = {
      status: req.query.status
        ? ((req.query.status as string).split(',') as ('PENDING' | 'APPROVED' | 'COMPLETED')[])
        : undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? Number.parseInt(req.query.offset as string) : undefined,
    };

    const result = await revenueSplitService.listGuildRevenueSplits(guildId, options);

    res.json({ data: result.splits, meta: { total: result.total } });
  } catch (error) {
    next(error);
  }
});

/**
 * Approve revenue split
 * POST /guilds/splits/:splitId/approve
 */
router.post('/splits/:splitId/approve', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { splitId } = req.params;

    const split = await revenueSplitService.approveRevenueSplit(splitId, userId);

    res.json({ data: split });
  } catch (error) {
    next(error);
  }
});

/**
 * Process revenue split
 * POST /guilds/splits/:splitId/process
 */
router.post('/splits/:splitId/process', async (req, res, next) => {
  try {
    const { splitId } = req.params;

    const split = await revenueSplitService.processRevenueSplit(splitId);

    res.json({ data: split });
  } catch (error) {
    next(error);
  }
});

/**
 * Dispute revenue split
 * POST /guilds/splits/:splitId/dispute
 */
router.post('/splits/:splitId/dispute', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { splitId } = req.params;
    const { reason } = req.body;

    await revenueSplitService.disputeRevenueSplit(splitId, userId, reason);

    res.json({ message: 'Dispute submitted' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get member earnings
 * GET /guilds/:guildId/members/:memberId/earnings
 */
router.get('/:guildId/members/:memberId/earnings', async (req, res, next) => {
  try {
    const { guildId, memberId } = req.params;

    const earnings = await revenueSplitService.getMemberEarnings(guildId, memberId);

    res.json({ data: earnings });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// SPLIT CALCULATOR
// =============================================================================

/**
 * Preview split calculation
 * POST /guilds/:guildId/splits/preview
 */
router.post('/:guildId/splits/preview', async (req, res, next) => {
  try {
    const { totalAmount, members, config } = req.body;

    const preview = splitCalculatorService.previewSplit(totalAmount, members, config);

    res.json({ data: preview });
  } catch (error) {
    next(error);
  }
});

/**
 * Suggest split method
 * POST /guilds/:guildId/splits/suggest-method
 */
router.post('/:guildId/splits/suggest-method', async (req, res, next) => {
  try {
    const { members } = req.body;

    const suggestion = splitCalculatorService.suggestSplitMethod(members);

    res.json({ data: suggestion });
  } catch (error) {
    next(error);
  }
});

/**
 * Validate split configuration
 * POST /guilds/:guildId/splits/validate
 */
router.post('/:guildId/splits/validate', async (req, res, next) => {
  try {
    const { members, config } = req.body;

    const validation = splitCalculatorService.validateConfiguration(members, config);

    res.json({ data: validation });
  } catch (error) {
    next(error);
  }
});

export default router;

