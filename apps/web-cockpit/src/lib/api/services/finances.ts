/**
 * Finances Service
 *
 * Type-safe API methods for financial management using the shared API client.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export interface FinancialSummary {
  period: {
    start: string;
    end: string;
  };
  revenue: {
    total: number;
    invoiced: number;
    received: number;
    pending: number;
    overdue: number;
  };
  expenses: {
    total: number;
    approved: number;
    pending: number;
    reimbursable: number;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
  hours: {
    total: number;
    billable: number;
    nonBillable: number;
    billablePercentage: number;
    averageHourlyRate: number;
  };
}

export interface RevenueReport {
  period: {
    start: string;
    end: string;
  };
  total: number;
  byClient: Array<{
    clientId: string;
    clientName: string;
    amount: number;
    percentage: number;
  }>;
  byProject: Array<{
    projectId: string;
    projectName: string;
    clientName: string;
    amount: number;
  }>;
  byMonth: Array<{
    month: string;
    amount: number;
    invoiceCount: number;
  }>;
  bySource: {
    projectBased: number;
    hourlyBased: number;
    retainer: number;
    other: number;
  };
}

export interface ProfitLossReport {
  period: {
    start: string;
    end: string;
  };
  revenue: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
    }>;
  };
  expenses: {
    total: number;
    breakdown: Array<{
      category: string;
      amount: number;
    }>;
  };
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  profitMargin: number;
  comparison?: {
    previousPeriod: {
      revenue: number;
      expenses: number;
      netProfit: number;
    };
    changePercentage: {
      revenue: number;
      expenses: number;
      netProfit: number;
    };
  };
}

export interface CashFlowReport {
  period: {
    start: string;
    end: string;
  };
  openingBalance: number;
  closingBalance: number;
  netCashFlow: number;
  inflows: {
    total: number;
    byCategory: Array<{
      category: string;
      amount: number;
    }>;
    byMonth: Array<{
      month: string;
      amount: number;
    }>;
  };
  outflows: {
    total: number;
    byCategory: Array<{
      category: string;
      amount: number;
    }>;
    byMonth: Array<{
      month: string;
      amount: number;
    }>;
  };
}

export interface TaxReport {
  period: {
    start: string;
    end: string;
  };
  income: {
    gross: number;
    taxable: number;
    deductions: number;
  };
  expenses: {
    total: number;
    deductible: number;
    nonDeductible: number;
  };
  taxCollected: number;
  taxPaid: number;
  estimatedTaxLiability: number;
  deductionsByCategory: Array<{
    category: string;
    amount: number;
  }>;
}

export interface BudgetItem {
  id: string;
  category: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  isOverBudget: boolean;
}

export interface Budget {
  id: string;
  name: string;
  period: {
    start: string;
    end: string;
  };
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  items: BudgetItem[];
  status: 'active' | 'completed' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCreate {
  name: string;
  startDate: string;
  endDate: string;
  items: Array<{
    category: string;
    budgetAmount: number;
  }>;
}

export interface FinancialGoal {
  id: string;
  name: string;
  type: 'revenue' | 'savings' | 'profit' | 'hours' | 'clients';
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  endDate: string;
  progress: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved';
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  accountId?: string;
  referenceType?: 'invoice' | 'expense' | 'payment';
  referenceId?: string;
  tags: string[];
  createdAt: string;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: 'income' | 'expense' | 'transfer';
  startDate?: string;
  endDate?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sortBy?: 'date' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FinancialInsight {
  type: 'trend' | 'anomaly' | 'recommendation' | 'milestone';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  change?: number;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
  createdAt: string;
}

export interface ReportParams {
  startDate: string;
  endDate: string;
  currency?: string;
  clientId?: string;
  projectId?: string;
}

// =============================================================================
// Finances API Service
// =============================================================================

export const financesService = {
  // =============================================================================
  // Summary & Dashboard
  // =============================================================================

  /**
   * Get financial summary
   */
  async getSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<FinancialSummary>> {
    const client = getApiClient();
    return client.get<FinancialSummary>('/finances/summary', { params });
  },

  /**
   * Get financial insights
   */
  async getInsights(): Promise<ApiResponse<FinancialInsight[]>> {
    const client = getApiClient();
    return client.get<FinancialInsight[]>('/finances/insights');
  },

  /**
   * Get key metrics
   */
  async getKeyMetrics(period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<
    ApiResponse<{
      revenue: number;
      revenueChange: number;
      expenses: number;
      expensesChange: number;
      profit: number;
      profitChange: number;
      outstandingInvoices: number;
      billableHours: number;
    }>
  > {
    const client = getApiClient();
    return client.get('/finances/metrics', { params: { period } });
  },

  // =============================================================================
  // Reports
  // =============================================================================

  /**
   * Generate revenue report
   */
  async getRevenueReport(params: ReportParams): Promise<ApiResponse<RevenueReport>> {
    const client = getApiClient();
    return client.get<RevenueReport>('/finances/reports/revenue', { params });
  },

  /**
   * Generate profit & loss report
   */
  async getProfitLossReport(params: ReportParams): Promise<ApiResponse<ProfitLossReport>> {
    const client = getApiClient();
    return client.get<ProfitLossReport>('/finances/reports/profit-loss', { params });
  },

  /**
   * Generate cash flow report
   */
  async getCashFlowReport(params: ReportParams): Promise<ApiResponse<CashFlowReport>> {
    const client = getApiClient();
    return client.get<CashFlowReport>('/finances/reports/cash-flow', { params });
  },

  /**
   * Generate tax report
   */
  async getTaxReport(params: {
    year: number;
    quarter?: 1 | 2 | 3 | 4;
  }): Promise<ApiResponse<TaxReport>> {
    const client = getApiClient();
    return client.get<TaxReport>('/finances/reports/tax', { params });
  },

  /**
   * Export report
   */
  async exportReport(
    reportType: 'revenue' | 'profit-loss' | 'cash-flow' | 'tax',
    params: ReportParams & { format: 'csv' | 'xlsx' | 'pdf' }
  ): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get(`/finances/reports/${reportType}/export`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // =============================================================================
  // Transactions
  // =============================================================================

  /**
   * List transactions
   */
  async getTransactions(
    filters: TransactionFilters = {}
  ): Promise<PaginatedResponse<FinancialTransaction>> {
    const client = getApiClient();
    const { page = 1, limit = 50, ...rest } = filters;
    return client.get<FinancialTransaction[]>('/finances/transactions', {
      params: { page, limit, ...rest },
    }) as Promise<PaginatedResponse<FinancialTransaction>>;
  },

  /**
   * Get transaction by ID
   */
  async getTransaction(id: string): Promise<ApiResponse<FinancialTransaction>> {
    const client = getApiClient();
    return client.get<FinancialTransaction>(`/finances/transactions/${id}`);
  },

  // =============================================================================
  // Budgets
  // =============================================================================

  /**
   * List budgets
   */
  async getBudgets(): Promise<ApiResponse<Budget[]>> {
    const client = getApiClient();
    return client.get<Budget[]>('/finances/budgets');
  },

  /**
   * Get active budget
   */
  async getActiveBudget(): Promise<ApiResponse<Budget | null>> {
    const client = getApiClient();
    return client.get<Budget | null>('/finances/budgets/active');
  },

  /**
   * Get budget by ID
   */
  async getBudget(id: string): Promise<ApiResponse<Budget>> {
    const client = getApiClient();
    return client.get<Budget>(`/finances/budgets/${id}`);
  },

  /**
   * Create budget
   */
  async createBudget(data: BudgetCreate): Promise<ApiResponse<Budget>> {
    const client = getApiClient();
    return client.post<Budget, BudgetCreate>('/finances/budgets', data);
  },

  /**
   * Update budget
   */
  async updateBudget(id: string, data: Partial<BudgetCreate>): Promise<ApiResponse<Budget>> {
    const client = getApiClient();
    return client.patch<Budget>(`/finances/budgets/${id}`, data);
  },

  /**
   * Delete budget
   */
  async deleteBudget(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/finances/budgets/${id}`);
  },

  // =============================================================================
  // Goals
  // =============================================================================

  /**
   * List financial goals
   */
  async getGoals(): Promise<ApiResponse<FinancialGoal[]>> {
    const client = getApiClient();
    return client.get<FinancialGoal[]>('/finances/goals');
  },

  /**
   * Create financial goal
   */
  async createGoal(
    data: Omit<
      FinancialGoal,
      'id' | 'currentAmount' | 'progress' | 'status' | 'createdAt' | 'updatedAt'
    >
  ): Promise<ApiResponse<FinancialGoal>> {
    const client = getApiClient();
    return client.post<FinancialGoal>('/finances/goals', data);
  },

  /**
   * Update financial goal
   */
  async updateGoal(id: string, data: Partial<FinancialGoal>): Promise<ApiResponse<FinancialGoal>> {
    const client = getApiClient();
    return client.patch<FinancialGoal>(`/finances/goals/${id}`, data);
  },

  /**
   * Delete financial goal
   */
  async deleteGoal(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/finances/goals/${id}`);
  },

  // =============================================================================
  // Forecasting
  // =============================================================================

  /**
   * Get revenue forecast
   */
  async getRevenueForecast(months: number = 6): Promise<
    ApiResponse<{
      forecast: Array<{
        month: string;
        predicted: number;
        lower: number;
        upper: number;
      }>;
      factors: string[];
      confidence: number;
    }>
  > {
    const client = getApiClient();
    return client.get('/finances/forecast/revenue', { params: { months } });
  },

  /**
   * Get expense forecast
   */
  async getExpenseForecast(months: number = 6): Promise<
    ApiResponse<{
      forecast: Array<{
        month: string;
        predicted: number;
        byCategory: Record<string, number>;
      }>;
      trends: Array<{
        category: string;
        trend: 'increasing' | 'decreasing' | 'stable';
        change: number;
      }>;
    }>
  > {
    const client = getApiClient();
    return client.get('/finances/forecast/expenses', { params: { months } });
  },

  // =============================================================================
  // Settings
  // =============================================================================

  /**
   * Get financial settings
   */
  async getSettings(): Promise<
    ApiResponse<{
      defaultCurrency: string;
      fiscalYearStart: number;
      taxRate: number;
      taxId?: string;
      bankAccounts: Array<{
        id: string;
        name: string;
        accountNumber: string;
        bankName: string;
        isDefault: boolean;
      }>;
    }>
  > {
    const client = getApiClient();
    return client.get('/finances/settings');
  },

  /**
   * Update financial settings
   */
  async updateSettings(
    data: Partial<{
      defaultCurrency: string;
      fiscalYearStart: number;
      taxRate: number;
      taxId: string;
    }>
  ): Promise<ApiResponse<unknown>> {
    const client = getApiClient();
    return client.patch('/finances/settings', data);
  },
};

export default financesService;
