// @ts-nocheck
/**
 * Tax Prep Software Integration
 * TurboTax, H&R Block, and generic export
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'tax-prep-integration' });

// ============================================================================
// TYPES
// ============================================================================

export type TaxPrepProvider = 'turbotax' | 'hrblock' | 'taxact' | 'generic';

export interface TaxPrepConnection {
  id: string;
  userId: string;
  provider: TaxPrepProvider;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  lastSyncAt?: Date;
  status: 'connected' | 'expired' | 'error';
  createdAt: Date;
}

export interface TaxExportData {
  taxYear: number;
  income: IncomeData;
  expenses: ExpenseData;
  estimatedPayments: EstimatedPaymentData[];
  documents: DocumentReference[];
  summary: TaxSummary;
}

export interface IncomeData {
  grossFreelanceIncome: number;
  returns: number;
  netIncome: number;
  byClient: { clientName: string; amount: number }[];
  byMonth: number[];
}

export interface ExpenseData {
  total: number;
  byCategory: { category: string; amount: number; deductible: boolean }[];
  mileage: { miles: number; rate: number; deduction: number };
  homeOffice: { squareFeet: number; deduction: number };
}

export interface EstimatedPaymentData {
  quarter: number;
  amount: number;
  paidAt: Date;
  confirmationNumber?: string;
}

export interface DocumentReference {
  type: string;
  name: string;
  url: string;
}

export interface TaxSummary {
  grossIncome: number;
  totalDeductions: number;
  netIncome: number;
  estimatedTax: number;
  estimatedPaymentsMade: number;
  balance: number;
}

// ============================================================================
// TURBOTAX INTEGRATION
// ============================================================================

const TURBOTAX_CONFIG = {
  clientId: process.env.TURBOTAX_CLIENT_ID || '',
  clientSecret: process.env.TURBOTAX_CLIENT_SECRET || '',
  redirectUri: process.env.TURBOTAX_REDIRECT_URI || '',
  authUrl: 'https://oauth.platform.intuit.com/oauth2/v1/authorize',
  tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  apiBaseUrl: 'https://tax.api.intuit.com',
};

// ============================================================================
// TAX PREP INTEGRATION SERVICE
// ============================================================================

class TaxPrepIntegrationService {
  // --------------------------------------------------------------------------
  // OAUTH FLOW
  // --------------------------------------------------------------------------

  getAuthorizationUrl(userId: string, provider: TaxPrepProvider): string {
    if (provider !== 'turbotax') {
      throw new Error(`Provider ${provider} not yet supported`);
    }

    const state = Buffer.from(JSON.stringify({ userId, provider })).toString('base64');

    const params = new URLSearchParams({
      client_id: TURBOTAX_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: TURBOTAX_CONFIG.redirectUri,
      scope: 'com.intuit.tax.self-employed.income com.intuit.tax.self-employed.expenses',
      state,
    });

    return `${TURBOTAX_CONFIG.authUrl}?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, state: string): Promise<TaxPrepConnection> {
    const { userId, provider } = JSON.parse(Buffer.from(state, 'base64').toString());

    logger.info('Handling OAuth callback', { userId, provider });

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, provider);

    const connection: TaxPrepConnection = {
      id: `CONN-${Date.now()}`,
      userId,
      provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      status: 'connected',
      createdAt: new Date(),
    };

    await this.saveConnection(connection);

    metrics.increment('tax.integration.connected', { provider });

    return connection;
  }

  private async exchangeCodeForTokens(
    code: string,
    provider: TaxPrepProvider
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    // In production, make actual OAuth token exchange
    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
    };
  }

  async refreshTokens(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection || !connection.refreshToken) {
      throw new Error('Connection not found or missing refresh token');
    }

    // In production, refresh tokens
    logger.info('Refreshing tokens', { connectionId });
  }

  async disconnect(userId: string, provider: TaxPrepProvider): Promise<void> {
    logger.info('Disconnecting tax prep integration', { userId, provider });

    await this.deleteConnection(userId, provider);

    metrics.increment('tax.integration.disconnected', { provider });
  }

  // --------------------------------------------------------------------------
  // DATA EXPORT
  // --------------------------------------------------------------------------

  async exportToTurboTax(
    userId: string,
    taxYear: number
  ): Promise<{
    success: boolean;
    exportId?: string;
    error?: string;
  }> {
    logger.info('Exporting to TurboTax', { userId, taxYear });

    const connection = await this.getUserConnection(userId, 'turbotax');
    if (!connection || connection.status !== 'connected') {
      return { success: false, error: 'TurboTax not connected' };
    }

    try {
      const exportData = await this.prepareExportData(userId, taxYear);

      // In production, use TurboTax API to push data
      const exportId = `EXP-${Date.now()}`;

      await this.updateLastSync(connection.id);

      metrics.increment('tax.export.turbotax');

      return { success: true, exportId };
    } catch (error) {
      logger.error('TurboTax export failed', { userId, error });
      return { success: false, error: 'Export failed' };
    }
  }

  async prepareExportData(userId: string, taxYear: number): Promise<TaxExportData> {
    logger.info('Preparing export data', { userId, taxYear });

    // Aggregate data from various sources
    const income = await this.getIncomeData(userId, taxYear);
    const expenses = await this.getExpenseData(userId, taxYear);
    const estimatedPayments = await this.getEstimatedPayments(userId, taxYear);
    const documents = await this.getDocumentReferences(userId, taxYear);

    const summary: TaxSummary = {
      grossIncome: income.grossFreelanceIncome,
      totalDeductions: expenses.total,
      netIncome: income.netIncome,
      estimatedTax: Math.round(income.netIncome * 0.3), // Rough estimate
      estimatedPaymentsMade: estimatedPayments.reduce((sum, p) => sum + p.amount, 0),
      balance: 0,
    };
    summary.balance = summary.estimatedTax - summary.estimatedPaymentsMade;

    return {
      taxYear,
      income,
      expenses,
      estimatedPayments,
      documents,
      summary,
    };
  }

  // --------------------------------------------------------------------------
  // GENERIC EXPORTS
  // --------------------------------------------------------------------------

  async exportToCsv(userId: string, taxYear: number): Promise<string> {
    logger.info('Exporting to CSV', { userId, taxYear });

    const data = await this.prepareExportData(userId, taxYear);

    const lines: string[] = [
      `Skillancer Tax Export - ${taxYear}`,
      '',
      'INCOME SUMMARY',
      `Gross Freelance Income,$${data.income.grossFreelanceIncome}`,
      `Returns/Refunds,-$${data.income.returns}`,
      `Net Income,$${data.income.netIncome}`,
      '',
      'INCOME BY CLIENT',
      ...data.income.byClient.map((c) => `${c.clientName},$${c.amount}`),
      '',
      'EXPENSES BY CATEGORY',
      ...data.expenses.byCategory.map(
        (e) => `${e.category},$${e.amount},${e.deductible ? 'Deductible' : 'Non-deductible'}`
      ),
      '',
      'MILEAGE',
      `Total Miles,${data.expenses.mileage.miles}`,
      `IRS Rate,$${data.expenses.mileage.rate}`,
      `Deduction,$${data.expenses.mileage.deduction}`,
      '',
      'ESTIMATED TAX PAYMENTS',
      ...data.estimatedPayments.map(
        (p) => `Q${p.quarter},$${p.amount},${p.paidAt.toISOString().split('T')[0]}`
      ),
      '',
      'SUMMARY',
      `Total Deductions,$${data.summary.totalDeductions}`,
      `Estimated Tax Liability,$${data.summary.estimatedTax}`,
      `Estimated Payments Made,$${data.summary.estimatedPaymentsMade}`,
      `Balance ${data.summary.balance >= 0 ? 'Due' : 'Refund'},$${Math.abs(data.summary.balance)}`,
    ];

    metrics.increment('tax.export.csv');

    return lines.join('\n');
  }

  async generateTaxSummaryPdf(userId: string, taxYear: number): Promise<string> {
    logger.info('Generating tax summary PDF', { userId, taxYear });

    const data = await this.prepareExportData(userId, taxYear);

    // In production, generate PDF using template
    const pdfUrl = `https://storage.skillancer.com/tax-summaries/${userId}/${taxYear}.pdf`;

    metrics.increment('tax.export.pdf');

    return pdfUrl;
  }

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  private async getIncomeData(userId: string, taxYear: number): Promise<IncomeData> {
    // In production, aggregate from payment transactions
    return {
      grossFreelanceIncome: 85000,
      returns: 500,
      netIncome: 84500,
      byClient: [
        { clientName: 'TechCorp', amount: 45000 },
        { clientName: 'StartupXYZ', amount: 25000 },
        { clientName: 'DesignAgency', amount: 15000 },
      ],
      byMonth: [7000, 6500, 7200, 6800, 7500, 7000, 7200, 7100, 7300, 7000, 7200, 7200],
    };
  }

  private async getExpenseData(userId: string, taxYear: number): Promise<ExpenseData> {
    // In production, aggregate from deductions/card transactions
    return {
      total: 12500,
      byCategory: [
        { category: 'Software & Tools', amount: 2400, deductible: true },
        { category: 'Office Supplies', amount: 800, deductible: true },
        { category: 'Professional Development', amount: 1500, deductible: true },
        { category: 'Hardware', amount: 3000, deductible: true },
        { category: 'Travel', amount: 2500, deductible: true },
        { category: 'Meals (50%)', amount: 600, deductible: true },
        { category: 'Health Insurance', amount: 1700, deductible: true },
      ],
      mileage: { miles: 1200, rate: 0.67, deduction: 804 },
      homeOffice: { squareFeet: 150, deduction: 750 },
    };
  }

  private async getEstimatedPayments(
    userId: string,
    taxYear: number
  ): Promise<EstimatedPaymentData[]> {
    // In production, fetch from tax vault payments
    return [
      { quarter: 1, amount: 6000, paidAt: new Date(`${taxYear}-04-10`) },
      { quarter: 2, amount: 6000, paidAt: new Date(`${taxYear}-06-10`) },
      { quarter: 3, amount: 6000, paidAt: new Date(`${taxYear}-09-10`) },
      { quarter: 4, amount: 6000, paidAt: new Date(`${taxYear + 1}-01-10`) },
    ];
  }

  private async getDocumentReferences(
    userId: string,
    taxYear: number
  ): Promise<DocumentReference[]> {
    // In production, fetch from tax documents service
    return [
      {
        type: '1099-K',
        name: `Skillancer 1099-K ${taxYear}`,
        url: `/tax/documents/1099k-${taxYear}`,
      },
    ];
  }

  // --------------------------------------------------------------------------
  // CONNECTION MANAGEMENT
  // --------------------------------------------------------------------------

  async getUserConnection(
    userId: string,
    provider: TaxPrepProvider
  ): Promise<TaxPrepConnection | null> {
    // In production, query database
    return null;
  }

  async getConnection(connectionId: string): Promise<TaxPrepConnection | null> {
    // In production, query database
    return null;
  }

  private async saveConnection(connection: TaxPrepConnection): Promise<void> {
    // In production, save to database
  }

  private async deleteConnection(userId: string, provider: TaxPrepProvider): Promise<void> {
    // In production, delete from database
  }

  private async updateLastSync(connectionId: string): Promise<void> {
    // In production, update database
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let taxPrepService: TaxPrepIntegrationService | null = null;

export function getTaxPrepIntegrationService(): TaxPrepIntegrationService {
  if (!taxPrepService) {
    taxPrepService = new TaxPrepIntegrationService();
  }
  return taxPrepService;
}

