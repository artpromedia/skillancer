// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/connectors/xero
 * Xero Connector for CFO Tool Suite
 *
 * Provides integration with Xero accounting for:
 * - Financial statements (P&L, Balance Sheet)
 * - Accounts Receivable/Payable
 * - Bank reconciliation
 * - Real-time financial data
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

export class XeroConnector extends BaseConnector {
  readonly id = 'xero';
  readonly slug = 'xero';
  readonly name = 'Xero';
  readonly description =
    'Cloud accounting software. Connect for financial statements, invoicing, and bank feeds.';
  readonly logoUrl = '/integrations/xero.svg';
  readonly category: IntegrationCategory = 'ACCOUNTING';
  readonly applicableRoles: ExecutiveType[] = ['FRACTIONAL_CFO', 'FRACTIONAL_COO'];
  readonly tier: IntegrationTier = 'professional';

  protected baseUrl = 'https://api.xero.com/api.xro/2.0';

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'cash-position',
      name: 'Cash Position',
      description: 'Bank account balances and total cash',
      category: 'financial',
      refreshInterval: 900,
      requiredScopes: ['accounting.reports.read'],
    },
    {
      id: 'profit-loss-summary',
      name: 'P&L Summary',
      description: 'Revenue, expenses, and net income',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['accounting.reports.read'],
    },
    {
      id: 'accounts-receivable',
      name: 'Accounts Receivable',
      description: 'Outstanding invoices and aging',
      category: 'financial',
      refreshInterval: 1800,
      requiredScopes: ['accounting.transactions.read'],
    },
    {
      id: 'accounts-payable',
      name: 'Accounts Payable',
      description: 'Bills due and aging',
      category: 'financial',
      refreshInterval: 1800,
      requiredScopes: ['accounting.transactions.read'],
    },
    {
      id: 'bank-summary',
      name: 'Bank Summary',
      description: 'Connected bank accounts overview',
      category: 'financial',
      refreshInterval: 900,
      requiredScopes: ['accounting.settings.read'],
    },
  ];

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: 'https://login.xero.com/identity/connect/authorize',
      tokenUrl: 'https://identity.xero.com/connect/token',
      revokeUrl: 'https://identity.xero.com/connect/revocation',
      clientId: process.env.XERO_CLIENT_ID || '',
      clientSecret: process.env.XERO_CLIENT_SECRET || '',
      scopes: [
        'openid',
        'profile',
        'email',
        'accounting.transactions.read',
        'accounting.reports.read',
        'accounting.settings.read',
        'accounting.contacts.read',
      ],
      scopeDelimiter: ' ',
      pkceRequired: true,
    };
  }

  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const config = this.getOAuthConfig();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri || this.getRedirectUri(),
      scope: (scopes || config.scopes).join(' '),
      state,
    });
    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    };
    if (codeVerifier) body.code_verifier = codeVerifier;

    const response = await this.httpPost(config.tokenUrl, body, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return this.parseTokenResponse(response);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    const response = await this.httpPost(
      config.tokenUrl,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return this.parseTokenResponse(response);
  }

  async revokeToken(accessToken: string): Promise<void> {
    const config = this.getOAuthConfig();
    await this.httpPost(
      config.revokeUrl!,
      { token: accessToken },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.getOrganization(tokens);
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
    const tenantId = tokens.metadata?.tenantId as string;
    const url = `${this.baseUrl}${endpoint}`;

    const response = await this.httpGet(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Xero-Tenant-Id': tenantId,
        Accept: 'application/json',
      },
      ...options,
    });

    return { data: response as T, metadata: { tenantId } };
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'cash-position':
        return this.getCashPositionWidget(tokens);
      case 'profit-loss-summary':
        return this.getProfitLossSummaryWidget(tokens);
      case 'accounts-receivable':
        return this.getAccountsReceivableWidget(tokens);
      case 'accounts-payable':
        return this.getAccountsPayableWidget(tokens);
      case 'bank-summary':
        return this.getBankSummaryWidget(tokens);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  // Core API Methods
  async getOrganization(tokens: OAuthTokens): Promise<XeroOrganisation> {
    const result = await this.fetchData<{ Organisations: XeroOrganisation[] }>(
      tokens,
      '/Organisation'
    );
    return result.data.Organisations[0];
  }

  async getAccounts(tokens: OAuthTokens, type?: string): Promise<XeroAccount[]> {
    let endpoint = '/Accounts';
    if (type) endpoint += `?where=Type=="${type}"`;
    const result = await this.fetchData<{ Accounts: XeroAccount[] }>(tokens, endpoint);
    return result.data.Accounts || [];
  }

  async getBalanceSheet(tokens: OAuthTokens, date: string): Promise<XeroReport> {
    const result = await this.fetchData<{ Reports: XeroReport[] }>(
      tokens,
      `/Reports/BalanceSheet?date=${date}`
    );
    return result.data.Reports[0];
  }

  async getProfitAndLoss(
    tokens: OAuthTokens,
    fromDate: string,
    toDate: string
  ): Promise<XeroReport> {
    const result = await this.fetchData<{ Reports: XeroReport[] }>(
      tokens,
      `/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}`
    );
    return result.data.Reports[0];
  }

  async getInvoices(tokens: OAuthTokens, status?: string): Promise<XeroInvoice[]> {
    let endpoint = '/Invoices?where=Type=="ACCREC"';
    if (status) endpoint += `%20AND%20Status=="${status}"`;
    const result = await this.fetchData<{ Invoices: XeroInvoice[] }>(tokens, endpoint);
    return result.data.Invoices || [];
  }

  async getBills(tokens: OAuthTokens, status?: string): Promise<XeroInvoice[]> {
    let endpoint = '/Invoices?where=Type=="ACCPAY"';
    if (status) endpoint += `%20AND%20Status=="${status}"`;
    const result = await this.fetchData<{ Invoices: XeroInvoice[] }>(tokens, endpoint);
    return result.data.Invoices || [];
  }

  async getBankAccounts(tokens: OAuthTokens): Promise<XeroAccount[]> {
    return this.getAccounts(tokens, 'BANK');
  }

  // Widget Implementations
  private async getCashPositionWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const bankAccounts = await this.getBankAccounts(tokens);
    const totalCash = bankAccounts.reduce((sum, a) => sum + (a.BankAccountBalance || 0), 0);

    return {
      widgetId: 'cash-position',
      data: {
        totalCash,
        currency: bankAccounts[0]?.CurrencyCode || 'USD',
        accounts: bankAccounts.map((a) => ({
          id: a.AccountID,
          name: a.Name,
          balance: a.BankAccountBalance || 0,
          type: a.BankAccountType,
        })),
        lastUpdated: new Date().toISOString(),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  private async getProfitLossSummaryWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [plMTD, plYTD] = await Promise.all([
      this.getProfitAndLoss(tokens, this.formatDate(startOfMonth), this.formatDate(now)),
      this.getProfitAndLoss(tokens, this.formatDate(startOfYear), this.formatDate(now)),
    ]);

    return {
      widgetId: 'profit-loss-summary',
      data: {
        mtd: this.extractPLSummary(plMTD),
        ytd: this.extractPLSummary(plYTD),
        period: { start: this.formatDate(startOfMonth), end: this.formatDate(now) },
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getAccountsReceivableWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const invoices = await this.getInvoices(tokens, 'AUTHORISED');
    const now = new Date();

    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    let totalOutstanding = 0;
    let overdueAmount = 0;

    for (const inv of invoices) {
      const balance = inv.AmountDue || 0;
      totalOutstanding += balance;
      const dueDate = new Date(inv.DueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);

      if (daysOverdue <= 0) aging.current += balance;
      else if (daysOverdue <= 30) {
        aging.days1to30 += balance;
        overdueAmount += balance;
      } else if (daysOverdue <= 60) {
        aging.days31to60 += balance;
        overdueAmount += balance;
      } else if (daysOverdue <= 90) {
        aging.days61to90 += balance;
        overdueAmount += balance;
      } else {
        aging.over90 += balance;
        overdueAmount += balance;
      }
    }

    return {
      widgetId: 'accounts-receivable',
      data: { totalOutstanding, overdueAmount, invoiceCount: invoices.length, aging },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  private async getAccountsPayableWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const bills = await this.getBills(tokens, 'AUTHORISED');
    const now = new Date();

    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    let totalOutstanding = 0;

    for (const bill of bills) {
      const balance = bill.AmountDue || 0;
      totalOutstanding += balance;
      const dueDate = new Date(bill.DueDate);
      const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / 86400000);

      if (daysUntilDue >= 0) aging.current += balance;
      else if (daysUntilDue >= -30) aging.days1to30 += balance;
      else if (daysUntilDue >= -60) aging.days31to60 += balance;
      else if (daysUntilDue >= -90) aging.days61to90 += balance;
      else aging.over90 += balance;
    }

    return {
      widgetId: 'accounts-payable',
      data: { totalOutstanding, billCount: bills.length, aging },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  private async getBankSummaryWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const bankAccounts = await this.getBankAccounts(tokens);
    return {
      widgetId: 'bank-summary',
      data: {
        accountCount: bankAccounts.length,
        accounts: bankAccounts.map((a) => ({
          id: a.AccountID,
          name: a.Name,
          balance: a.BankAccountBalance || 0,
          type: a.BankAccountType,
          currency: a.CurrencyCode,
        })),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  // Helpers
  private getRedirectUri(): string {
    return process.env.XERO_REDIRECT_URI || 'https://app.skillancer.io/integrations/xero/callback';
  }

  private parseTokenResponse(response: Record<string, unknown>): OAuthTokens {
    const expiresIn = (response.expires_in as number) || 1800;
    return {
      accessToken: response.access_token as string,
      refreshToken: response.refresh_token as string,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      tokenType: 'Bearer',
      scopes: ((response.scope as string) || '').split(' '),
      metadata: {},
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private extractPLSummary(report: XeroReport): {
    revenue: number;
    expenses: number;
    netIncome: number;
  } {
    let revenue = 0,
      expenses = 0,
      netIncome = 0;
    const rows = report.Rows || [];

    for (const row of rows) {
      if (row.RowType === 'Section') {
        const title = row.Title?.toLowerCase() || '';
        if (title.includes('income') || title.includes('revenue')) {
          revenue = this.extractSectionTotal(row);
        } else if (title.includes('expense')) {
          expenses = this.extractSectionTotal(row);
        }
      } else if (row.RowType === 'SummaryRow') {
        const cells = row.Cells || [];
        if (cells[0]?.Value?.toLowerCase().includes('net')) {
          netIncome = parseFloat(cells[1]?.Value || '0');
        }
      }
    }

    return { revenue, expenses, netIncome };
  }

  private extractSectionTotal(section: XeroReportRow): number {
    const summaryRow = section.Rows?.find((r) => r.RowType === 'SummaryRow');
    if (summaryRow?.Cells?.[1]?.Value) {
      return parseFloat(summaryRow.Cells[1].Value);
    }
    return 0;
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
      webhookEnabled: false,
      isBeta: false,
    };
  }
}

// Type Definitions
interface XeroOrganisation {
  OrganisationID: string;
  Name: string;
  LegalName?: string;
  ShortCode?: string;
}

interface XeroAccount {
  AccountID: string;
  Code?: string;
  Name: string;
  Type: string;
  BankAccountType?: string;
  BankAccountBalance?: number;
  CurrencyCode?: string;
}

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber?: string;
  Type: string;
  Status: string;
  Date: string;
  DueDate: string;
  Total?: number;
  AmountDue?: number;
  Contact?: { Name: string };
}

interface XeroReport {
  ReportID?: string;
  ReportName?: string;
  Rows?: XeroReportRow[];
}

interface XeroReportRow {
  RowType: string;
  Title?: string;
  Cells?: { Value?: string }[];
  Rows?: XeroReportRow[];
}

export const xeroConnector = new XeroConnector();
