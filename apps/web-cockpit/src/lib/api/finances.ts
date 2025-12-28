/**
 * Financial API Client
 * Handles bank accounts, transactions, and financial reporting
 */

// Types
export type AccountType = 'checking' | 'savings' | 'credit' | 'investment';
export type ConnectionStatus = 'connected' | 'needs_attention' | 'disconnected';

export interface BankAccount {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
  accountName: string;
  accountType: AccountType;
  accountMask: string;
  currentBalance: number;
  availableBalance?: number;
  currency: string;
  connectionStatus: ConnectionStatus;
  lastSynced: string;
  isHidden: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  pending: boolean;
  merchantName?: string;
  merchantLogo?: string;
  notes?: string;
  isReconciled: boolean;
  linkedExpenseId?: string;
  linkedInvoiceId?: string;
}

export interface FinancialSummary {
  totalCash: number;
  totalCredit: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNetProfit: number;
  profitMargin: number;
  revenueGrowth: number;
  expenseGrowth: number;
}

export interface ProfitLossReport {
  period: {
    start: string;
    end: string;
  };
  income: {
    total: number;
    byCategory: Array<{ name: string; amount: number }>;
    byClient: Array<{ name: string; amount: number }>;
  };
  expenses: {
    total: number;
    byCategory: Array<{ name: string; amount: number; percentage: number }>;
  };
  netProfit: number;
  profitMargin: number;
  comparison?: {
    previousPeriod: {
      income: number;
      expenses: number;
      netProfit: number;
    };
    changes: {
      income: number;
      expenses: number;
      netProfit: number;
    };
  };
}

export interface TransactionFilters {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  category?: string;
  pending?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// Helper function for API calls
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Bank Account operations
export const bankAccountApi = {
  /**
   * List all connected bank accounts
   */
  list: async (includeHidden?: boolean): Promise<BankAccount[]> => {
    const query = includeHidden ? '?includeHidden=true' : '';
    return apiRequest(`/bank-accounts${query}`);
  },

  /**
   * Get a single bank account
   */
  get: async (id: string): Promise<BankAccount> => {
    return apiRequest(`/bank-accounts/${id}`);
  },

  /**
   * Initialize Plaid Link for connecting new account
   */
  createLinkToken: async (): Promise<{ linkToken: string }> => {
    return apiRequest('/bank-accounts/link-token', {
      method: 'POST',
    });
  },

  /**
   * Exchange Plaid public token after successful link
   */
  exchangeToken: async (
    publicToken: string,
    metadata: Record<string, unknown>
  ): Promise<BankAccount[]> => {
    return apiRequest('/bank-accounts/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ publicToken, metadata }),
    });
  },

  /**
   * Sync account transactions
   */
  sync: async (id?: string): Promise<{ synced: number; accounts: string[] }> => {
    const endpoint = id ? `/bank-accounts/${id}/sync` : '/bank-accounts/sync-all';
    return apiRequest(endpoint, {
      method: 'POST',
    });
  },

  /**
   * Hide/unhide an account
   */
  toggleHidden: async (id: string, hidden: boolean): Promise<BankAccount> => {
    return apiRequest(`/bank-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isHidden: hidden }),
    });
  },

  /**
   * Disconnect a bank account
   */
  disconnect: async (id: string): Promise<void> => {
    return apiRequest(`/bank-accounts/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Update account name
   */
  rename: async (id: string, name: string): Promise<BankAccount> => {
    return apiRequest(`/bank-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountName: name }),
    });
  },

  /**
   * Fix connection issues (re-authenticate)
   */
  fixConnection: async (id: string): Promise<{ linkToken: string }> => {
    return apiRequest(`/bank-accounts/${id}/fix-connection`, {
      method: 'POST',
    });
  },
};

// Transaction operations
export const transactionApi = {
  /**
   * List transactions with filters
   */
  list: async (
    filters?: TransactionFilters
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return apiRequest(`/transactions${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single transaction
   */
  get: async (id: string): Promise<Transaction> => {
    return apiRequest(`/transactions/${id}`);
  },

  /**
   * Update transaction category
   */
  categorize: async (id: string, category: string): Promise<Transaction> => {
    return apiRequest(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ category }),
    });
  },

  /**
   * Bulk categorize transactions
   */
  bulkCategorize: async (ids: string[], category: string): Promise<{ updated: number }> => {
    return apiRequest('/transactions/bulk-categorize', {
      method: 'POST',
      body: JSON.stringify({ ids, category }),
    });
  },

  /**
   * Add note to transaction
   */
  addNote: async (id: string, notes: string): Promise<Transaction> => {
    return apiRequest(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  },

  /**
   * Link transaction to expense
   */
  linkToExpense: async (transactionId: string, expenseId: string): Promise<Transaction> => {
    return apiRequest(`/transactions/${transactionId}/link-expense`, {
      method: 'POST',
      body: JSON.stringify({ expenseId }),
    });
  },

  /**
   * Link transaction to invoice
   */
  linkToInvoice: async (transactionId: string, invoiceId: string): Promise<Transaction> => {
    return apiRequest(`/transactions/${transactionId}/link-invoice`, {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    });
  },

  /**
   * Mark transaction as reconciled
   */
  reconcile: async (id: string): Promise<Transaction> => {
    return apiRequest(`/transactions/${id}/reconcile`, {
      method: 'POST',
    });
  },

  /**
   * Auto-match transactions to expenses/invoices
   */
  autoMatch: async (ids?: string[]): Promise<{ matched: number }> => {
    return apiRequest('/transactions/auto-match', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  /**
   * Create expense from transaction
   */
  createExpense: async (id: string): Promise<{ expenseId: string }> => {
    return apiRequest(`/transactions/${id}/create-expense`, {
      method: 'POST',
    });
  },

  /**
   * Get categories with transaction counts
   */
  getCategories: async (): Promise<Array<{ category: string; count: number; amount: number }>> => {
    return apiRequest('/transactions/categories');
  },
};

// Financial reporting operations
export const financialReportApi = {
  /**
   * Get financial summary
   */
  getSummary: async (dateRange?: { start: string; end: string }): Promise<FinancialSummary> => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
    return apiRequest(`/finances/summary${params}`);
  },

  /**
   * Get profit & loss report
   */
  getProfitLoss: async (options?: {
    startDate?: string;
    endDate?: string;
    compareWithPrevious?: boolean;
  }): Promise<ProfitLossReport> => {
    const params = new URLSearchParams();
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const query = params.toString();
    return apiRequest(`/finances/profit-loss${query ? `?${query}` : ''}`);
  },

  /**
   * Get cash flow report
   */
  getCashFlow: async (options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    inflows: number;
    outflows: number;
    netCashFlow: number;
    byMonth: Array<{ month: string; inflow: number; outflow: number; net: number }>;
  }> => {
    const params = new URLSearchParams();
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const query = params.toString();
    return apiRequest(`/finances/cash-flow${query ? `?${query}` : ''}`);
  },

  /**
   * Get revenue by client
   */
  getRevenueByClient: async (dateRange?: {
    start: string;
    end: string;
  }): Promise<
    Array<{ clientId: string; clientName: string; amount: number; percentage: number }>
  > => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
    return apiRequest(`/finances/revenue-by-client${params}`);
  },

  /**
   * Get expense breakdown
   */
  getExpenseBreakdown: async (dateRange?: {
    start: string;
    end: string;
  }): Promise<
    Array<{ category: string; amount: number; percentage: number; isDeductible: boolean }>
  > => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
    return apiRequest(`/finances/expense-breakdown${params}`);
  },

  /**
   * Get tax summary
   */
  getTaxSummary: async (
    year: number
  ): Promise<{
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    estimatedSelfEmploymentTax: number;
    estimatedFederalTax: number;
    totalEstimatedTax: number;
    quarterlyPayments: Array<{
      quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
      dueDate: string;
      amount: number;
      paidAmount: number;
      status: 'paid' | 'pending' | 'overdue';
    }>;
    deductionsByCategory: Array<{ category: string; amount: number }>;
  }> => {
    return apiRequest(`/finances/tax-summary?year=${year}`);
  },

  /**
   * Export report
   */
  exportReport: async (
    reportType: 'profit-loss' | 'cash-flow' | 'tax-summary' | 'expense-breakdown',
    options: {
      format: 'pdf' | 'csv';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append('format', options.format);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const response = await fetch(
      `${API_BASE}/finances/reports/${reportType}/export?${params.toString()}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export report');
    }

    return response.blob();
  },

  /**
   * Get invoice aging report
   */
  getInvoiceAging: async (): Promise<
    Array<{
      range: 'current' | '1-30' | '31-60' | '61-90' | '90+';
      amount: number;
      count: number;
    }>
  > => {
    return apiRequest('/finances/invoice-aging');
  },
};

export default {
  bankAccounts: bankAccountApi,
  transactions: transactionApi,
  reports: financialReportApi,
};
