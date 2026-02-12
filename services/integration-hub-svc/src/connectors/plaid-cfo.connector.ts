// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/connectors/plaid-cfo
 * Plaid CFO Connector - Banking Data for CFO Tool Suite
 *
 * CFO-focused Plaid integration for:
 * - All accounts summary across institutions
 * - Transaction categorization for cash flow
 * - Bank account reconciliation
 * - Cash position aggregation
 */

import type { ExecutiveType } from '@skillancer/database';
import type {
  ConnectorInfo,
  FetchOptions,
  FetchResult,
  IntegrationCategory,
  IntegrationTier,
  OAuthConfig,
  OAuthTokens,
  WidgetData,
  WidgetDefinition,
} from '../types/index.js';
import { BaseConnector } from './base.connector.js';

export class PlaidCFOConnector extends BaseConnector {
  readonly id = 'plaid-cfo';
  readonly slug = 'plaid-cfo';
  readonly name = 'Plaid (CFO Banking)';
  readonly description =
    'Aggregate banking data across all connected accounts for cash management.';
  readonly logoUrl = '/integrations/plaid.svg';
  readonly category: IntegrationCategory = 'BANKING';
  readonly applicableRoles: ExecutiveType[] = ['FRACTIONAL_CFO'];
  readonly tier: IntegrationTier = 'professional';

  protected baseUrl: string;
  protected clientId: string;
  protected secret: string;

  constructor() {
    super();
    const env = process.env.PLAID_ENV || 'sandbox';
    this.baseUrl =
      env === 'production'
        ? 'https://production.plaid.com'
        : env === 'development'
          ? 'https://development.plaid.com'
          : 'https://sandbox.plaid.com';
    this.clientId = process.env.PLAID_CLIENT_ID || '';
    this.secret = process.env.PLAID_SECRET || '';
  }

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'all-accounts-summary',
      name: 'All Accounts Summary',
      description: 'Aggregated view of all connected bank accounts',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['accounts'],
    },
    {
      id: 'cash-flow-actual',
      name: 'Cash Flow (Actual)',
      description: 'Actual cash inflows and outflows from transactions',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['transactions'],
    },
    {
      id: 'transaction-categorization',
      name: 'Transaction Categorization',
      description: 'Transactions categorized by type',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['transactions'],
    },
    {
      id: 'balance-history',
      name: 'Balance History',
      description: 'Historical balance trends',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['accounts'],
    },
  ];

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: this.baseUrl + '/link/token/create',
      tokenUrl: this.baseUrl + '/item/public_token/exchange',
      revokeUrl: this.baseUrl + '/item/remove',
      clientId: this.clientId,
      clientSecret: this.secret,
      scopes: ['accounts', 'transactions', 'identity'],
      scopeDelimiter: ' ',
      pkceRequired: false,
    };
  }

  // Plaid uses Link for auth - this creates a link token
  async createLinkToken(userId: string, products: string[] = ['transactions']): Promise<string> {
    const response = await this.plaidRequest('/link/token/create', {
      client_id: this.clientId,
      secret: this.secret,
      user: { client_user_id: userId },
      client_name: 'Skillancer',
      products,
      country_codes: ['US', 'CA', 'GB'],
      language: 'en',
    });
    return response.link_token;
  }

  getAuthUrl(state: string): string {
    return ''; // Plaid uses Link SDK, not redirect OAuth
  }

  async exchangeCode(publicToken: string): Promise<OAuthTokens> {
    const response = await this.plaidRequest('/item/public_token/exchange', {
      client_id: this.clientId,
      secret: this.secret,
      public_token: publicToken,
    });

    return {
      accessToken: response.access_token,
      refreshToken: '',
      expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // Plaid tokens don't expire
      tokenType: 'Bearer',
      scopes: ['accounts', 'transactions'],
      metadata: { itemId: response.item_id },
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // Plaid access tokens don't expire
    throw new Error('Plaid tokens do not require refresh');
  }

  async revokeToken(accessToken: string): Promise<void> {
    await this.plaidRequest('/item/remove', {
      client_id: this.clientId,
      secret: this.secret,
      access_token: accessToken,
    });
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.getAccounts(tokens);
      return true;
    } catch {
      return false;
    }
  }

  async fetchData<T>(
    tokens: OAuthTokens,
    endpoint: string,
    options?: FetchOptions
  ): Promise<FetchResult<T>> {
    const response = await this.plaidRequest(endpoint, {
      client_id: this.clientId,
      secret: this.secret,
      access_token: tokens.accessToken,
      ...options,
    });
    return { data: response as T, metadata: {} };
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'all-accounts-summary':
        return this.getAllAccountsSummaryWidget(tokens);
      case 'cash-flow-actual':
        return this.getCashFlowActualWidget(tokens, params);
      case 'transaction-categorization':
        return this.getTransactionCategorizationWidget(tokens, params);
      case 'balance-history':
        return this.getBalanceHistoryWidget(tokens, params);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  // Core API Methods
  async getAccounts(tokens: OAuthTokens): Promise<PlaidAccount[]> {
    const result = await this.fetchData<PlaidAccountsResponse>(tokens, '/accounts/get');
    return result.data.accounts || [];
  }

  async getBalances(tokens: OAuthTokens): Promise<PlaidAccount[]> {
    const result = await this.fetchData<PlaidAccountsResponse>(tokens, '/accounts/balance/get');
    return result.data.accounts || [];
  }

  async getTransactions(
    tokens: OAuthTokens,
    startDate: string,
    endDate: string
  ): Promise<PlaidTransaction[]> {
    const result = await this.fetchData<PlaidTransactionsResponse>(tokens, '/transactions/get', {
      start_date: startDate,
      end_date: endDate,
    });
    return result.data.transactions || [];
  }

  async getInstitution(tokens: OAuthTokens): Promise<PlaidInstitution | null> {
    try {
      const result = await this.fetchData<{ item: { institution_id: string } }>(
        tokens,
        '/item/get'
      );
      if (result.data.item?.institution_id) {
        const instResult = await this.plaidRequest('/institutions/get_by_id', {
          institution_id: result.data.item.institution_id,
          country_codes: ['US'],
        });
        return instResult.institution;
      }
    } catch {
      return null;
    }
    return null;
  }

  // Widget Implementations
  private async getAllAccountsSummaryWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const accounts = await this.getBalances(tokens);

    const summary = {
      totalBalance: 0,
      checking: { count: 0, balance: 0 },
      savings: { count: 0, balance: 0 },
      credit: { count: 0, balance: 0 },
      other: { count: 0, balance: 0 },
    };

    for (const account of accounts) {
      const balance = account.balances?.current || 0;

      if (account.type === 'depository') {
        if (account.subtype === 'checking') {
          summary.checking.count++;
          summary.checking.balance += balance;
          summary.totalBalance += balance;
        } else {
          summary.savings.count++;
          summary.savings.balance += balance;
          summary.totalBalance += balance;
        }
      } else if (account.type === 'credit') {
        summary.credit.count++;
        summary.credit.balance += balance;
        summary.totalBalance -= balance; // Credit reduces total
      } else {
        summary.other.count++;
        summary.other.balance += balance;
        summary.totalBalance += balance;
      }
    }

    return {
      widgetId: 'all-accounts-summary',
      data: {
        totalAccounts: accounts.length,
        totalBalance: Math.round(summary.totalBalance * 100) / 100,
        checking: {
          count: summary.checking.count,
          balance: Math.round(summary.checking.balance * 100) / 100,
        },
        savings: {
          count: summary.savings.count,
          balance: Math.round(summary.savings.balance * 100) / 100,
        },
        credit: {
          count: summary.credit.count,
          balance: Math.round(summary.credit.balance * 100) / 100,
        },
        accounts: accounts.map((a) => ({
          id: a.account_id,
          name: a.name,
          officialName: a.official_name,
          type: a.type,
          subtype: a.subtype,
          balance: a.balances?.current,
          available: a.balances?.available,
          mask: a.mask,
        })),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getCashFlowActualWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const days = (params?.days as number) || 30;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const transactions = await this.getTransactions(tokens, startDate, endDate);

    let inflows = 0;
    let outflows = 0;
    const byCategory: Record<string, { inflow: number; outflow: number }> = {};

    for (const tx of transactions) {
      const amount = tx.amount || 0;
      const category = tx.category?.[0] || 'Other';

      if (!byCategory[category]) {
        byCategory[category] = { inflow: 0, outflow: 0 };
      }

      if (amount < 0) {
        // Negative = inflow in Plaid
        inflows += Math.abs(amount);
        byCategory[category].inflow += Math.abs(amount);
      } else {
        outflows += amount;
        byCategory[category].outflow += amount;
      }
    }

    return {
      widgetId: 'cash-flow-actual',
      data: {
        period: { startDate, endDate, days },
        inflows: Math.round(inflows * 100) / 100,
        outflows: Math.round(outflows * 100) / 100,
        netCashFlow: Math.round((inflows - outflows) * 100) / 100,
        transactionCount: transactions.length,
        byCategory: Object.entries(byCategory)
          .map(([category, data]) => ({
            category,
            inflow: Math.round(data.inflow * 100) / 100,
            outflow: Math.round(data.outflow * 100) / 100,
            net: Math.round((data.inflow - data.outflow) * 100) / 100,
          }))
          .sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getTransactionCategorizationWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const days = (params?.days as number) || 30;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const transactions = await this.getTransactions(tokens, startDate, endDate);

    const categories: Record<
      string,
      { count: number; total: number; transactions: PlaidTransaction[] }
    > = {};

    for (const tx of transactions) {
      const category = tx.category?.join(' > ') || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = { count: 0, total: 0, transactions: [] };
      }
      categories[category].count++;
      categories[category].total += Math.abs(tx.amount || 0);
      if (categories[category].transactions.length < 5) {
        categories[category].transactions.push(tx);
      }
    }

    const totalAmount = Object.values(categories).reduce((sum, c) => sum + c.total, 0);

    return {
      widgetId: 'transaction-categorization',
      data: {
        period: { startDate, endDate, days },
        categories: Object.entries(categories)
          .map(([name, data]) => ({
            name,
            count: data.count,
            total: Math.round(data.total * 100) / 100,
            percentage: totalAmount > 0 ? Math.round((data.total / totalAmount) * 1000) / 10 : 0,
            recentTransactions: data.transactions.map((tx) => ({
              name: tx.name,
              amount: tx.amount,
              date: tx.date,
            })),
          }))
          .sort((a, b) => b.total - a.total),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getBalanceHistoryWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const accounts = await this.getBalances(tokens);

    // Note: Plaid doesn't provide historical balances directly
    // This would require storing historical snapshots
    const currentBalances = accounts.map((a) => ({
      accountId: a.account_id,
      name: a.name,
      type: a.type,
      currentBalance: a.balances?.current,
      availableBalance: a.balances?.available,
      asOf: new Date().toISOString(),
    }));

    const totalCurrent = accounts.reduce((sum, a) => sum + (a.balances?.current || 0), 0);

    return {
      widgetId: 'balance-history',
      data: {
        totalCurrentBalance: Math.round(totalCurrent * 100) / 100,
        accounts: currentBalances,
        note: 'Historical balance tracking requires periodic snapshots',
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async plaidRequest(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<PlaidResponse> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Plaid API error: ${error.error_message || response.statusText}`);
    }

    return response.json();
  }

  getInfo(): ConnectorInfo {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      description: this.description,
      logoUrl: this.logoUrl,
      category: this.category,
      applicableRoles: this.applicableRoles,
      tier: this.tier,
      supportedWidgets: this.supportedWidgets,
      webhookEnabled: true,
      isBeta: false,
    };
  }
}

// Type Definitions
type PlaidResponse = Record<string, unknown>;

interface PlaidAccountsResponse {
  accounts: PlaidAccount[];
}

interface PlaidTransactionsResponse {
  transactions: PlaidTransaction[];
  total_transactions: number;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype: string;
  mask?: string;
  balances?: {
    current?: number;
    available?: number;
    limit?: number;
    iso_currency_code?: string;
  };
}

interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  name: string;
  amount: number;
  date: string;
  category?: string[];
  pending: boolean;
  merchant_name?: string;
}

interface PlaidInstitution {
  institution_id: string;
  name: string;
  logo?: string;
}

export const plaidCFOConnector = new PlaidCFOConnector();
