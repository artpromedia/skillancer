// @ts-nocheck
/**
 * Retirement Savings Service
 * SEP-IRA and Solo 401(k) management
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'retirement-service' });

// ============================================================================
// TYPES
// ============================================================================

export type AccountType = 'sep_ira' | 'solo_401k' | 'traditional_ira' | 'roth_ira';
export type Provider = 'betterment' | 'wealthfront' | 'vanguard' | 'fidelity';

export interface RetirementAccount {
  id: string;
  userId: string;
  provider: Provider;
  accountType: AccountType;
  externalAccountId?: string;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  balance: number;
  ytdContributions: number;
  createdAt: Date;
  lastSyncAt?: Date;
}

export interface ContributionSettings {
  userId: string;
  enabled: boolean;
  percentage: number; // % of earnings
  timing: 'per_payment' | 'monthly' | 'manual';
  accountId: string;
  maxAnnual?: number;
}

export interface Contribution {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  sourceType: 'auto' | 'manual';
  sourceId?: string; // Payment ID if auto
  status: 'pending' | 'processing' | 'completed' | 'failed';
  taxYear: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface ContributionLimits {
  accountType: AccountType;
  taxYear: number;
  maxContribution: number;
  catchUpContribution: number; // For 50+
  currentContributions: number;
  remainingRoom: number;
}

// ============================================================================
// CONTRIBUTION LIMITS (2024)
// ============================================================================

const LIMITS_2024 = {
  sep_ira: {
    maxContribution: 69000, // 25% of net SE income up to this
    percentOfIncome: 25,
  },
  solo_401k: {
    employeeContribution: 23000, // As employee
    employerContribution: 46000, // 25% of compensation
    totalMax: 69000,
    catchUp: 7500, // 50+ catch-up
  },
  traditional_ira: {
    maxContribution: 7000,
    catchUp: 1000,
  },
  roth_ira: {
    maxContribution: 7000,
    catchUp: 1000,
  },
};

// ============================================================================
// RETIREMENT SERVICE
// ============================================================================

class RetirementService {
  // --------------------------------------------------------------------------
  // ACCOUNT MANAGEMENT
  // --------------------------------------------------------------------------

  async connectAccount(
    userId: string,
    provider: Provider,
    accountType: AccountType,
    oauthToken: string
  ): Promise<RetirementAccount> {
    logger.info('Connecting retirement account', { userId, provider, accountType });

    // In production, verify OAuth token with provider
    const externalAccountId = await this.verifyProviderConnection(provider, oauthToken);

    const account: RetirementAccount = {
      id: `RET-${Date.now()}`,
      userId,
      provider,
      accountType,
      externalAccountId,
      status: 'active',
      balance: 0,
      ytdContributions: 0,
      createdAt: new Date(),
    };

    await this.saveAccount(account);
    await this.syncAccountBalance(account.id);

    metrics.increment('retirement.account.connected', { provider, accountType });

    return account;
  }

  async disconnectAccount(accountId: string): Promise<void> {
    logger.info('Disconnecting retirement account', { accountId });

    const account = await this.getAccount(accountId);
    if (!account) throw new Error('Account not found');

    account.status = 'closed';
    await this.saveAccount(account);

    // Disable auto-contributions
    await this.disableAutoContribution(account.userId);

    metrics.increment('retirement.account.disconnected');
  }

  async getAccount(accountId: string): Promise<RetirementAccount | null> {
    // In production, query database
    return null;
  }

  async getUserAccount(userId: string): Promise<RetirementAccount | null> {
    // In production, query database
    return null;
  }

  async syncAccountBalance(accountId: string): Promise<void> {
    logger.info('Syncing account balance', { accountId });

    const account = await this.getAccount(accountId);
    if (!account) return;

    // In production, call provider API
    const balance = await this.fetchProviderBalance(account);

    account.balance = balance;
    account.lastSyncAt = new Date();
    await this.saveAccount(account);
  }

  // --------------------------------------------------------------------------
  // CONTRIBUTION SETTINGS
  // --------------------------------------------------------------------------

  async getContributionSettings(userId: string): Promise<ContributionSettings | null> {
    // In production, query database
    return null;
  }

  async updateContributionSettings(
    userId: string,
    settings: Partial<ContributionSettings>
  ): Promise<ContributionSettings> {
    logger.info('Updating contribution settings', { userId, settings });

    let current = await this.getContributionSettings(userId);

    if (!current) {
      const account = await this.getUserAccount(userId);
      if (!account) throw new Error('No retirement account connected');

      current = {
        userId,
        enabled: false,
        percentage: 10,
        timing: 'per_payment',
        accountId: account.id,
      };
    }

    const updated = { ...current, ...settings };
    await this.saveContributionSettings(updated);

    metrics.increment('retirement.settings.updated');

    return updated;
  }

  async enableAutoContribution(
    userId: string,
    percentage: number,
    timing: 'per_payment' | 'monthly' = 'per_payment'
  ): Promise<ContributionSettings> {
    return this.updateContributionSettings(userId, {
      enabled: true,
      percentage,
      timing,
    });
  }

  async disableAutoContribution(userId: string): Promise<void> {
    await this.updateContributionSettings(userId, { enabled: false });
  }

  // --------------------------------------------------------------------------
  // CONTRIBUTIONS
  // --------------------------------------------------------------------------

  async processAutoContribution(
    userId: string,
    paymentAmount: number,
    paymentId: string
  ): Promise<Contribution | null> {
    logger.info('Processing auto contribution', { userId, paymentAmount });

    const settings = await this.getContributionSettings(userId);
    if (!settings?.enabled || settings.timing !== 'per_payment') {
      return null;
    }

    const contributionAmount = Math.round(paymentAmount * (settings.percentage / 100) * 100) / 100;

    // Check limits
    const limits = await this.getContributionLimits(userId);
    const actualAmount = Math.min(contributionAmount, limits.remainingRoom);

    if (actualAmount <= 0) {
      logger.info('Contribution limit reached', { userId });
      return null;
    }

    return this.makeContribution(userId, actualAmount, 'auto', paymentId);
  }

  async makeContribution(
    userId: string,
    amount: number,
    type: 'auto' | 'manual',
    sourceId?: string
  ): Promise<Contribution> {
    logger.info('Making contribution', { userId, amount, type });

    const account = await this.getUserAccount(userId);
    if (!account) throw new Error('No retirement account');

    // Check limits
    const limits = await this.getContributionLimits(userId);
    if (amount > limits.remainingRoom) {
      throw new Error(`Amount exceeds remaining contribution room ($${limits.remainingRoom})`);
    }

    const contribution: Contribution = {
      id: `CONTRIB-${Date.now()}`,
      userId,
      accountId: account.id,
      amount,
      sourceType: type,
      sourceId,
      status: 'pending',
      taxYear: new Date().getFullYear(),
      createdAt: new Date(),
    };

    await this.saveContribution(contribution);

    // Initiate transfer to provider
    try {
      await this.initiateTransfer(account, amount);
      contribution.status = 'processing';
      await this.saveContribution(contribution);

      metrics.increment('retirement.contribution.initiated', { type });
      metrics.histogram('retirement.contribution.amount', amount);
    } catch (error) {
      contribution.status = 'failed';
      await this.saveContribution(contribution);
      throw error;
    }

    return contribution;
  }

  async getContributions(
    userId: string,
    taxYear?: number
  ): Promise<{ contributions: Contribution[]; total: number }> {
    // In production, query database
    return { contributions: [], total: 0 };
  }

  // --------------------------------------------------------------------------
  // LIMITS
  // --------------------------------------------------------------------------

  async getContributionLimits(userId: string): Promise<ContributionLimits> {
    const account = await this.getUserAccount(userId);
    const accountType = account?.accountType || 'sep_ira';
    const taxYear = new Date().getFullYear();

    // Get user's net SE income for SEP-IRA calculation
    const netSeIncome = await this.getNetSeIncome(userId, taxYear);

    let maxContribution: number;
    if (accountType === 'sep_ira') {
      maxContribution = Math.min(
        netSeIncome * (LIMITS_2024.sep_ira.percentOfIncome / 100),
        LIMITS_2024.sep_ira.maxContribution
      );
    } else {
      maxContribution = LIMITS_2024[accountType]?.maxContribution || 7000;
    }

    // Get current YTD contributions
    const { total: currentContributions } = await this.getContributions(userId, taxYear);

    return {
      accountType,
      taxYear,
      maxContribution,
      catchUpContribution: 0, // Would check user age for 50+ catch-up
      currentContributions,
      remainingRoom: Math.max(0, maxContribution - currentContributions),
    };
  }

  async getMaxContributionCalculator(
    userId: string,
    projectedIncome: number
  ): Promise<{
    sepIra: number;
    solo401kEmployee: number;
    solo401kTotal: number;
    taxSavings: number;
  }> {
    // Calculate max contributions based on projected income
    const netSeIncome = projectedIncome * 0.9235; // After SE tax deduction

    const sepIra = Math.min(netSeIncome * 0.25, LIMITS_2024.sep_ira.maxContribution);

    const solo401kEmployee = LIMITS_2024.solo_401k.employeeContribution;
    const solo401kEmployer = Math.min(
      netSeIncome * 0.25,
      LIMITS_2024.solo_401k.employerContribution
    );
    const solo401kTotal = Math.min(
      solo401kEmployee + solo401kEmployer,
      LIMITS_2024.solo_401k.totalMax
    );

    // Estimate tax savings (assumes 30% marginal rate)
    const taxSavings = Math.round(sepIra * 0.3);

    return {
      sepIra: Math.round(sepIra),
      solo401kEmployee,
      solo401kTotal: Math.round(solo401kTotal),
      taxSavings,
    };
  }

  // --------------------------------------------------------------------------
  // TAX BENEFITS
  // --------------------------------------------------------------------------

  async getTaxBenefitSummary(
    userId: string,
    taxYear: number
  ): Promise<{
    totalContributions: number;
    estimatedTaxSavings: number;
    effectiveCost: number;
    comparisonToTaxable: { taxable: number; taxAdvantaged: number; difference: number };
  }> {
    const { total: totalContributions } = await this.getContributions(userId, taxYear);

    // Estimate at 30% marginal rate
    const estimatedTaxSavings = Math.round(totalContributions * 0.3);
    const effectiveCost = totalContributions - estimatedTaxSavings;

    // 20-year comparison (7% return)
    const years = 20;
    const annualReturn = 0.07;
    const taxRate = 0.3;

    const taxAdvantaged = totalContributions * Math.pow(1 + annualReturn, years);
    const afterTaxContribution = totalContributions * (1 - taxRate);
    const taxable = afterTaxContribution * Math.pow(1 + annualReturn * (1 - 0.15), years); // 15% cap gains drag

    return {
      totalContributions,
      estimatedTaxSavings,
      effectiveCost,
      comparisonToTaxable: {
        taxable: Math.round(taxable),
        taxAdvantaged: Math.round(taxAdvantaged),
        difference: Math.round(taxAdvantaged - taxable),
      },
    };
  }

  // --------------------------------------------------------------------------
  // PROVIDER INTEGRATION
  // --------------------------------------------------------------------------

  private async verifyProviderConnection(provider: Provider, oauthToken: string): Promise<string> {
    // In production, verify with provider API
    return `ext-${provider}-${Date.now()}`;
  }

  private async fetchProviderBalance(account: RetirementAccount): Promise<number> {
    // In production, call provider API
    return 15000;
  }

  private async initiateTransfer(account: RetirementAccount, amount: number): Promise<void> {
    logger.info('Initiating transfer to provider', {
      provider: account.provider,
      amount,
    });

    // In production, use provider API to initiate ACH transfer
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private async getNetSeIncome(userId: string, taxYear: number): Promise<number> {
    // In production, calculate from gross income minus business expenses
    return 75000;
  }

  private async saveAccount(account: RetirementAccount): Promise<void> {
    // In production, save to database
  }

  private async saveContributionSettings(settings: ContributionSettings): Promise<void> {
    // In production, save to database
  }

  private async saveContribution(contribution: Contribution): Promise<void> {
    // In production, save to database
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let retirementService: RetirementService | null = null;

export function getRetirementService(): RetirementService {
  if (!retirementService) {
    retirementService = new RetirementService();
  }
  return retirementService;
}
