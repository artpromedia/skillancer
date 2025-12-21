/**
 * @module @skillancer/cockpit-svc/services/plaid
 * Plaid Integration Service - Bank connection and transaction sync
 */

import { FinanceError, FinanceErrorCode } from '../errors/finance.errors.js';
import {
  FinancialAccountRepository,
  FinancialTransactionRepository,
} from '../repositories/index.js';

import type {
  ConnectPlaidAccountParams,
  PlaidLinkToken,
  PlaidTransactionSync,
  PlaidWebhookPayload,
} from '../types/finance.types.js';
import type { PrismaClient, FinancialAccount } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// Plaid API types (would be imported from plaid-node in real implementation)
interface PlaidClient {
  linkTokenCreate(params: unknown): Promise<{ data: { link_token: string; expiration: string } }>;
  itemPublicTokenExchange(
    params: unknown
  ): Promise<{ data: { access_token: string; item_id: string } }>;
  transactionsSync(params: unknown): Promise<{ data: PlaidTransactionSync }>;
  itemRemove(params: unknown): Promise<void>;
  accountsGet(params: unknown): Promise<{ data: { accounts: unknown[] } }>;
}

export class PlaidService {
  private readonly accountRepository: FinancialAccountRepository;
  private readonly transactionRepository: FinancialTransactionRepository;
  private plaidClient: PlaidClient | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly config: {
      clientId: string;
      secret: string;
      env: 'sandbox' | 'development' | 'production';
      webhookUrl?: string;
    }
  ) {
    this.accountRepository = new FinancialAccountRepository(prisma);
    this.transactionRepository = new FinancialTransactionRepository(prisma);
    this.initializePlaidClient();
  }

  /**
   * Initialize Plaid client
   */
  private initializePlaidClient(): void {
    // In real implementation, would use plaid-node package
    // const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
    // const configuration = new Configuration({
    //   basePath: PlaidEnvironments[this.config.env],
    //   baseOptions: {
    //     headers: {
    //       'PLAID-CLIENT-ID': this.config.clientId,
    //       'PLAID-SECRET': this.config.secret,
    //     },
    //   },
    // });
    // this.plaidClient = new PlaidApi(configuration);

    this.logger.info({ env: this.config.env }, 'Plaid client initialized');
  }

  /**
   * Create a link token for Plaid Link
   */
  async createLinkToken(userId: string): Promise<PlaidLinkToken> {
    try {
      if (!this.plaidClient) {
        throw new FinanceError(FinanceErrorCode.PLAID_LINK_ERROR, {
          message: 'Plaid client not configured',
        });
      }

      const response = await this.plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Skillancer',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
        webhook: this.config.webhookUrl,
      });

      return {
        linkToken: response.data.link_token,
        expiration: new Date(response.data.expiration),
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to create Plaid link token');
      throw new FinanceError(FinanceErrorCode.PLAID_LINK_ERROR, {
        message: String(error),
      });
    }
  }

  /**
   * Exchange public token and create connected accounts
   */
  async connectAccounts(params: ConnectPlaidAccountParams): Promise<FinancialAccount[]> {
    try {
      if (!this.plaidClient) {
        throw new FinanceError(FinanceErrorCode.PLAID_LINK_ERROR, {
          message: 'Plaid client not configured',
        });
      }

      // Exchange public token for access token
      const exchangeResponse = await this.plaidClient.itemPublicTokenExchange({
        public_token: params.publicToken,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // Create accounts for each selected account
      const createdAccounts: FinancialAccount[] = [];

      for (const accountInfo of params.accounts) {
        const accountType = this.mapPlaidAccountType(accountInfo.type, accountInfo.subtype);

        const account = await this.accountRepository.createPlaidAccount({
          userId: params.userId,
          accountType,
          name: accountInfo.name,
          institutionName: params.institutionName,
          plaidItemId: itemId,
          plaidAccountId: accountInfo.id,
          plaidAccessToken: accessToken,
          accountNumber: accountInfo.mask,
          currentBalance: accountInfo.currentBalance,
          currency: 'USD',
        });

        createdAccounts.push(account);
      }

      this.logger.info(
        {
          userId: params.userId,
          institutionName: params.institutionName,
          accountCount: createdAccounts.length,
        },
        'Plaid accounts connected'
      );

      // Trigger initial sync
      for (const account of createdAccounts) {
        void this.syncTransactions(account.id);
      }

      return createdAccounts;
    } catch (error) {
      this.logger.error({ error, userId: params.userId }, 'Failed to connect Plaid accounts');
      throw new FinanceError(FinanceErrorCode.PLAID_LINK_ERROR, {
        message: String(error),
      });
    }
  }

  /**
   * Sync transactions for an account
   */
  async syncTransactions(accountId: string): Promise<{
    added: number;
    modified: number;
    removed: number;
  }> {
    const account = await this.accountRepository.findById(accountId);

    if (!account) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    if (!account.isPlaidConnected || !account.plaidAccessToken) {
      throw new FinanceError(FinanceErrorCode.PLAID_CONNECTION_REQUIRED);
    }

    try {
      // Update sync status
      await this.accountRepository.updatePlaidSyncStatus(accountId, {
        syncStatus: 'SYNCING',
      });

      if (!this.plaidClient) {
        throw new FinanceError(FinanceErrorCode.PLAID_SYNC_ERROR, {
          message: 'Plaid client not configured',
        });
      }

      let added = 0;
      let modified = 0;
      let removed = 0;
      let hasMore = true;
      let cursor = account.syncCursor;

      while (hasMore) {
        const response = await this.plaidClient.transactionsSync({
          access_token: account.plaidAccessToken,
          cursor: cursor ?? undefined,
        });

        const syncData = response.data;

        // Process added transactions
        for (const transaction of syncData.added) {
          await this.transactionRepository.createFromPlaid({
            userId: account.userId,
            accountId: account.id,
            transactionType: transaction.amount < 0 ? 'INCOME' : 'EXPENSE',
            amount: Math.abs(transaction.amount),
            transactionDate: new Date(transaction.date),
            description: transaction.name,
            vendor: transaction.merchantName,
            plaidTransactionId: transaction.transactionId,
            isPending: transaction.pending,
          });
          added++;
        }

        // Process modified transactions
        for (const transaction of syncData.modified) {
          await this.transactionRepository.updateFromPlaid(transaction.transactionId, {
            amount: Math.abs(transaction.amount),
            transactionDate: new Date(transaction.date),
            description: transaction.name,
            vendor: transaction.merchantName,
            isPending: transaction.pending,
          });
          modified++;
        }

        // Process removed transactions
        if (syncData.removed.length > 0) {
          removed = await this.transactionRepository.deleteByPlaidIds(syncData.removed);
        }

        cursor = syncData.nextCursor;
        hasMore = syncData.hasMore;
      }

      // Update sync status
      await this.accountRepository.updatePlaidSyncStatus(accountId, {
        lastSyncAt: new Date(),
        syncCursor: cursor ?? undefined,
        syncStatus: 'SYNCED',
        syncError: null,
      });

      this.logger.info({ accountId, added, modified, removed }, 'Transaction sync completed');

      return { added, modified, removed };
    } catch (error) {
      await this.accountRepository.updatePlaidSyncStatus(accountId, {
        syncStatus: 'ERROR',
        syncError: String(error),
      });

      this.logger.error({ error, accountId }, 'Transaction sync failed');
      throw new FinanceError(FinanceErrorCode.PLAID_SYNC_ERROR, {
        message: String(error),
      });
    }
  }

  /**
   * Handle Plaid webhook
   */
  async handleWebhook(payload: PlaidWebhookPayload): Promise<void> {
    this.logger.info(
      { webhookType: payload.webhookType, webhookCode: payload.webhookCode },
      'Plaid webhook received'
    );

    switch (payload.webhookType) {
      case 'TRANSACTIONS':
        await this.handleTransactionsWebhook(payload);
        break;

      case 'ITEM':
        await this.handleItemWebhook(payload);
        break;

      case 'SYNC_UPDATES':
        await this.handleSyncUpdatesWebhook(payload);
        break;

      default:
        this.logger.warn({ payload }, 'Unknown webhook type');
    }
  }

  /**
   * Handle transactions webhook
   */
  private async handleTransactionsWebhook(payload: PlaidWebhookPayload): Promise<void> {
    const accounts = await this.accountRepository.findByPlaidItemId(payload.itemId);

    for (const account of accounts) {
      if (
        payload.webhookCode === 'SYNC_UPDATES_AVAILABLE' ||
        payload.webhookCode === 'DEFAULT_UPDATE'
      ) {
        await this.syncTransactions(account.id);
      }
    }
  }

  /**
   * Handle item webhook (errors, login required, etc.)
   */
  private async handleItemWebhook(payload: PlaidWebhookPayload): Promise<void> {
    const accounts = await this.accountRepository.findByPlaidItemId(payload.itemId);

    if (payload.webhookCode === 'ERROR' || payload.webhookCode === 'PENDING_EXPIRATION') {
      for (const account of accounts) {
        await this.accountRepository.updatePlaidSyncStatus(account.id, {
          syncStatus: 'ERROR',
          syncError: payload.error?.errorMessage ?? 'Connection error',
        });
      }
    }
  }

  /**
   * Handle sync updates webhook
   */
  private async handleSyncUpdatesWebhook(payload: PlaidWebhookPayload): Promise<void> {
    const accounts = await this.accountRepository.findByPlaidItemId(payload.itemId);

    for (const account of accounts) {
      await this.syncTransactions(account.id);
    }
  }

  /**
   * Disconnect a Plaid account
   */
  async disconnectAccount(accountId: string, userId: string): Promise<void> {
    const account = await this.accountRepository.findById(accountId);

    if (!account || account.userId !== userId) {
      throw new FinanceError(FinanceErrorCode.ACCOUNT_NOT_FOUND);
    }

    if (!account.isPlaidConnected) {
      throw new FinanceError(FinanceErrorCode.PLAID_CONNECTION_REQUIRED);
    }

    try {
      // Remove item from Plaid (optional - keeps historical data)
      if (this.plaidClient && account.plaidAccessToken) {
        await this.plaidClient.itemRemove({
          access_token: account.plaidAccessToken,
        });
      }

      // Update account to remove Plaid connection
      await this.accountRepository.disconnectPlaid(accountId);

      this.logger.info({ accountId, userId }, 'Plaid account disconnected');
    } catch (error) {
      this.logger.error({ error, accountId }, 'Failed to disconnect Plaid account');
      throw new FinanceError(FinanceErrorCode.PLAID_ITEM_ERROR, {
        message: String(error),
      });
    }
  }

  /**
   * Get accounts requiring re-authentication
   */
  async getAccountsNeedingReauth(userId: string): Promise<FinancialAccount[]> {
    const accounts = await this.accountRepository.findByUserId(userId, false);

    return accounts.filter((a) => a.isPlaidConnected && a.syncStatus === 'ERROR');
  }

  /**
   * Map Plaid account type to our account type
   */
  private mapPlaidAccountType(
    plaidType: string,
    plaidSubtype?: string
  ): 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'PAYPAL' | 'OTHER' {
    switch (plaidType) {
      case 'depository':
        if (plaidSubtype === 'checking') return 'CHECKING';
        if (plaidSubtype === 'savings') return 'SAVINGS';
        return 'CHECKING';

      case 'credit':
        return 'CREDIT_CARD';

      default:
        return 'OTHER';
    }
  }
}
