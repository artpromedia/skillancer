// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/connectors/quickbooks
 * QuickBooks Online Connector for CFO Tool Suite
 *
 * Provides deep integration with QuickBooks for:
 * - Financial statements (P&L, Balance Sheet, Cash Flow)
 * - Accounts Receivable/Payable
 * - Budget vs Actual tracking
 * - Real-time cash position
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

// ============================================================================
// QUICKBOOKS CONNECTOR
// ============================================================================

export class QuickBooksConnector extends BaseConnector {
  readonly id = 'quickbooks';
  readonly slug = 'quickbooks';
  readonly name = 'QuickBooks Online';
  readonly description =
    'Accounting software for small businesses. Connect for financial statements, AR/AP, and cash position.';
  readonly logoUrl = '/integrations/quickbooks.svg';
  readonly category: IntegrationCategory = 'ACCOUNTING';
  readonly applicableRoles: ExecutiveType[] = ['FRACTIONAL_CFO', 'FRACTIONAL_COO'];
  readonly tier: IntegrationTier = 'professional';

  protected baseUrl = 'https://quickbooks.api.intuit.com/v3';
  private sandboxUrl = 'https://sandbox-quickbooks.api.intuit.com/v3';

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'cash-position',
      name: 'Cash Position',
      description: 'Bank account balances and total cash',
      category: 'financial',
      refreshInterval: 900, // 15 minutes
      requiredScopes: ['com.intuit.quickbooks.accounting'],
    },
    {
      id: 'profit-loss-summary',
      name: 'P&L Summary',
      description: 'Revenue, expenses, and net income',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['com.intuit.quickbooks.accounting'],
    },
    {
      id: 'accounts-receivable',
      name: 'Accounts Receivable',
      description: 'Outstanding invoices and aging',
      category: 'financial',
      refreshInterval: 1800,
      requiredScopes: ['com.intuit.quickbooks.accounting'],
    },
    {
      id: 'accounts-payable',
      name: 'Accounts Payable',
      description: 'Bills due and aging',
      category: 'financial',
      refreshInterval: 1800,
      requiredScopes: ['com.intuit.quickbooks.accounting'],
    },
    {
      id: 'budget-vs-actual',
      name: 'Budget vs Actual',
      description: 'Budget tracking and variance',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['com.intuit.quickbooks.accounting'],
    },
    {
      id: 'revenue-by-customer',
      name: 'Revenue by Customer',
      description: 'Top customers and concentration',
      category: 'financial',
      refreshInterval: 3600,
      requiredScopes: ['com.intuit.quickbooks.accounting'],
    },
  ];

  // ============================================================================
  // OAUTH CONFIGURATION
  // ============================================================================

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
      tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      scopes: ['com.intuit.quickbooks.accounting', 'openid', 'profile', 'email'],
      scopeDelimiter: ' ',
      pkceRequired: false,
    };
  }

  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const config = this.getOAuthConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      scope: (scopes || config.scopes).join(' '),
      redirect_uri: redirectUri || this.getRedirectUri(),
      response_type: 'code',
      state,
    });
    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    const response = await this.httpPost(
      config.tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
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
      {
        token: accessToken,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  }

  // ============================================================================
  // DATA OPERATIONS
  // ============================================================================

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.getCompanyInfo(tokens);
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
    const realmId = tokens.metadata?.realmId as string;
    const url = `${this.getApiUrl(tokens)}company/${realmId}${endpoint}`;

    const response = await this.httpGet(url, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
      },
      ...options,
    });

    return {
      data: response as T,
      metadata: { realmId },
    };
  }

  // ============================================================================
  // WIDGET DATA
  // ============================================================================

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'cash-position':
        return this.getCashPositionWidget(tokens);
      case 'profit-loss-summary':
        return this.getProfitLossSummaryWidget(tokens, params);
      case 'accounts-receivable':
        return this.getAccountsReceivableWidget(tokens);
      case 'accounts-payable':
        return this.getAccountsPayableWidget(tokens);
      case 'budget-vs-actual':
        return this.getBudgetVsActualWidget(tokens, params);
      case 'revenue-by-customer':
        return this.getRevenueByCustomerWidget(tokens, params);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  // ============================================================================
  // CORE API METHODS
  // ============================================================================

  async getCompanyInfo(tokens: OAuthTokens): Promise<QBCompanyInfo> {
    const result = await this.fetchData<{ CompanyInfo: QBCompanyInfo }>(
      tokens,
      '/companyinfo/' + tokens.metadata?.realmId
    );
    return result.data.CompanyInfo;
  }

  async getAccounts(tokens: OAuthTokens, type?: string): Promise<QBAccount[]> {
    let query = 'SELECT * FROM Account WHERE Active = true';
    if (type) {
      query += ` AND AccountType = '${type}'`;
    }
    const result = await this.fetchData<QBQueryResponse<QBAccount>>(
      tokens,
      `/query?query=${encodeURIComponent(query)}`
    );
    return result.data.QueryResponse?.Account || [];
  }

  async getBalanceSheet(tokens: OAuthTokens, asOfDate: string): Promise<QBReport> {
    const result = await this.fetchData<QBReport>(
      tokens,
      `/reports/BalanceSheet?date_macro=custom&start_date=${asOfDate}&end_date=${asOfDate}`
    );
    return result.data;
  }

  async getProfitAndLoss(
    tokens: OAuthTokens,
    startDate: string,
    endDate: string
  ): Promise<QBReport> {
    const result = await this.fetchData<QBReport>(
      tokens,
      `/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`
    );
    return result.data;
  }

  async getInvoices(
    tokens: OAuthTokens,
    status?: 'Open' | 'Paid' | 'Overdue'
  ): Promise<QBInvoice[]> {
    let query = 'SELECT * FROM Invoice';
    if (status === 'Open') {
      query += " WHERE Balance > '0'";
    }
    const result = await this.fetchData<QBQueryResponse<QBInvoice>>(
      tokens,
      `/query?query=${encodeURIComponent(query)}`
    );
    return result.data.QueryResponse?.Invoice || [];
  }

  async getBills(tokens: OAuthTokens, status?: 'Open' | 'Paid'): Promise<QBBill[]> {
    let query = 'SELECT * FROM Bill';
    if (status === 'Open') {
      query += " WHERE Balance > '0'";
    }
    const result = await this.fetchData<QBQueryResponse<QBBill>>(
      tokens,
      `/query?query=${encodeURIComponent(query)}`
    );
    return result.data.QueryResponse?.Bill || [];
  }

  async getCashFlow(tokens: OAuthTokens, startDate: string, endDate: string): Promise<QBReport> {
    const result = await this.fetchData<QBReport>(
      tokens,
      `/reports/CashFlow?start_date=${startDate}&end_date=${endDate}`
    );
    return result.data;
  }

  async getCustomers(tokens: OAuthTokens): Promise<QBCustomer[]> {
    const result = await this.fetchData<QBQueryResponse<QBCustomer>>(
      tokens,
      `/query?query=${encodeURIComponent('SELECT * FROM Customer WHERE Active = true')}`
    );
    return result.data.QueryResponse?.Customer || [];
  }

  async getVendors(tokens: OAuthTokens): Promise<QBVendor[]> {
    const result = await this.fetchData<QBQueryResponse<QBVendor>>(
      tokens,
      `/query?query=${encodeURIComponent('SELECT * FROM Vendor WHERE Active = true')}`
    );
    return result.data.QueryResponse?.Vendor || [];
  }

  // ============================================================================
  // WIDGET IMPLEMENTATIONS
  // ============================================================================

  private async getCashPositionWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const accounts = await this.getAccounts(tokens, 'Bank');
    const cashAccounts = accounts.filter(
      (a) =>
        a.AccountSubType === 'CashOnHand' ||
        a.AccountSubType === 'Checking' ||
        a.AccountSubType === 'Savings'
    );

    const totalCash = cashAccounts.reduce((sum, a) => sum + parseFloat(a.CurrentBalance || '0'), 0);
    const operatingAccounts = cashAccounts.filter((a) => a.AccountSubType === 'Checking');
    const savingsAccounts = cashAccounts.filter((a) => a.AccountSubType === 'Savings');

    return {
      widgetId: 'cash-position',
      data: {
        totalCash,
        currency: 'USD',
        operatingBalance: operatingAccounts.reduce(
          (sum, a) => sum + parseFloat(a.CurrentBalance || '0'),
          0
        ),
        savingsBalance: savingsAccounts.reduce(
          (sum, a) => sum + parseFloat(a.CurrentBalance || '0'),
          0
        ),
        accounts: cashAccounts.map((a) => ({
          id: a.Id,
          name: a.Name,
          balance: parseFloat(a.CurrentBalance || '0'),
          type: a.AccountSubType,
        })),
        lastUpdated: new Date().toISOString(),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  private async getProfitLossSummaryWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [plMTD, plYTD] = await Promise.all([
      this.getProfitAndLoss(tokens, this.formatDate(startOfMonth), this.formatDate(now)),
      this.getProfitAndLoss(tokens, this.formatDate(startOfYear), this.formatDate(now)),
    ]);

    const mtdData = this.extractPLSummary(plMTD);
    const ytdData = this.extractPLSummary(plYTD);

    return {
      widgetId: 'profit-loss-summary',
      data: {
        mtd: mtdData,
        ytd: ytdData,
        period: { start: this.formatDate(startOfMonth), end: this.formatDate(now) },
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getAccountsReceivableWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const invoices = await this.getInvoices(tokens, 'Open');
    const now = new Date();

    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    let totalOutstanding = 0;
    let overdueAmount = 0;

    for (const inv of invoices) {
      const balance = parseFloat(inv.Balance || '0');
      totalOutstanding += balance;
      const dueDate = new Date(inv.DueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

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
      data: {
        totalOutstanding,
        overdueAmount,
        invoiceCount: invoices.length,
        aging,
        topInvoices: invoices.slice(0, 5).map((i) => ({
          id: i.Id,
          customerName: i.CustomerRef?.name,
          amount: parseFloat(i.TotalAmt || '0'),
          balance: parseFloat(i.Balance || '0'),
          dueDate: i.DueDate,
        })),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  private async getAccountsPayableWidget(tokens: OAuthTokens): Promise<WidgetData> {
    const bills = await this.getBills(tokens, 'Open');
    const now = new Date();

    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    let totalOutstanding = 0;

    for (const bill of bills) {
      const balance = parseFloat(bill.Balance || '0');
      totalOutstanding += balance;
      const dueDate = new Date(bill.DueDate);
      const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue >= 0) aging.current += balance;
      else if (daysUntilDue >= -30) aging.days1to30 += balance;
      else if (daysUntilDue >= -60) aging.days31to60 += balance;
      else if (daysUntilDue >= -90) aging.days61to90 += balance;
      else aging.over90 += balance;
    }

    return {
      widgetId: 'accounts-payable',
      data: {
        totalOutstanding,
        billCount: bills.length,
        aging,
        dueNext30Days: bills
          .filter((b) => {
            const daysUntilDue = Math.floor(
              (new Date(b.DueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysUntilDue >= 0 && daysUntilDue <= 30;
          })
          .reduce((sum, b) => sum + parseFloat(b.Balance || '0'), 0),
        topBills: bills.slice(0, 5).map((b) => ({
          id: b.Id,
          vendorName: b.VendorRef?.name,
          amount: parseFloat(b.TotalAmt || '0'),
          balance: parseFloat(b.Balance || '0'),
          dueDate: b.DueDate,
        })),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  private async getBudgetVsActualWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    // QuickBooks budget comparison requires fetching budget and P&L
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pl = await this.getProfitAndLoss(
      tokens,
      this.formatDate(startOfYear),
      this.formatDate(now)
    );

    // Note: QuickBooks budget access requires specific report query
    return {
      widgetId: 'budget-vs-actual',
      data: {
        period: { start: this.formatDate(startOfYear), end: this.formatDate(now) },
        categories: [], // Would be populated from budget vs actual report
        totalBudget: 0,
        totalActual: 0,
        variance: 0,
        variancePercent: 0,
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  private async getRevenueByCustomerWidget(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Fetch customer sales summary report
    const result = await this.fetchData<QBReport>(
      tokens,
      `/reports/CustomerSales?start_date=${this.formatDate(startOfYear)}&end_date=${this.formatDate(now)}`
    );

    const customers = this.extractCustomerRevenue(result.data);
    const totalRevenue = customers.reduce((sum, c) => sum + c.revenue, 0);

    return {
      widgetId: 'revenue-by-customer',
      data: {
        totalRevenue,
        customerCount: customers.length,
        topCustomers: customers.slice(0, 10).map((c) => ({
          ...c,
          percentage: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0,
        })),
        concentration: this.calculateConcentration(customers),
      },
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  async generateBalanceSheet(tokens: OAuthTokens, asOfDate: string): Promise<FinancialReport> {
    const report = await this.getBalanceSheet(tokens, asOfDate);
    return {
      type: 'balance-sheet',
      title: 'Balance Sheet',
      asOfDate,
      sections: this.parseReportSections(report),
      generatedAt: new Date().toISOString(),
    };
  }

  async generateProfitLoss(
    tokens: OAuthTokens,
    startDate: string,
    endDate: string
  ): Promise<FinancialReport> {
    const report = await this.getProfitAndLoss(tokens, startDate, endDate);
    return {
      type: 'profit-loss',
      title: 'Profit & Loss Statement',
      period: { start: startDate, end: endDate },
      sections: this.parseReportSections(report),
      generatedAt: new Date().toISOString(),
    };
  }

  async generateCashFlowStatement(
    tokens: OAuthTokens,
    startDate: string,
    endDate: string
  ): Promise<FinancialReport> {
    const report = await this.getCashFlow(tokens, startDate, endDate);
    return {
      type: 'cash-flow',
      title: 'Statement of Cash Flows',
      period: { start: startDate, end: endDate },
      sections: this.parseReportSections(report),
      generatedAt: new Date().toISOString(),
    };
  }

  async generateARAgingReport(tokens: OAuthTokens): Promise<AgingReport> {
    const invoices = await this.getInvoices(tokens, 'Open');
    const widgetData = await this.getAccountsReceivableWidget(tokens);
    return {
      type: 'ar-aging',
      title: 'Accounts Receivable Aging',
      asOfDate: new Date().toISOString(),
      summary: widgetData.data as Record<string, unknown>,
      details: invoices.map((i) => ({
        id: i.Id,
        customerName: i.CustomerRef?.name,
        invoiceNumber: i.DocNumber,
        invoiceDate: i.TxnDate,
        dueDate: i.DueDate,
        amount: parseFloat(i.TotalAmt || '0'),
        balance: parseFloat(i.Balance || '0'),
      })),
    };
  }

  async generateAPAgingReport(tokens: OAuthTokens): Promise<AgingReport> {
    const bills = await this.getBills(tokens, 'Open');
    const widgetData = await this.getAccountsPayableWidget(tokens);
    return {
      type: 'ap-aging',
      title: 'Accounts Payable Aging',
      asOfDate: new Date().toISOString(),
      summary: widgetData.data as Record<string, unknown>,
      details: bills.map((b) => ({
        id: b.Id,
        vendorName: b.VendorRef?.name,
        billNumber: b.DocNumber,
        billDate: b.TxnDate,
        dueDate: b.DueDate,
        amount: parseFloat(b.TotalAmt || '0'),
        balance: parseFloat(b.Balance || '0'),
      })),
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getApiUrl(tokens: OAuthTokens): string {
    const isSandbox = tokens.metadata?.sandbox === true;
    return isSandbox ? this.sandboxUrl : this.baseUrl;
  }

  private getRedirectUri(): string {
    return (
      process.env.QUICKBOOKS_REDIRECT_URI ||
      'https://app.skillancer.io/integrations/quickbooks/callback'
    );
  }

  private parseTokenResponse(response: Record<string, unknown>): OAuthTokens {
    const expiresIn = (response.expires_in as number) || 3600;
    return {
      accessToken: response.access_token as string,
      refreshToken: response.refresh_token as string,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      tokenType: (response.token_type as string) || 'Bearer',
      scopes: ((response.scope as string) || '').split(' '),
      metadata: {
        realmId: response.realmId as string,
      },
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private extractPLSummary(report: QBReport): PLSummary {
    // Parse QuickBooks P&L report structure
    const rows = report.Rows?.Row || [];
    let revenue = 0,
      expenses = 0,
      netIncome = 0;

    for (const row of rows) {
      if (row.group === 'Income') {
        revenue = this.extractRowTotal(row);
      } else if (row.group === 'Expenses') {
        expenses = this.extractRowTotal(row);
      } else if (row.type === 'Section' && row.Header?.ColData?.[0]?.value?.includes('Net')) {
        netIncome = this.extractRowTotal(row);
      }
    }

    return { revenue, expenses, netIncome };
  }

  private extractRowTotal(row: QBReportRow): number {
    if (row.Summary?.ColData) {
      const valueCol = row.Summary.ColData.find((c) => c.value && !isNaN(parseFloat(c.value)));
      if (valueCol) return parseFloat(valueCol.value);
    }
    return 0;
  }

  private extractCustomerRevenue(report: QBReport): CustomerRevenue[] {
    const rows = report.Rows?.Row || [];
    const customers: CustomerRevenue[] = [];

    for (const row of rows) {
      if (row.type === 'Data' && row.ColData) {
        const name = row.ColData[0]?.value;
        const revenue = parseFloat(row.ColData[1]?.value || '0');
        if (name && revenue > 0) {
          customers.push({ name, revenue });
        }
      }
    }

    return customers.sort((a, b) => b.revenue - a.revenue);
  }

  private calculateConcentration(customers: CustomerRevenue[]): {
    top1: number;
    top5: number;
    top10: number;
  } {
    const totalRevenue = customers.reduce((sum, c) => sum + c.revenue, 0);
    if (totalRevenue === 0) return { top1: 0, top5: 0, top10: 0 };

    const top1 =
      (customers.slice(0, 1).reduce((sum, c) => sum + c.revenue, 0) / totalRevenue) * 100;
    const top5 =
      (customers.slice(0, 5).reduce((sum, c) => sum + c.revenue, 0) / totalRevenue) * 100;
    const top10 =
      (customers.slice(0, 10).reduce((sum, c) => sum + c.revenue, 0) / totalRevenue) * 100;

    return { top1, top5, top10 };
  }

  private parseReportSections(report: QBReport): ReportSection[] {
    // Parse QuickBooks report into structured sections
    return (report.Rows?.Row || []).map((row) => ({
      title: row.Header?.ColData?.[0]?.value || row.group || 'Section',
      rows: this.parseReportRows(row),
    }));
  }

  private parseReportRows(row: QBReportRow): ReportRow[] {
    const rows: ReportRow[] = [];
    if (row.Rows?.Row) {
      for (const subRow of row.Rows.Row) {
        if (subRow.ColData) {
          rows.push({
            label: subRow.ColData[0]?.value || '',
            value: parseFloat(subRow.ColData[1]?.value || '0'),
          });
        }
      }
    }
    return rows;
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QBCompanyInfo {
  CompanyName: string;
  LegalName?: string;
  Country?: string;
  FiscalYearStartMonth?: string;
}

interface QBAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  CurrentBalance?: string;
  Active?: boolean;
}

interface QBInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  DueDate: string;
  TotalAmt?: string;
  Balance?: string;
  CustomerRef?: { value: string; name?: string };
}

interface QBBill {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  DueDate: string;
  TotalAmt?: string;
  Balance?: string;
  VendorRef?: { value: string; name?: string };
}

interface QBCustomer {
  Id: string;
  DisplayName: string;
  Balance?: string;
}

interface QBVendor {
  Id: string;
  DisplayName: string;
  Balance?: string;
}

interface QBQueryResponse<T> {
  QueryResponse?: { [key: string]: T[] };
}

interface QBReport {
  Header?: { ReportName?: string };
  Rows?: { Row?: QBReportRow[] };
}

interface QBReportRow {
  type?: string;
  group?: string;
  Header?: { ColData?: { value: string }[] };
  Summary?: { ColData?: { value: string }[] };
  ColData?: { value: string }[];
  Rows?: { Row?: QBReportRow[] };
}

interface PLSummary {
  revenue: number;
  expenses: number;
  netIncome: number;
}

interface CustomerRevenue {
  name: string;
  revenue: number;
}

interface FinancialReport {
  type: string;
  title: string;
  asOfDate?: string;
  period?: { start: string; end: string };
  sections: ReportSection[];
  generatedAt: string;
}

interface ReportSection {
  title: string;
  rows: ReportRow[];
}

interface ReportRow {
  label: string;
  value: number;
}

interface AgingReport {
  type: string;
  title: string;
  asOfDate: string;
  summary: Record<string, unknown>;
  details: Record<string, unknown>[];
}

export const quickBooksConnector = new QuickBooksConnector();

