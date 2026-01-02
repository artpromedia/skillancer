// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Finance Routes
 *
 * API endpoints for Income & Expense Tracking (CP-3.1)
 * - Financial accounts management
 * - Transaction CRUD & categorization
 * - Recurring transactions
 * - Financial goals
 * - Mileage tracking
 * - Financial reports
 * - Tax preparation
 * - Plaid integration
 */

import { z } from 'zod';

import { FinanceError } from '../errors/finance.errors.js';
import {
  RecurringTransactionRepository,
  TransactionCategoryRepository,
  TaxProfileRepository,
} from '../repositories/index.js';
import { FinancialAccountService } from '../services/financial-account.service.js';
import { FinancialGoalService } from '../services/financial-goal.service.js';
import { FinancialReportsService } from '../services/financial-reports.service.js';
import { FinancialTransactionService } from '../services/financial-transaction.service.js';
import { MileageService } from '../services/mileage.service.js';
import { PlaidService } from '../services/plaid.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

// -- Account Schemas --
const CreateAccountSchema = z.object({
  accountType: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'PAYPAL', 'STRIPE', 'OTHER']),
  name: z.string().min(1).max(100),
  institutionName: z.string().max(100).optional(),
  accountNumber: z.string().max(4).optional(),
  currentBalance: z.number().default(0),
  currency: z.string().length(3).default('USD'),
  isDefault: z.boolean().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  institutionName: z.string().max(100).optional(),
  currentBalance: z.number().optional(),
  isActive: z.boolean().optional(),
});

// -- Transaction Schemas --
const CreateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  transactionType: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  amount: z.number().positive(),
  transactionDate: z.string().transform((s) => new Date(s)),
  description: z.string().min(1).max(500),
  vendor: z.string().max(255).optional(),
  categoryId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  invoiceNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  receiptUrl: z.string().url().optional(),
  isTaxDeductible: z.boolean().default(false),
  taxDeductiblePercentage: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  isRecurring: z.boolean().optional(),
  recurringTransactionId: z.string().uuid().optional(),
});

const UpdateTransactionSchema = CreateTransactionSchema.partial().omit({ accountId: true });

const ListTransactionsSchema = z.object({
  accountId: z.string().uuid().optional(),
  transactionType: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  categoryId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'VOIDED']).optional(),
  isTaxDeductible: z
    .string()
    .transform((s) => s === 'true')
    .optional(),
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  minAmount: z.string().transform(Number).optional(),
  maxAmount: z.string().transform(Number).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['transactionDate', 'amount', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

const BulkCategorizeSchema = z.object({
  transactionIds: z.array(z.string().uuid()),
  categoryId: z.string().uuid(),
});

const SplitTransactionSchema = z.object({
  splits: z.array(
    z.object({
      amount: z.number().positive(),
      categoryId: z.string().uuid().optional(),
      description: z.string().max(500).optional(),
      isTaxDeductible: z.boolean().optional(),
    })
  ),
});

// -- Category Schemas --
const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['INCOME', 'EXPENSE']),
  irsCategory: z.string().max(100).optional(),
  parentId: z.string().uuid().optional(),
  color: z.string().max(7).optional(),
  icon: z.string().max(50).optional(),
  isDeductible: z.boolean().optional(),
});

// -- Recurring Transaction Schemas --
const CreateRecurringSchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  description: z.string().max(500),
  vendor: z.string().max(255).optional(),
  category: z.string().max(100),
  subcategory: z.string().max(100).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  isDeductible: z.boolean().default(false),
  autoCreate: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

const UpdateRecurringSchema = CreateRecurringSchema.partial().extend({
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
});

// -- Goal Schemas --
const CreateGoalSchema = z.object({
  goalType: z.enum(['INCOME', 'SAVINGS', 'EXPENSE_LIMIT', 'PROFIT']),
  name: z.string().min(1).max(200),
  targetAmount: z.number().positive(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  periodType: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']).optional(),
  linkedCategoryIds: z.array(z.string().uuid()).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
});

const UpdateGoalSchema = CreateGoalSchema.partial().extend({
  status: z.enum(['IN_PROGRESS', 'ACHIEVED', 'FAILED', 'CANCELLED']).optional(),
  currentAmount: z.number().optional(),
});

// -- Mileage Schemas --
const CreateMileageSchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  purpose: z.enum(['CLIENT_MEETING', 'BUSINESS_ERRAND', 'TRAVEL', 'OTHER']),
  description: z.string().max(500),
  startLocation: z.string().max(500).optional(),
  endLocation: z.string().max(500).optional(),
  miles: z.number().positive(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  roundTrip: z.boolean().optional(),
  vehicleId: z.string().uuid().optional(),
});

const UpdateMileageSchema = CreateMileageSchema.partial();

const ListMileageSchema = z.object({
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  purpose: z.enum(['CLIENT_MEETING', 'BUSINESS_ERRAND', 'TRAVEL', 'OTHER']).optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('50'),
});

// -- Report Schemas --
const ReportDateRangeSchema = z.object({
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  compareStartDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  compareEndDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
});

// -- Tax Schemas --
const CreateTaxProfileSchema = z.object({
  businessType: z.enum([
    'SOLE_PROPRIETOR',
    'LLC_SINGLE',
    'LLC_MULTI',
    'PARTNERSHIP',
    'S_CORP',
    'C_CORP',
  ]),
  filingStatus: z.enum([
    'SINGLE',
    'MARRIED_FILING_JOINTLY',
    'MARRIED_FILING_SEPARATELY',
    'HEAD_OF_HOUSEHOLD',
    'QUALIFYING_WIDOW',
  ]),
  stateOfResidence: z.string().length(2).optional(),
  stateIncomeTaxRate: z.number().min(0).max(100).optional(),
  estimatedTaxRate: z.number().min(0).max(100).optional(),
  accountingMethod: z.enum(['CASH', 'ACCRUAL']).optional(),
  businessName: z.string().max(200).optional(),
  ein: z.string().max(20).optional(),
  hasHomeOffice: z.boolean().optional(),
  homeOfficeSquareFeet: z.number().positive().optional(),
  totalHomeSquareFeet: z.number().positive().optional(),
  hasBusinessVehicle: z.boolean().optional(),
});

const UpdateTaxProfileSchema = CreateTaxProfileSchema.partial();

// -- Plaid Schemas --
const PlaidConnectSchema = z.object({
  publicToken: z.string(),
  institutionId: z.string(),
  institutionName: z.string(),
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      subtype: z.string().optional(),
      mask: z.string().optional(),
      currentBalance: z.number().optional(),
      availableBalance: z.number().optional(),
    })
  ),
});

// -- Export Schemas --
const ExportTransactionsSchema = z.object({
  format: z.enum(['CSV', 'QBO', 'OFX', 'JSON']),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  transactionType: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface FinanceRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  plaidConfig?: {
    clientId: string;
    secret: string;
    env: 'sandbox' | 'development' | 'production';
    webhookUrl?: string;
  };
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerFinanceRoutes(fastify: FastifyInstance, deps: FinanceRouteDeps): void {
  const { prisma, logger, plaidConfig } = deps;

  // Initialize services
  const accountService = new FinancialAccountService(prisma, logger);
  const transactionService = new FinancialTransactionService(prisma, logger);
  const reportsService = new FinancialReportsService(prisma, logger);
  const goalService = new FinancialGoalService(prisma, logger);
  const mileageService = new MileageService(prisma, logger);
  const recurringRepo = new RecurringTransactionRepository(prisma);
  const categoryRepo = new TransactionCategoryRepository(prisma);
  const taxProfileRepo = new TaxProfileRepository(prisma);

  // Initialize Plaid service if configured
  const plaidService = plaidConfig ? new PlaidService(prisma, logger, plaidConfig) : null;

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof FinanceError) {
      return reply.status(error.httpStatus).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // ==========================================================================
  // ACCOUNT ROUTES
  // ==========================================================================

  // POST /finance/accounts - Create account
  fastify.post('/accounts', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateAccountSchema.parse(request.body);

      const account = await accountService.createAccount({
        userId: user.id,
        ...body,
      });

      logger.info({ accountId: account.id, userId: user.id }, 'Account created');

      return await reply.status(201).send({
        success: true,
        data: account,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/accounts - List accounts
  fastify.get('/accounts', async (request, reply) => {
    try {
      const user = getUser(request);
      const includeInactive = (request.query as any).includeInactive === 'true';

      const accounts = await accountService.listAccounts(user.id, { isActive: !includeInactive });

      return await reply.send({
        success: true,
        data: accounts,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/accounts/:id - Get account details
  fastify.get('/accounts/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const account = await accountService.getAccount(id, user.id);

      return await reply.send({
        success: true,
        data: account,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /finance/accounts/:id - Update account
  fastify.patch('/accounts/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateAccountSchema.parse(request.body);

      const account = await accountService.updateAccount(id, user.id, body);

      logger.info({ accountId: id, userId: user.id }, 'Account updated');

      return await reply.send({
        success: true,
        data: account,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /finance/accounts/:id - Delete account
  fastify.delete('/accounts/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await accountService.deleteAccount(id, user.id);

      logger.info({ accountId: id, userId: user.id }, 'Account deleted');

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/accounts/summary - Get account balances summary
  fastify.get('/accounts/summary', async (request, reply) => {
    try {
      const user = getUser(request);

      // Get all accounts and calculate summary
      const accounts = await accountService.listAccounts(user.id);
      const summary = {
        totalBalance: accounts.reduce((sum, acc) => sum + Number(acc.currentBalance || 0), 0),
        accountCount: accounts.length,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          balance: Number(a.currentBalance || 0),
        })),
      };

      return await reply.send({
        success: true,
        data: summary,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // TRANSACTION ROUTES
  // ==========================================================================

  // POST /finance/transactions - Create transaction
  fastify.post('/transactions', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateTransactionSchema.parse(request.body);

      const transaction = await transactionService.createTransaction({
        userId: user.id,
        ...body,
      });

      logger.info({ transactionId: transaction.id, userId: user.id }, 'Transaction created');

      return await reply.status(201).send({
        success: true,
        data: transaction,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/transactions - List transactions
  fastify.get('/transactions', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = ListTransactionsSchema.parse(request.query);

      const result = await transactionService.listTransactions({
        userId: user.id,
        ...query,
      });

      return await reply.send({
        success: true,
        data: result.transactions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/transactions/:id - Get transaction details
  fastify.get('/transactions/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const transaction = await transactionService.getTransaction(id, user.id);

      return await reply.send({
        success: true,
        data: transaction,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /finance/transactions/:id - Update transaction
  fastify.patch('/transactions/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateTransactionSchema.parse(request.body);

      const transaction = await transactionService.updateTransaction(id, user.id, body);

      logger.info({ transactionId: id, userId: user.id }, 'Transaction updated');

      return await reply.send({
        success: true,
        data: transaction,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /finance/transactions/:id - Delete transaction
  fastify.delete('/transactions/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await transactionService.deleteTransaction(id, user.id);

      logger.info({ transactionId: id, userId: user.id }, 'Transaction deleted');

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /finance/transactions/bulk-categorize - Bulk categorize transactions
  fastify.post('/transactions/bulk-categorize', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = BulkCategorizeSchema.parse(request.body);

      const count = await transactionService.bulkUpdate({
        userId: user.id,
        transactionIds: body.transactionIds,
        updates: { categoryId: body.categoryId },
      });

      logger.info({ count, userId: user.id }, 'Transactions bulk categorized');

      return await reply.send({
        success: true,
        data: { updated: count },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /finance/transactions/:id/split - Split transaction
  fastify.post('/transactions/:id/split', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = SplitTransactionSchema.parse(request.body);

      const transactions = await transactionService.splitTransaction({
        userId: user.id,
        originalTransactionId: id,
        splits: body.splits,
      });

      logger.info(
        { originalId: id, splitCount: transactions.length, userId: user.id },
        'Transaction split'
      );

      return await reply.status(201).send({
        success: true,
        data: transactions,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /finance/transactions/:id/receipt - Upload receipt
  // TODO: Implement receipt upload functionality
  fastify.post('/transactions/:id/receipt', async (_request, reply) => {
    return reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Receipt upload not yet implemented' },
    });
  });

  // ==========================================================================
  // CATEGORY ROUTES
  // ==========================================================================

  // GET /finance/categories - List categories
  fastify.get('/categories', async (request, reply) => {
    try {
      const user = getUser(request);
      const transactionType = (request.query as any).transactionType as
        | 'INCOME'
        | 'EXPENSE'
        | undefined;

      const categories = await categoryRepo.findByUserId(user.id, transactionType);

      return await reply.send({
        success: true,
        data: categories,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /finance/categories - Create category
  fastify.post('/categories', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateCategorySchema.parse(request.body);

      const category = await categoryRepo.create({
        userId: user.id,
        ...body,
      });

      logger.info({ categoryId: category.id, userId: user.id }, 'Category created');

      return await reply.status(201).send({
        success: true,
        data: category,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/categories/hierarchy - Get categories as tree
  fastify.get('/categories/hierarchy', async (request, reply) => {
    try {
      const user = getUser(request);

      const hierarchy = await categoryRepo.findByFilters({
        userId: user.id,
        isActive: true,
        includeHierarchy: true,
      });

      return await reply.send({
        success: true,
        data: hierarchy,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // RECURRING TRANSACTION ROUTES
  // ==========================================================================

  // POST /finance/recurring - Create recurring transaction
  fastify.post('/recurring', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateRecurringSchema.parse(request.body);

      const recurring = await recurringRepo.create({
        userId: user.id,
        ...body,
      });

      logger.info({ recurringId: recurring.id, userId: user.id }, 'Recurring transaction created');

      return await reply.status(201).send({
        success: true,
        data: recurring,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/recurring - List recurring transactions
  fastify.get('/recurring', async (request, reply) => {
    try {
      const user = getUser(request);
      const includeInactive = (request.query as any).includeInactive === 'true';

      const recurring = await recurringRepo.findByUserId(user.id, includeInactive);

      return await reply.send({
        success: true,
        data: recurring,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/recurring/:id - Get recurring transaction
  fastify.get('/recurring/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const recurring = await recurringRepo.findById(id);

      if (!recurring || recurring.userId !== user.id) {
        return await reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recurring transaction not found' },
        });
      }

      return await reply.send({
        success: true,
        data: recurring,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /finance/recurring/:id - Update recurring transaction
  fastify.patch('/recurring/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateRecurringSchema.parse(request.body);

      const existing = await recurringRepo.findById(id);
      if (!existing || existing.userId !== user.id) {
        return await reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recurring transaction not found' },
        });
      }

      const recurring = await recurringRepo.update(id, body);

      logger.info({ recurringId: id, userId: user.id }, 'Recurring transaction updated');

      return await reply.send({
        success: true,
        data: recurring,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /finance/recurring/:id - Delete recurring transaction
  fastify.delete('/recurring/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const existing = await recurringRepo.findById(id);
      if (!existing || existing.userId !== user.id) {
        return await reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recurring transaction not found' },
        });
      }

      await recurringRepo.delete(id);

      logger.info({ recurringId: id, userId: user.id }, 'Recurring transaction deleted');

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // GOAL ROUTES
  // ==========================================================================

  // POST /finance/goals - Create goal
  fastify.post('/goals', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateGoalSchema.parse(request.body);

      const goal = await goalService.createGoal({
        userId: user.id,
        ...body,
      });

      logger.info({ goalId: goal.id, userId: user.id }, 'Goal created');

      return await reply.status(201).send({
        success: true,
        data: goal,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/goals - List goals
  fastify.get('/goals', async (request, reply) => {
    try {
      const user = getUser(request);
      const includeCompleted = (request.query as any).includeCompleted === 'true';

      const goals = await goalService.listGoals({
        userId: user.id,
        status: includeCompleted ? undefined : 'IN_PROGRESS',
      });

      return await reply.send({
        success: true,
        data: goals,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/goals/:id - Get goal with progress
  fastify.get('/goals/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const goal = await goalService.getGoal(id, user.id);

      return await reply.send({
        success: true,
        data: goal,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /finance/goals/:id - Update goal
  fastify.patch('/goals/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateGoalSchema.parse(request.body);

      const goal = await goalService.updateGoal(id, user.id, body);

      logger.info({ goalId: id, userId: user.id }, 'Goal updated');

      return await reply.send({
        success: true,
        data: goal,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /finance/goals/:id - Delete goal
  fastify.delete('/goals/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await goalService.deleteGoal(id, user.id);

      logger.info({ goalId: id, userId: user.id }, 'Goal deleted');

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // MILEAGE ROUTES
  // ==========================================================================

  // POST /finance/mileage - Create mileage log
  fastify.post('/mileage', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateMileageSchema.parse(request.body);

      const mileage = await mileageService.createMileageLog({
        userId: user.id,
        ...body,
      });

      logger.info({ mileageId: mileage.id, userId: user.id }, 'Mileage log created');

      return await reply.status(201).send({
        success: true,
        data: mileage,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/mileage - List mileage logs
  fastify.get('/mileage', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = ListMileageSchema.parse(request.query);

      const result = await mileageService.listMileageLogs({
        userId: user.id,
        ...query,
      });

      return await reply.send({
        success: true,
        data: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/mileage/:id - Get mileage log
  fastify.get('/mileage/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const mileage = await mileageService.getMileageLog(id, user.id);

      return await reply.send({
        success: true,
        data: mileage,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /finance/mileage/:id - Update mileage log
  fastify.patch('/mileage/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateMileageSchema.parse(request.body);

      const mileage = await mileageService.updateMileageLog(id, user.id, body);

      logger.info({ mileageId: id, userId: user.id }, 'Mileage log updated');

      return await reply.send({
        success: true,
        data: mileage,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /finance/mileage/:id - Delete mileage log
  fastify.delete('/mileage/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await mileageService.deleteMileageLog(id, user.id);

      logger.info({ mileageId: id, userId: user.id }, 'Mileage log deleted');

      return await reply.status(204).send();
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/mileage/summary - Get mileage summary
  fastify.get('/mileage/summary', async (request, reply) => {
    try {
      const user = getUser(request);
      const year = parseInt((request.query as any).year ?? new Date().getFullYear().toString(), 10);
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

      const summary = await mileageService.getMileageSummary(user.id, startDate, endDate);

      return await reply.send({
        success: true,
        data: summary,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // REPORT ROUTES
  // ==========================================================================

  // GET /finance/reports/profit-loss - Profit & Loss report
  fastify.get('/reports/profit-loss', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = ReportDateRangeSchema.parse(request.query);

      const report = await reportsService.generateProfitLossReport({
        userId: user.id,
        ...query,
      });

      return await reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/reports/cash-flow - Cash Flow report
  fastify.get('/reports/cash-flow', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = ReportDateRangeSchema.parse(request.query);

      const report = await reportsService.generateCashFlowReport({
        userId: user.id,
        ...query,
      });

      return await reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/reports/tax - Tax report (Schedule C aligned)
  fastify.get('/reports/tax', async (request, reply) => {
    try {
      const user = getUser(request);
      const year = parseInt((request.query as any).year ?? new Date().getFullYear().toString(), 10);

      const report = await reportsService.generateTaxReport(user.id, year);

      return await reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/reports/expense-breakdown - Expense breakdown by category
  fastify.get('/reports/expense-breakdown', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = ReportDateRangeSchema.parse(request.query);

      const report = await reportsService.generateExpenseBreakdown({
        userId: user.id,
        ...query,
      });

      return await reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/reports/income-sources - Income breakdown by source
  fastify.get('/reports/income-sources', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = ReportDateRangeSchema.parse(request.query);

      const report = await reportsService.generateIncomeSources({
        userId: user.id,
        ...query,
      });

      return await reply.send({
        success: true,
        data: report,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/reports/dashboard - Financial dashboard summary
  fastify.get('/reports/dashboard', async (request, reply) => {
    try {
      const user = getUser(request);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Get profit/loss for current month as dashboard summary
      const profitLoss = await reportsService.generateProfitLossReport({
        userId: user.id,
        startDate: startOfMonth,
        endDate: endOfMonth,
      });

      const dashboard = {
        period: profitLoss.period,
        summary: {
          totalIncome: profitLoss.income.total,
          totalExpenses: profitLoss.expenses.total,
          netProfit: profitLoss.netProfit,
          profitMargin: profitLoss.profitMargin,
        },
      };

      return await reply.send({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // TAX PROFILE ROUTES
  // ==========================================================================

  // POST /finance/tax-profile - Create or update tax profile
  fastify.post('/tax-profile', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateTaxProfileSchema.parse(request.body);

      const existing = await taxProfileRepo.findByUser(user.id);
      let profile;

      if (existing) {
        profile = await taxProfileRepo.update(existing.id, body);
      } else {
        profile = await taxProfileRepo.create({
          userId: user.id,
          ...body,
        });
      }

      logger.info({ profileId: profile.id, userId: user.id }, 'Tax profile saved');

      return await reply.status(existing ? 200 : 201).send({
        success: true,
        data: profile,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/tax-profile - Get tax profile
  fastify.get('/tax-profile', async (request, reply) => {
    try {
      const user = getUser(request);

      const profile = await taxProfileRepo.findByUser(user.id);

      if (!profile) {
        return await reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tax profile not found' },
        });
      }

      return await reply.send({
        success: true,
        data: profile,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /finance/tax-profile/quarterly-estimates - Get quarterly tax estimates
  fastify.get('/tax-profile/quarterly-estimates', async (request, reply) => {
    try {
      const user = getUser(request);
      const year = parseInt((request.query as any).year ?? new Date().getFullYear().toString(), 10);

      const estimates = await taxProfileRepo.getWithEstimates(user.id, year);

      if (!estimates) {
        return await reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Tax profile not found' },
        });
      }

      return await reply.send({
        success: true,
        data: estimates,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // PLAID ROUTES
  // ==========================================================================

  if (plaidService) {
    // POST /finance/plaid/link-token - Create Plaid link token
    fastify.post('/plaid/link-token', async (request, reply) => {
      try {
        const user = getUser(request);

        const token = await plaidService.createLinkToken(user.id);

        return await reply.send({
          success: true,
          data: token,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    });

    // POST /finance/plaid/connect - Connect Plaid accounts
    fastify.post('/plaid/connect', async (request, reply) => {
      try {
        const user = getUser(request);
        const body = PlaidConnectSchema.parse(request.body);

        const accounts = await plaidService.connectAccounts({
          userId: user.id,
          ...body,
        });

        logger.info({ accountCount: accounts.length, userId: user.id }, 'Plaid accounts connected');

        return await reply.status(201).send({
          success: true,
          data: accounts,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    });

    // POST /finance/plaid/sync/:accountId - Sync account transactions
    fastify.post('/plaid/sync/:accountId', async (request, reply) => {
      try {
        const user = getUser(request);
        const { accountId } = request.params as { accountId: string };

        // Verify ownership
        const account = await accountService.getAccount(accountId, user.id);
        if (!account) {
          return await reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Account not found' },
          });
        }

        const result = await plaidService.syncTransactions(accountId);

        logger.info({ accountId, ...result, userId: user.id }, 'Plaid sync completed');

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    });

    // POST /finance/plaid/disconnect/:accountId - Disconnect Plaid account
    fastify.post('/plaid/disconnect/:accountId', async (request, reply) => {
      try {
        const user = getUser(request);
        const { accountId } = request.params as { accountId: string };

        await plaidService.disconnectAccount(accountId, user.id);

        logger.info({ accountId, userId: user.id }, 'Plaid account disconnected');

        return await reply.send({
          success: true,
          data: { disconnected: true },
        });
      } catch (error) {
        return handleError(error, reply);
      }
    });

    // POST /finance/plaid/webhook - Plaid webhook handler
    fastify.post('/plaid/webhook', async (request, reply) => {
      try {
        const payload = request.body as any;

        await plaidService.handleWebhook(payload);

        return await reply.send({ received: true });
      } catch (error) {
        logger.error({ error }, 'Plaid webhook error');
        return await reply.send({ received: true }); // Always acknowledge
      }
    });

    // GET /finance/plaid/accounts-needing-reauth - Get accounts needing re-authentication
    fastify.get('/plaid/accounts-needing-reauth', async (request, reply) => {
      try {
        const user = getUser(request);

        const accounts = await plaidService.getAccountsNeedingReauth(user.id);

        return await reply.send({
          success: true,
          data: accounts,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    });
  }

  // ==========================================================================
  // EXPORT ROUTES
  // ==========================================================================

  // POST /finance/export - Export transactions
  fastify.post('/export', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = ExportTransactionsSchema.parse(request.body);

      // Get transactions
      const result = await transactionService.listTransactions({
        userId: user.id,
        startDate: body.startDate,
        endDate: body.endDate,
        accountId: body.accountId,
        categoryId: body.categoryId,
        transactionType: body.transactionType,
        limit: 10000, // Max export limit
        page: 1,
      });

      // Format based on requested format
      let content: string;
      let contentType: string;
      let filename: string;

      switch (body.format) {
        case 'CSV':
          content = formatTransactionsAsCSV(result.transactions);
          contentType = 'text/csv';
          filename = `transactions_${formatDateForFilename(body.startDate)}_${formatDateForFilename(body.endDate)}.csv`;
          break;

        case 'QBO':
          content = formatTransactionsAsQBO(result.transactions);
          contentType = 'application/x-qbo';
          filename = `transactions_${formatDateForFilename(body.startDate)}_${formatDateForFilename(body.endDate)}.qbo`;
          break;

        case 'OFX':
          content = formatTransactionsAsOFX(result.transactions);
          contentType = 'application/x-ofx';
          filename = `transactions_${formatDateForFilename(body.startDate)}_${formatDateForFilename(body.endDate)}.ofx`;
          break;

        case 'JSON':
        default:
          content = JSON.stringify(result.transactions, null, 2);
          contentType = 'application/json';
          filename = `transactions_${formatDateForFilename(body.startDate)}_${formatDateForFilename(body.endDate)}.json`;
      }

      logger.info(
        { format: body.format, count: result.transactions.length, userId: user.id },
        'Transactions exported'
      );

      return await reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(content);
    } catch (error) {
      return handleError(error, reply);
    }
  });
}

// ============================================================================
// Export Helpers
// ============================================================================

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0]!.replace(/-/g, '');
}

function formatTransactionsAsCSV(transactions: any[]): string {
  const headers = [
    'Date',
    'Type',
    'Amount',
    'Description',
    'Category',
    'Vendor',
    'Account',
    'Tax Deductible',
    'Status',
  ];

  const rows = transactions.map((t) => [
    t.transactionDate.toISOString().split('T')[0],
    t.transactionType,
    t.amount.toString(),
    `"${(t.description ?? '').replace(/"/g, '""')}"`,
    t.category?.name ?? '',
    `"${(t.vendor ?? '').replace(/"/g, '""')}"`,
    t.account?.name ?? '',
    t.isTaxDeductible ? 'Yes' : 'No',
    t.status,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function formatTransactionsAsQBO(transactions: any[]): string {
  // QuickBooks Web Connect format
  const lines = [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    'VERSION:102',
    'SECURITY:NONE',
    'ENCODING:USASCII',
    'CHARSET:1252',
    'COMPRESSION:NONE',
    'OLDFILEUID:NONE',
    'NEWFILEUID:NONE',
    '<OFX>',
    '<SIGNONMSGSRSV1>',
    '<SONRS>',
    '<STATUS>',
    '<CODE>0',
    '<SEVERITY>INFO',
    '</STATUS>',
    `<DTSERVER>${formatOFXDate(new Date())}`,
    '<LANGUAGE>ENG',
    '</SONRS>',
    '</SIGNONMSGSRSV1>',
    '<BANKMSGSRSV1>',
    '<STMTTRNRS>',
    '<TRNUID>1001',
    '<STATUS>',
    '<CODE>0',
    '<SEVERITY>INFO',
    '</STATUS>',
    '<STMTRS>',
    '<CURDEF>USD',
    '<BANKACCTFROM>',
    '<BANKID>000000000',
    '<ACCTID>EXPORT',
    '<ACCTTYPE>CHECKING',
    '</BANKACCTFROM>',
    '<BANKTRANLIST>',
  ];

  for (const t of transactions) {
    const amount = t.transactionType === 'INCOME' ? t.amount : -t.amount;
    lines.push(
      '<STMTTRN>',
      `<TRNTYPE>${t.transactionType === 'INCOME' ? 'CREDIT' : 'DEBIT'}`,
      `<DTPOSTED>${formatOFXDate(t.transactionDate)}`,
      `<TRNAMT>${amount.toFixed(2)}`,
      `<FITID>${t.id}`,
      `<NAME>${escapeXML(t.description ?? t.vendor ?? 'Transaction')}`,
      `<MEMO>${escapeXML(t.category?.name ?? '')}`,
      '</STMTTRN>'
    );
  }

  lines.push(
    '</BANKTRANLIST>',
    '<LEDGERBAL>',
    '<BALAMT>0.00',
    `<DTASOF>${formatOFXDate(new Date())}`,
    '</LEDGERBAL>',
    '</STMTRS>',
    '</STMTTRNRS>',
    '</BANKMSGSRSV1>',
    '</OFX>'
  );

  return lines.join('\n');
}

function formatTransactionsAsOFX(transactions: any[]): string {
  // Simplified OFX format (same as QBO for our purposes)
  return formatTransactionsAsQBO(transactions);
}

function formatOFXDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14);
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

