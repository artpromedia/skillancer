/**
 * @module @skillancer/cockpit-svc/types/finance
 * Type definitions for the income & expense tracking system
 */

// Import from @prisma/client directly until @skillancer/database exports are fixed
import type {
  FinancialAccount,
  FinancialTransaction,
  RecurringTransaction,
  TransactionCategory,
  FinancialGoal,
  MileageLog,
  TaxProfile,
  Client,
  CockpitProject,
  FinancialAccountType,
  FinancialTransactionType,
  FinancialTransactionSource,
  FinancialTransactionStatus,
  RecurrenceFrequency,
  FinancialGoalType,
  FinancialGoalStatus,
  FinancialPeriodType,
  MileagePurpose,
  BusinessType,
  FilingStatus,
  AccountingMethod,
} from '@prisma/client';

// Re-export enums using export...from for proper TypeScript module semantics
export {
  FinancialAccountType,
  FinancialTransactionType,
  FinancialTransactionSource,
  FinancialTransactionStatus,
  RecurrenceFrequency,
  FinancialGoalType,
  FinancialGoalStatus,
  FinancialPeriodType,
  MileagePurpose,
  BusinessType,
  FilingStatus,
  AccountingMethod,
} from '@prisma/client';

// ============================================================================
// FINANCIAL ACCOUNT TYPES
// ============================================================================

export interface CreateFinancialAccountParams {
  userId: string;
  accountType: FinancialAccountType;
  name: string;
  institutionName?: string;
  accountNumber?: string;
  currentBalance?: number;
  currency?: string;
  isPrimary?: boolean;
  color?: string;
  icon?: string;
}

export interface UpdateFinancialAccountParams {
  name?: string;
  institutionName?: string;
  accountNumber?: string;
  currentBalance?: number;
  currency?: string;
  isPrimary?: boolean;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export interface ConnectPlaidAccountParams {
  userId: string;
  publicToken: string;
  institutionId: string;
  institutionName: string;
  accounts: PlaidAccountInfo[];
}

export interface PlaidAccountInfo {
  id: string;
  name: string;
  mask?: string;
  type: string;
  subtype?: string;
  currentBalance?: number;
  availableBalance?: number;
}

export interface FinancialAccountWithBalance extends FinancialAccount {
  pendingTransactionCount?: number;
  lastSyncDate?: Date | null;
}

export interface AccountFilters {
  userId: string;
  accountType?: FinancialAccountType;
  isActive?: boolean;
  includeArchived?: boolean;
}

// ============================================================================
// FINANCIAL TRANSACTION TYPES
// ============================================================================

export interface CreateTransactionParams {
  userId: string;
  accountId?: string;
  categoryId?: string;
  clientId?: string;
  projectId?: string;
  transactionType: FinancialTransactionType;
  amount: number;
  currency?: string;
  transactionDate: Date;
  description: string;
  vendor?: string;
  invoiceNumber?: string;
  notes?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurringTransactionId?: string;
  isTaxDeductible?: boolean;
  taxDeductiblePercentage?: number;
  tags?: string[];
}

export interface UpdateTransactionParams {
  accountId?: string;
  categoryId?: string;
  clientId?: string;
  projectId?: string;
  amount?: number;
  currency?: string;
  transactionDate?: Date;
  description?: string;
  vendor?: string;
  invoiceNumber?: string;
  notes?: string;
  receiptUrl?: string;
  isTaxDeductible?: boolean;
  taxDeductiblePercentage?: number;
  tags?: string[];
  status?: FinancialTransactionStatus;
  isReconciled?: boolean;
}

export interface TransactionFilters {
  userId: string;
  accountId?: string;
  categoryId?: string;
  clientId?: string;
  projectId?: string;
  transactionType?: FinancialTransactionType;
  source?: FinancialTransactionSource;
  status?: FinancialTransactionStatus;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  isTaxDeductible?: boolean;
  isReconciled?: boolean;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'transactionDate' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionWithDetails extends Omit<FinancialTransaction, 'category'> {
  account?: Pick<FinancialAccount, 'id' | 'name' | 'accountType'> | null;
  category?: string | Pick<TransactionCategory, 'id' | 'name' | 'type' | 'icon' | 'color'> | null;
  client?: Pick<Client, 'id' | 'firstName' | 'lastName' | 'companyName'> | null;
  project?: Pick<CockpitProject, 'id' | 'name'> | null;
}

export interface SplitTransactionParams {
  userId: string;
  originalTransactionId: string;
  splits: Array<{
    categoryId?: string;
    amount: number;
    description?: string;
    isTaxDeductible?: boolean;
    taxDeductiblePercentage?: number;
  }>;
}

export interface BulkCategorizeParams {
  userId: string;
  transactionIds: string[];
  categoryId: string;
}

export interface BulkUpdateTransactionsParams {
  userId: string;
  transactionIds: string[];
  updates: {
    categoryId?: string;
    isTaxDeductible?: boolean;
    isReconciled?: boolean;
    tags?: string[];
  };
}

// ============================================================================
// RECURRING TRANSACTION TYPES
// ============================================================================

export interface CreateRecurringTransactionParams {
  userId: string;
  category: string;
  subcategory?: string;
  accountId?: string;
  type: FinancialTransactionType;
  amount: number;
  currency?: string;
  description: string;
  vendor?: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  startDate: Date;
  endDate?: Date;
  dayOfMonth?: number;
  dayOfWeek?: number;
  isDeductible?: boolean;
  autoCreate?: boolean;
  requiresConfirmation?: boolean;
  clientId?: string;
  projectId?: string;
}

export interface UpdateRecurringTransactionParams {
  category?: string;
  subcategory?: string;
  accountId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  vendor?: string;
  frequency?: RecurrenceFrequency;
  interval?: number;
  endDate?: Date;
  dayOfMonth?: number;
  dayOfWeek?: number;
  isDeductible?: boolean;
  isActive?: boolean;
  isPaused?: boolean;
  autoCreate?: boolean;
  requiresConfirmation?: boolean;
  clientId?: string;
  projectId?: string;
}

export interface RecurringTransactionWithDetails extends Omit<RecurringTransaction, 'category'> {
  categoryDetails?: Pick<TransactionCategory, 'id' | 'name' | 'type' | 'icon'> | null;
  account?: Pick<FinancialAccount, 'id' | 'name'> | null;
  generatedTransactionCount?: number;
}

// ============================================================================
// TRANSACTION CATEGORY TYPES
// ============================================================================

export interface CreateFinanceCategoryParams {
  userId: string;
  name: string;
  type: FinancialTransactionType;
  parentId?: string;
  icon?: string;
  color?: string;
  irsCategory?: string;
  isDeductible?: boolean;
}

export interface UpdateFinanceCategoryParams {
  name?: string;
  icon?: string;
  color?: string;
  irsCategory?: string;
  isDeductible?: boolean;
  isActive?: boolean;
}

export interface CategoryWithStats extends TransactionCategory {
  transactionCount: number;
  totalAmount: number;
  children?: CategoryWithStats[];
}

export interface CategoryFilters {
  userId: string;
  type?: FinancialTransactionType;
  isSystem?: boolean;
  isActive?: boolean;
  includeHierarchy?: boolean;
}

// ============================================================================
// FINANCIAL GOAL TYPES
// ============================================================================

export interface CreateGoalParams {
  userId: string;
  name: string;
  goalType: FinancialGoalType;
  targetAmount: number;
  currency?: string;
  periodType?: FinancialPeriodType;
  startDate: Date;
  endDate?: Date;
  description?: string;
  icon?: string;
  color?: string;
  linkedCategoryIds?: string[];
}

export interface UpdateGoalParams {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  periodType?: FinancialPeriodType;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  icon?: string;
  color?: string;
  status?: FinancialGoalStatus;
  linkedCategoryIds?: string[];
}

export interface GoalWithProgress extends FinancialGoal {
  progressPercentage: number;
  remainingAmount: number;
  daysRemaining?: number;
  projectedCompletion?: Date;
  trend: 'ON_TRACK' | 'AHEAD' | 'BEHIND' | 'AT_RISK';
}

export interface GoalFilters {
  userId: string;
  goalType?: FinancialGoalType;
  status?: FinancialGoalStatus;
  periodType?: FinancialPeriodType;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// MILEAGE LOG TYPES
// ============================================================================

export interface CreateMileageLogParams {
  userId: string;
  projectId?: string;
  clientId?: string;
  date: Date;
  description: string;
  startLocation?: string;
  endLocation?: string;
  miles: number;
  purpose: MileagePurpose;
  roundTrip?: boolean;
  taxYear?: number;
  vehicleId?: string;
}

export interface UpdateMileageLogParams {
  projectId?: string;
  clientId?: string;
  date?: Date;
  description?: string;
  startLocation?: string;
  endLocation?: string;
  miles?: number;
  purpose?: MileagePurpose;
  roundTrip?: boolean;
  vehicleId?: string;
}

export interface MileageLogWithDetails extends MileageLog {
  client?: Pick<Client, 'id' | 'firstName' | 'lastName' | 'companyName'> | null;
  project?: Pick<CockpitProject, 'id' | 'name'> | null;
}

export interface MileageFilters {
  userId: string;
  projectId?: string;
  clientId?: string;
  purpose?: MileagePurpose;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface MileageSummary {
  totalMiles: number;
  clientMeetingMiles: number;
  businessErrandMiles: number;
  travelMiles: number;
  otherMiles: number;
  estimatedDeduction: number;
}

// ============================================================================
// TAX PROFILE TYPES
// ============================================================================

export interface CreateTaxProfileParams {
  userId: string;
  businessType: BusinessType;
  filingStatus: FilingStatus;
  accountingMethod?: AccountingMethod;
  businessName?: string;
  ein?: string;
  estimatedTaxRate?: number;
  stateOfResidence?: string;
  stateIncomeTaxRate?: number;
  hasHomeOffice?: boolean;
  homeOfficeSquareFeet?: number;
  totalHomeSquareFeet?: number;
  hasBusinessVehicle?: boolean;
}

export interface UpdateTaxProfileParams {
  businessType?: BusinessType;
  filingStatus?: FilingStatus;
  accountingMethod?: AccountingMethod;
  businessName?: string;
  ein?: string;
  estimatedTaxRate?: number;
  stateOfResidence?: string;
  stateIncomeTaxRate?: number;
  hasHomeOffice?: boolean;
  homeOfficeSquareFeet?: number;
  totalHomeSquareFeet?: number;
  hasBusinessVehicle?: boolean;
}

export interface TaxProfileWithEstimates extends TaxProfile {
  estimatedIncome: number;
  estimatedExpenses: number;
  estimatedDeductions: number;
  estimatedTaxableIncome: number;
  estimatedSelfEmploymentTax: number;
  estimatedIncomeTax: number;
  estimatedTotalTax: number;
  estimatedQuarterlyPayment: number;
}

// ============================================================================
// FINANCIAL REPORTS TYPES
// ============================================================================

export interface ReportFilters {
  userId: string;
  startDate: Date;
  endDate: Date;
  accountIds?: string[];
  categoryIds?: string[];
  clientIds?: string[];
  projectIds?: string[];
  transactionType?: FinancialTransactionType;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'category' | 'client' | 'project';
  compareWithPreviousPeriod?: boolean;
}

export interface ProfitLossReport {
  period: { start: Date; end: Date };
  income: {
    total: number;
    byCategory: Array<{ categoryId: string; name: string; amount: number }>;
    byClient: Array<{ clientId: string; name: string; amount: number }>;
    byProject: Array<{ projectId: string; name: string; amount: number }>;
  };
  expenses: {
    total: number;
    byCategory: Array<{ categoryId: string; name: string; amount: number }>;
  };
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  comparison?: {
    previousPeriod: { income: number; expenses: number; netProfit: number };
    incomeChange: number;
    expensesChange: number;
    profitChange: number;
  };
}

export interface CashFlowReport {
  period: { start: Date; end: Date };
  openingBalance: number;
  closingBalance: number;
  netCashFlow: number;
  inflows: Array<{
    date: Date;
    amount: number;
    runningBalance: number;
  }>;
  outflows: Array<{
    date: Date;
    amount: number;
    runningBalance: number;
  }>;
  dailyBreakdown: Array<{
    date: Date;
    inflow: number;
    outflow: number;
    netFlow: number;
    balance: number;
  }>;
}

export interface TaxReport {
  taxYear: number;
  grossIncome: number;
  totalExpenses: number;
  taxDeductibleExpenses: number;
  netSelfEmploymentIncome: number;
  mileageDeduction: number;
  homeOfficeDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedSelfEmploymentTax: number;
  estimatedIncomeTax: number;
  totalEstimatedTax: number;
  quarterlyPayments: Array<{
    quarter: number;
    dueDate: Date;
    estimatedAmount: number;
    paidAmount: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE';
  }>;
  scheduleCData: {
    grossReceipts: number;
    costOfGoodsSold: number;
    grossProfit: number;
    expenses: Array<{
      lineNumber: string;
      description: string;
      amount: number;
    }>;
    netProfit: number;
  };
}

export interface ExpenseBreakdownReport {
  period: { start: Date; end: Date };
  totalExpenses: number;
  categories: Array<{
    categoryId: string;
    name: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    trend: number;
    irsCategory?: string;
  }>;
  topVendors: Array<{
    vendor: string;
    amount: number;
    transactionCount: number;
  }>;
  taxDeductibleTotal: number;
  taxDeductiblePercentage: number;
}

export interface IncomeSourcesReport {
  period: { start: Date; end: Date };
  totalIncome: number;
  byClient: Array<{
    clientId: string;
    name: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    invoicedAmount: number;
    receivedAmount: number;
  }>;
  byProject: Array<{
    projectId: string;
    name: string;
    clientName: string;
    amount: number;
    percentage: number;
  }>;
  bySource: Array<{
    source: FinancialTransactionSource;
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
  receivablesAging: {
    current: number;
    days30: number;
    days60: number;
    days90Plus: number;
  };
}

// ============================================================================
// PLAID INTEGRATION TYPES
// ============================================================================

export interface PlaidLinkToken {
  linkToken: string;
  expiration: Date;
}

export interface PlaidWebhookPayload {
  webhookType: 'TRANSACTIONS' | 'ITEM' | 'SYNC_UPDATES';
  webhookCode: string;
  itemId: string;
  error?: {
    errorCode: string;
    errorMessage: string;
  };
  newTransactions?: number;
  removedTransactions?: string[];
}

export interface PlaidTransactionSync {
  added: PlaidTransactionData[];
  modified: PlaidTransactionData[];
  removed: string[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PlaidTransactionData {
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
  paymentChannel: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type FinancialExportFormat = 'csv' | 'xlsx' | 'pdf' | 'qbo' | 'ofx';

export interface FinanceExportParams {
  userId: string;
  format: FinancialExportFormat;
  startDate: Date;
  endDate: Date;
  includeReceipts?: boolean;
  accountIds?: string[];
  categoryIds?: string[];
  transactionType?: FinancialTransactionType;
}

export interface FinanceExportResult {
  url: string;
  filename: string;
  format: FinancialExportFormat;
  size: number;
  expiresAt: Date;
  transactionCount: number;
}

// ============================================================================
// RECEIPT TYPES
// ============================================================================

export interface UploadReceiptParams {
  userId: string;
  transactionId: string;
  file: Buffer;
  filename: string;
  mimeType: string;
}

export interface ReceiptOCRResult {
  vendor?: string;
  amount?: number;
  date?: Date;
  items?: Array<{ description: string; amount: number }>;
  confidence: number;
  rawText: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface FinancialDashboard {
  period: { start: Date; end: Date };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    incomeChange: number;
    expensesChange: number;
    profitChange: number;
  };
  accountBalances: Array<{
    accountId: string;
    name: string;
    type: FinancialAccountType;
    balance: number;
  }>;
  recentTransactions: TransactionWithDetails[];
  upcomingRecurring: RecurringTransactionWithDetails[];
  goalProgress: GoalWithProgress[];
  taxEstimate: {
    estimatedTax: number;
    nextQuarterlyPayment: number;
    nextPaymentDueDate?: Date;
  };
  alerts: FinancialAlert[];
}

export interface FinancialAlert {
  id: string;
  type:
    | 'LOW_BALANCE'
    | 'UNUSUAL_EXPENSE'
    | 'UNCATEGORIZED'
    | 'TAX_DEADLINE'
    | 'GOAL_AT_RISK'
    | 'RECURRING_DUE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  actionUrl?: string;
  createdAt: Date;
  dismissedAt?: Date;
}
