// @ts-nocheck
/**
 * Unified Financial Reporting Types
 *
 * Type definitions for the unified financial reporting system that consolidates
 * income and expenses from multiple sources (Market, Cockpit, external platforms,
 * accounting software, and bank connections).
 */

import type {
  UnifiedTransactionSource,
  UnifiedTransactionType,
  UnifiedSyncStatus,
  FinancialPeriodType,
  FinancialReportType,
  FinancialReportStatus,
} from '@skillancer/database';

// ============================================================================
// Source Transaction Types (Raw data from various sources)
// ============================================================================

/**
 * Base interface for transactions from any source
 */
export interface SourceTransaction {
  /** Unique identifier from the source system */
  externalId: string;
  /** Source platform/system */
  source: UnifiedTransactionSource;
  /** Transaction type */
  type: UnifiedTransactionType;
  /** Transaction amount in source currency */
  amount: number;
  /** Source currency code (ISO 4217) */
  currency: string;
  /** Transaction date */
  transactionDate: Date;
  /** Description/memo from source */
  description?: string;
  /** Category from source (if available) */
  category?: string;
  /** Client identifier from source (if available) */
  clientExternalId?: string;
  /** Project identifier from source (if available) */
  projectExternalId?: string;
  /** Additional metadata from source */
  metadata?: Record<string, unknown>;
}

/**
 * Transaction from Skillancer Market
 */
export interface MarketSourceTransaction extends SourceTransaction {
  source: typeof UnifiedTransactionSource.MARKET;
  /** Market contract ID */
  contractId: string;
  /** Milestone ID (if applicable) */
  milestoneId?: string;
  /** Platform fee amount */
  platformFee?: number;
  /** Payment processing fee */
  processingFee?: number;
  /** Net amount after fees */
  netAmount: number;
}

/**
 * Transaction from Cockpit (manual entry)
 */
export interface CockpitSourceTransaction extends SourceTransaction {
  source: typeof UnifiedTransactionSource.COCKPIT;
  /** Cockpit project ID */
  cockpitProjectId?: string;
  /** Invoice ID (if linked) */
  invoiceId?: string;
  /** Time entry IDs (if linked) */
  timeEntryIds?: string[];
  /** Receipt/attachment URLs */
  attachments?: string[];
  /** Tax deductible flag */
  taxDeductible?: boolean;
  /** IRS expense category */
  irsCategory?: string;
}

/**
 * Transaction from external platforms (Upwork, Fiverr, etc.)
 */
export interface ExternalPlatformTransaction extends SourceTransaction {
  source: typeof UnifiedTransactionSource.UPWORK;
  /** External client name */
  clientName?: string;
  /** External project name */
  projectName?: string;
  /** Platform fee percentage */
  platformFeePercent?: number;
  /** Platform fee amount */
  platformFee?: number;
  /** Net amount after platform fees */
  netAmount: number;
  /** External contract/job ID */
  contractId?: string;
}

/**
 * Transaction from accounting software (QuickBooks, Xero, etc.)
 */
export interface AccountingSoftwareTransaction extends SourceTransaction {
  source: typeof UnifiedTransactionSource.QUICKBOOKS;
  /** Account name in accounting software */
  accountName?: string;
  /** Account type (income, expense, asset, liability) */
  accountType?: string;
  /** Tax code from accounting software */
  taxCode?: string;
  /** Tax amount */
  taxAmount?: number;
  /** Reconciliation status */
  isReconciled?: boolean;
  /** Invoice/Bill number */
  documentNumber?: string;
}

/**
 * Transaction from bank connection (Plaid)
 */
export interface BankTransaction extends SourceTransaction {
  source: typeof UnifiedTransactionSource.PLAID;
  /** Bank account ID */
  accountId: string;
  /** Bank account name */
  accountName: string;
  /** Plaid transaction ID */
  plaidTransactionId: string;
  /** Merchant name */
  merchantName?: string;
  /** Plaid category hierarchy */
  plaidCategories?: string[];
  /** Is pending transaction */
  isPending: boolean;
  /** Payment channel (online, in_store, etc.) */
  paymentChannel?: string;
  /** Location (if available) */
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
}

/**
 * Union type for all source transactions
 */
export type AnySourceTransaction =
  | MarketSourceTransaction
  | CockpitSourceTransaction
  | ExternalPlatformTransaction
  | AccountingSoftwareTransaction
  | BankTransaction;

// ============================================================================
// Unified Transaction Types
// ============================================================================

/**
 * Normalized unified transaction after processing
 */
export interface UnifiedTransactionData {
  id?: string;
  userId: string;
  source: UnifiedTransactionSource;
  transactionType: UnifiedTransactionType;
  externalId: string;
  deduplicationKey: string;

  // Amounts
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  baseCurrency: string;
  exchangeRate: number;
  exchangeRateDate: Date;

  // Fees
  platformFee?: number;
  processingFee?: number;
  netAmount: number;

  // Transaction details
  transactionDate: Date;
  description?: string;
  category?: string;

  // Linked entities
  clientId?: string;
  cockpitProjectId?: string;
  marketContractId?: string;
  invoiceId?: string;
  timeEntryIds?: string[];

  // Tax information
  taxDeductible: boolean;
  irsCategory?: string;
  taxYear?: number;

  // External references
  externalClientName?: string;
  externalProjectName?: string;

  // Attachments
  attachments?: string[];

  // Metadata
  metadata?: Record<string, unknown>;
  rawData?: Record<string, unknown>;

  // Sync status
  syncStatus: UnifiedSyncStatus;
  syncError?: string;
  lastSyncedAt?: Date;
}

/**
 * Filters for querying unified transactions
 */
export interface UnifiedTransactionFilters {
  userId: string;
  sources?: UnifiedTransactionSource[];
  transactionTypes?: UnifiedTransactionType[];
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  clientId?: string;
  projectId?: string;
  category?: string;
  taxDeductible?: boolean;
  irsCategory?: string;
  taxYear?: number;
  syncStatus?: UnifiedSyncStatus[];
  searchTerm?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// Bulk Ingestion Types
// ============================================================================

/**
 * Result of bulk transaction ingestion
 */
export interface BulkIngestResult {
  /** Total transactions processed */
  totalProcessed: number;
  /** Successfully ingested transactions */
  successCount: number;
  /** Failed transactions */
  failedCount: number;
  /** Duplicate transactions detected */
  duplicateCount: number;
  /** New transactions created */
  createdIds: string[];
  /** Updated transaction IDs */
  updatedIds: string[];
  /** Errors encountered */
  errors: IngestError[];
  /** Processing duration in milliseconds */
  processingTimeMs: number;
}

/**
 * Error during ingestion
 */
export interface IngestError {
  externalId: string;
  source: UnifiedTransactionSource;
  error: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Parameters for generating financial reports
 */
export interface ReportParameters {
  userId: string;
  reportType: FinancialReportType;
  periodType: FinancialPeriodType;
  startDate: Date;
  endDate: Date;
  baseCurrency: string;
  sources?: UnifiedTransactionSource[];
  clientIds?: string[];
  projectIds?: string[];
  categories?: string[];
  includeSubcategories?: boolean;
  groupBy?: ReportGrouping[];
  compareWithPreviousPeriod?: boolean;
}

/**
 * Report grouping options
 */
export type ReportGrouping =
  | 'source'
  | 'client'
  | 'project'
  | 'category'
  | 'month'
  | 'quarter'
  | 'year';

/**
 * Profit & Loss report data
 */
export interface ProfitLossReportData {
  period: {
    start: Date;
    end: Date;
    type: FinancialPeriodType;
  };
  currency: string;

  // Summary
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;

  // Income breakdown
  incomeBySource: Record<UnifiedTransactionSource, number>;
  incomeByClient: Array<{
    clientId?: string;
    clientName: string;
    amount: number;
    percentage: number;
  }>;
  incomeByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;

  // Expense breakdown
  expensesByCategory: Array<{
    category: string;
    irsCategory?: string;
    amount: number;
    percentage: number;
    taxDeductible: boolean;
  }>;

  // Time series data
  monthlyBreakdown: Array<{
    month: string;
    income: number;
    expenses: number;
    netProfit: number;
  }>;

  // Comparison with previous period (if requested)
  previousPeriod?: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    incomeChange: number;
    expenseChange: number;
    profitChange: number;
    incomeChangePercent: number;
    expenseChangePercent: number;
    profitChangePercent: number;
  };
}

/**
 * Cash flow report data
 */
export interface CashFlowReportData {
  period: {
    start: Date;
    end: Date;
    type: FinancialPeriodType;
  };
  currency: string;

  // Summary
  openingBalance: number;
  closingBalance: number;
  netCashFlow: number;

  // Cash flow categories
  operatingActivities: {
    inflows: number;
    outflows: number;
    net: number;
    details: Array<{
      category: string;
      amount: number;
    }>;
  };

  investingActivities: {
    inflows: number;
    outflows: number;
    net: number;
    details: Array<{
      category: string;
      amount: number;
    }>;
  };

  financingActivities: {
    inflows: number;
    outflows: number;
    net: number;
    details: Array<{
      category: string;
      amount: number;
    }>;
  };

  // Time series
  dailyBalance: Array<{
    date: string;
    balance: number;
    inflows: number;
    outflows: number;
  }>;
}

/**
 * Tax summary report data
 */
export interface TaxSummaryReportData {
  taxYear: number;
  currency: string;
  userId: string;

  // Income summary
  grossIncome: number;
  incomeBySource: Record<UnifiedTransactionSource, number>;
  form1099Income: number;

  // Deductions
  totalDeductions: number;
  deductionsByCategory: Array<{
    irsCategory: string;
    description: string;
    amount: number;
    scheduleC_Line?: string;
  }>;

  // Home office
  homeOfficeDeduction?: {
    method: 'simplified' | 'regular';
    amount: number;
    squareFootage?: number;
  };

  // Self-employment tax
  netSelfEmploymentIncome: number;
  selfEmploymentTax: number;
  deductibleSEtax: number;

  // Estimated quarterly payments
  quarterlyPayments: Array<{
    quarter: 1 | 2 | 3 | 4;
    dueDate: Date;
    estimatedAmount: number;
    paidAmount: number;
    paidDate?: Date;
  }>;

  // Mileage
  mileageDeduction?: {
    totalMiles: number;
    ratePerMile: number;
    amount: number;
  };

  // Summary
  taxableIncome: number;
  estimatedTaxLiability: number;
  effectiveTaxRate: number;
}

/**
 * Client profitability report data
 */
export interface ClientProfitabilityData {
  period: {
    start: Date;
    end: Date;
  };
  currency: string;

  clientId: string;
  clientName: string;

  // Revenue
  totalRevenue: number;
  revenueBySource: Record<UnifiedTransactionSource, number>;

  // Costs
  directCosts: number;
  allocatedOverhead: number;
  totalCosts: number;

  // Time
  totalHours: number;
  billableHours: number;
  billableRate: number;
  effectiveHourlyRate: number;

  // Profitability
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;

  // Projects
  projectCount: number;
  activeProjects: number;
  completedProjects: number;

  // Trend
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    costs: number;
    profit: number;
    hours: number;
  }>;
}

/**
 * Platform performance comparison data
 */
export interface PlatformPerformanceData {
  period: {
    start: Date;
    end: Date;
  };
  currency: string;

  source: UnifiedTransactionSource;

  // Revenue metrics
  totalRevenue: number;
  grossRevenue: number;
  netRevenue: number;
  platformFees: number;
  processingFees: number;
  feePercentage: number;

  // Activity metrics
  transactionCount: number;
  contractCount: number;
  clientCount: number;
  averageContractValue: number;

  // Performance metrics
  averageTransactionValue: number;
  revenuePerClient: number;
  revenuePerContract: number;

  // Comparison ranking
  revenueRank?: number;
  netRevenueRank?: number;
  feeEfficiencyRank?: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Consolidated financial dashboard data
 */
export interface ConsolidatedDashboard {
  userId: string;
  baseCurrency: string;
  generatedAt: Date;

  // Current period summary (MTD by default)
  currentPeriod: {
    start: Date;
    end: Date;
    type: FinancialPeriodType;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
  };

  // Year-to-date summary
  yearToDate: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    taxableIncome: number;
    estimatedTax: number;
  };

  // Income by source
  incomeBySource: Array<{
    source: UnifiedTransactionSource;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;

  // Top clients
  topClients: Array<{
    clientId?: string;
    clientName: string;
    revenue: number;
    profitMargin: number;
    hoursWorked: number;
  }>;

  // Recent transactions
  recentTransactions: Array<{
    id: string;
    source: UnifiedTransactionSource;
    type: UnifiedTransactionType;
    amount: number;
    currency: string;
    date: Date;
    description?: string;
  }>;

  // Monthly trend (last 12 months)
  monthlyTrend: Array<{
    month: string;
    income: number;
    expenses: number;
    netProfit: number;
  }>;

  // Pending sync items
  pendingSyncs: Array<{
    source: UnifiedTransactionSource;
    count: number;
    lastSyncAt?: Date;
    hasErrors: boolean;
  }>;

  // Alerts/warnings
  alerts: Array<{
    type: 'warning' | 'info' | 'error';
    message: string;
    action?: string;
    actionUrl?: string;
  }>;
}

// ============================================================================
// Currency Types
// ============================================================================

/**
 * Currency conversion rate
 */
export interface CurrencyRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDate: Date;
  source: string;
}

/**
 * Currency conversion request
 */
export interface CurrencyConversionRequest {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  date?: Date;
}

/**
 * Currency conversion result
 */
export interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  rateDate: Date;
  rateSource: string;
}

// ============================================================================
// Deduplication Types
// ============================================================================

/**
 * Potential duplicate pair
 */
export interface DuplicatePair {
  transaction1: {
    id: string;
    source: UnifiedTransactionSource;
    externalId: string;
    amount: number;
    date: Date;
    description?: string;
  };
  transaction2: {
    id: string;
    source: UnifiedTransactionSource;
    externalId: string;
    amount: number;
    date: Date;
    description?: string;
  };
  confidenceScore: number;
  matchReason: string;
  suggestedAction: 'merge' | 'keep_both' | 'review';
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  totalChecked: number;
  duplicatesFound: number;
  autoMerged: number;
  pendingReview: DuplicatePair[];
}

// ============================================================================
// Saved Report Types
// ============================================================================

/**
 * Saved report configuration
 */
export interface SavedReportConfig {
  id?: string;
  userId: string;
  name: string;
  reportType: FinancialReportType;
  parameters: ReportParameters;
  isScheduled: boolean;
  scheduleCron?: string;
  exportFormat?: 'pdf' | 'xlsx' | 'csv';
  recipients?: string[];
}

/**
 * Generated report metadata
 */
export interface GeneratedReportMetadata {
  id: string;
  savedReportId?: string;
  reportType: FinancialReportType;
  status: FinancialReportStatus;
  parameters: ReportParameters;
  generatedAt?: Date;
  expiresAt?: Date;
  fileUrl?: string;
  fileSizeBytes?: number;
  error?: string;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Sync configuration for a source
 */
export interface SourceSyncConfig {
  userId: string;
  source: UnifiedTransactionSource;
  isEnabled: boolean;
  credentials?: Record<string, unknown>;
  lastSyncAt?: Date;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
  syncStartDate?: Date;
}

/**
 * Sync job result
 */
export interface SyncJobResult {
  userId: string;
  source: UnifiedTransactionSource;
  startedAt: Date;
  completedAt: Date;
  status: 'success' | 'partial' | 'failed';
  transactionsFound: number;
  transactionsSynced: number;
  duplicatesSkipped: number;
  errors: string[];
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export options
 */
export interface ExportOptions {
  format: 'pdf' | 'xlsx' | 'csv';
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeDetails?: boolean;
  dateFormat?: string;
  currencyFormat?: string;
  timezone?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: Date;
}
