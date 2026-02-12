// @ts-nocheck
/**
 * Stripe Treasury Service
 * Manages freelancer financial accounts with FDIC insurance
 * Sprint M5: Freelancer Financial Services
 */

import Stripe from 'stripe';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TreasuryAccount {
  id: string;
  stripeFinancialAccountId: string;
  stripeConnectAccountId: string;
  userId: string;
  status: TreasuryAccountStatus;
  features: AccountFeatures;
  balances: AccountBalances;
  accountDetails?: BankAccountDetails;
  createdAt: Date;
  updatedAt: Date;
}

export type TreasuryAccountStatus = 'pending_verification' | 'active' | 'restricted' | 'closed';

export interface AccountFeatures {
  inboundTransfers: boolean;
  outboundTransfers: boolean;
  outboundPayments: boolean;
  financialAddresses: boolean;
  cardIssuing: boolean;
}

export interface AccountBalances {
  available: number;
  pending: number;
  reserved: number;
  taxVault: number;
  currency: string;
}

export interface BankAccountDetails {
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  accountType: 'checking';
}

export interface CreateAccountRequest {
  userId: string;
  stripeConnectAccountId: string;
  acceptedTerms: boolean;
}

export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  type?: 'credit' | 'debit';
  status?: string;
  limit?: number;
  startingAfter?: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  description: string;
  status: string;
  createdAt: Date;
  flow?: string;
  flowDetails?: any;
}

export interface AccountStatement {
  id: string;
  period: { start: Date; end: Date };
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  downloadUrl?: string;
}

// ============================================================================
// TREASURY SERVICE
// ============================================================================

export class TreasuryService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
  }

  // ==========================================================================
  // ACCOUNT MANAGEMENT
  // ==========================================================================

  /**
   * Create a new Treasury financial account for a freelancer
   */
  async createAccount(request: CreateAccountRequest): Promise<TreasuryAccount> {
    const { userId, stripeConnectAccountId, acceptedTerms } = request;

    if (!acceptedTerms) {
      throw new Error('User must accept Treasury terms and conditions');
    }

    // Check if user already has an account
    const existing = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new Error('User already has a Treasury account');
    }

    try {
      // Create Financial Account in Stripe
      const financialAccount = await this.stripe.treasury.financialAccounts.create(
        {
          supported_currencies: ['usd'],
          features: {
            card_issuing: { requested: true },
            deposit_insurance: { requested: true },
            financial_addresses: { aba: { requested: true } },
            inbound_transfers: { ach: { requested: true } },
            intra_stripe_flows: { requested: true },
            outbound_payments: {
              ach: { requested: true },
              us_domestic_wire: { requested: true },
            },
            outbound_transfers: {
              ach: { requested: true },
              us_domestic_wire: { requested: true },
            },
          },
        },
        { stripeAccount: stripeConnectAccountId }
      );

      // Get financial address (account/routing numbers)
      const addresses = await this.stripe.treasury.financialAccounts.retrieveFeatures(
        financialAccount.id,
        { stripeAccount: stripeConnectAccountId }
      );

      // Store in database
      const treasuryAccount = await prisma.treasuryAccount.create({
        data: {
          userId,
          stripeFinancialAccountId: financialAccount.id,
          stripeConnectAccountId,
          status: this.mapStripeStatus(financialAccount.status),
          features: {
            inboundTransfers: financialAccount.active_features.includes('inbound_transfers.ach'),
            outboundTransfers: financialAccount.active_features.includes('outbound_transfers.ach'),
            outboundPayments: financialAccount.active_features.includes('outbound_payments.ach'),
            financialAddresses:
              financialAccount.active_features.includes('financial_addresses.aba'),
            cardIssuing: financialAccount.active_features.includes('card_issuing'),
          },
          balancesData: {
            available: 0,
            pending: 0,
            reserved: 0,
            taxVault: 0,
            currency: 'usd',
          },
          termsAcceptedAt: new Date(),
        },
      });

      logger.info('Treasury account created', {
        userId,
        financialAccountId: financialAccount.id,
      });

      return this.mapToTreasuryAccount(treasuryAccount, financialAccount);
    } catch (error) {
      logger.error('Failed to create Treasury account', { userId, error });
      throw error;
    }
  }

  /**
   * Get a user's Treasury account
   */
  async getAccount(userId: string): Promise<TreasuryAccount | null> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return null;
    }

    // Fetch latest data from Stripe
    const financialAccount = await this.stripe.treasury.financialAccounts.retrieve(
      account.stripeFinancialAccountId,
      { stripeAccount: account.stripeConnectAccountId }
    );

    return this.mapToTreasuryAccount(account, financialAccount);
  }

  /**
   * Get account bank details (account number, routing number)
   */
  async getAccountDetails(userId: string): Promise<BankAccountDetails | null> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return null;
    }

    // Fetch financial addresses from Stripe
    const financialAccount = await this.stripe.treasury.financialAccounts.retrieve(
      account.stripeFinancialAccountId,
      {
        expand: ['financial_addresses'],
      },
      { stripeAccount: account.stripeConnectAccountId }
    );

    const abaAddress = financialAccount.financial_addresses?.find((addr) => addr.type === 'aba');

    if (!abaAddress || !abaAddress.aba) {
      return null;
    }

    return {
      accountNumber: abaAddress.aba.account_number,
      routingNumber: abaAddress.aba.routing_number,
      bankName: abaAddress.aba.bank_name || 'Evolve Bank & Trust',
      accountType: 'checking',
    };
  }

  /**
   * Close a Treasury account
   */
  async closeAccount(userId: string, reason: string): Promise<void> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error('Treasury account not found');
    }

    // Check balance is zero
    const balance = await this.getBalance(userId);
    if (balance && (balance.available > 0 || balance.pending > 0)) {
      throw new Error('Account must have zero balance before closing');
    }

    // Close in Stripe
    await this.stripe.treasury.financialAccounts.update(
      account.stripeFinancialAccountId,
      { status: 'closed' },
      { stripeAccount: account.stripeConnectAccountId }
    );

    // Update database
    await prisma.treasuryAccount.update({
      where: { userId },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closureReason: reason,
      },
    });

    logger.info('Treasury account closed', { userId, reason });
  }

  // ==========================================================================
  // BALANCE MANAGEMENT
  // ==========================================================================

  /**
   * Get current account balances
   */
  async getBalance(userId: string): Promise<AccountBalances | null> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return null;
    }

    // Fetch latest balance from Stripe
    const financialAccount = await this.stripe.treasury.financialAccounts.retrieve(
      account.stripeFinancialAccountId,
      { stripeAccount: account.stripeConnectAccountId }
    );

    const balance = financialAccount.balance;
    const taxVault = await this.getTaxVaultBalance(userId);

    const balances: AccountBalances = {
      available: (balance.cash?.usd || 0) / 100 - taxVault,
      pending: (balance.inbound_pending?.usd || 0) / 100,
      reserved: (balance.outbound_pending?.usd || 0) / 100,
      taxVault,
      currency: 'usd',
    };

    // Update cached balances
    await prisma.treasuryAccount.update({
      where: { userId },
      data: { balancesData: balances as any },
    });

    return balances;
  }

  /**
   * Get tax vault balance
   */
  private async getTaxVaultBalance(userId: string): Promise<number> {
    const taxVault = await prisma.taxVault.findUnique({
      where: { userId },
    });
    return taxVault?.balance?.toNumber() || 0;
  }

  // ==========================================================================
  // TRANSACTIONS
  // ==========================================================================

  /**
   * List account transactions
   */
  async listTransactions(
    userId: string,
    filter: TransactionFilter = {}
  ): Promise<{ transactions: Transaction[]; hasMore: boolean }> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error('Treasury account not found');
    }

    const params: Stripe.Treasury.TransactionListParams = {
      financial_account: account.stripeFinancialAccountId,
      limit: filter.limit || 25,
    };

    if (filter.startDate) {
      params.created = { gte: Math.floor(filter.startDate.getTime() / 1000) };
    }
    if (filter.endDate) {
      params.created = {
        ...(params.created as any),
        lte: Math.floor(filter.endDate.getTime() / 1000),
      };
    }
    if (filter.startingAfter) {
      params.starting_after = filter.startingAfter;
    }
    if (filter.status) {
      params.status = filter.status as any;
    }

    const stripeTransactions = await this.stripe.treasury.transactions.list(params, {
      stripeAccount: account.stripeConnectAccountId,
    });

    const transactions: Transaction[] = stripeTransactions.data.map((tx) => ({
      id: tx.id,
      type: tx.flow_type === 'received_credit' ? 'credit' : 'debit',
      amount: tx.amount / 100,
      currency: tx.currency,
      description: tx.description || this.getTransactionDescription(tx),
      status: tx.status,
      createdAt: new Date(tx.created * 1000),
      flow: tx.flow,
      flowDetails: tx.flow_details,
    }));

    return {
      transactions,
      hasMore: stripeTransactions.has_more,
    };
  }

  /**
   * Get transaction description
   */
  private getTransactionDescription(tx: Stripe.Treasury.Transaction): string {
    switch (tx.flow_type) {
      case 'received_credit':
        return 'Received payment';
      case 'received_debit':
        return 'Debit';
      case 'outbound_payment':
        return 'Outbound payment';
      case 'outbound_transfer':
        return 'Transfer to bank';
      case 'inbound_transfer':
        return 'Transfer from bank';
      case 'issuing_authorization':
        return 'Card purchase';
      default:
        return 'Transaction';
    }
  }

  // ==========================================================================
  // STATEMENTS
  // ==========================================================================

  /**
   * Get account statements
   */
  async getStatements(userId: string, year?: number): Promise<AccountStatement[]> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new Error('Treasury account not found');
    }

    // For now, generate statements from transaction history
    // In production, Stripe Treasury provides monthly statements
    const targetYear = year || new Date().getFullYear();
    const statements: AccountStatement[] = [];

    for (let month = 0; month < 12; month++) {
      const start = new Date(targetYear, month, 1);
      const end = new Date(targetYear, month + 1, 0);

      if (end > new Date()) break;

      const { transactions } = await this.listTransactions(userId, {
        startDate: start,
        endDate: end,
        limit: 1000,
      });

      if (transactions.length === 0) continue;

      const credits = transactions
        .filter((tx) => tx.type === 'credit')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const debits = transactions
        .filter((tx) => tx.type === 'debit')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      statements.push({
        id: `stmt_${targetYear}_${month + 1}`,
        period: { start, end },
        openingBalance: 0, // Would calculate from previous month
        closingBalance: credits - debits,
        totalCredits: credits,
        totalDebits: debits,
        transactionCount: transactions.length,
      });
    }

    return statements;
  }

  // ==========================================================================
  // KYC & COMPLIANCE
  // ==========================================================================

  /**
   * Get KYC verification status
   */
  async getKycStatus(userId: string): Promise<{
    status: 'unverified' | 'pending' | 'verified' | 'rejected';
    requirements?: string[];
    deadline?: Date;
  }> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return { status: 'unverified' };
    }

    // Check Connect account verification status
    const connectAccount = await this.stripe.accounts.retrieve(account.stripeConnectAccountId);

    if (connectAccount.requirements?.currently_due?.length) {
      return {
        status: 'pending',
        requirements: connectAccount.requirements.currently_due,
        deadline: connectAccount.requirements.current_deadline
          ? new Date(connectAccount.requirements.current_deadline * 1000)
          : undefined,
      };
    }

    if (connectAccount.requirements?.disabled_reason) {
      return {
        status: 'rejected',
        requirements: connectAccount.requirements.past_due,
      };
    }

    return { status: 'verified' };
  }

  /**
   * Check transaction limits
   */
  async checkTransactionLimits(
    userId: string,
    amount: number,
    type: 'payout' | 'transfer'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
  }> {
    // Get daily transaction totals
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyTotal = await prisma.treasuryTransaction.aggregate({
      where: {
        userId,
        type,
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    });

    const dailyLimit = type === 'payout' ? 10000 : 50000; // $10K instant, $50K transfer
    const usedToday = dailyTotal._sum.amount?.toNumber() || 0;
    const remaining = dailyLimit - usedToday;

    if (amount > remaining) {
      return {
        allowed: false,
        reason: `Daily ${type} limit exceeded. Remaining: $${remaining.toFixed(2)}`,
        remaining,
      };
    }

    return { allowed: true, remaining };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private mapStripeStatus(status: string): TreasuryAccountStatus {
    switch (status) {
      case 'open':
        return 'active';
      case 'closed':
        return 'closed';
      default:
        return 'pending_verification';
    }
  }

  private mapToTreasuryAccount(
    dbAccount: any,
    stripeAccount: Stripe.Treasury.FinancialAccount
  ): TreasuryAccount {
    return {
      id: dbAccount.id,
      stripeFinancialAccountId: dbAccount.stripeFinancialAccountId,
      stripeConnectAccountId: dbAccount.stripeConnectAccountId,
      userId: dbAccount.userId,
      status: this.mapStripeStatus(stripeAccount.status),
      features: dbAccount.features as AccountFeatures,
      balances: dbAccount.balancesData as AccountBalances,
      createdAt: dbAccount.createdAt,
      updatedAt: dbAccount.updatedAt,
    };
  }
}

// Singleton instance
let treasuryServiceInstance: TreasuryService | null = null;

export function getTreasuryService(): TreasuryService {
  if (!treasuryServiceInstance) {
    treasuryServiceInstance = new TreasuryService();
  }
  return treasuryServiceInstance;
}
