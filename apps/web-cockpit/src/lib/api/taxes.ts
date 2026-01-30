/**
 * Taxes API Client
 * Handles tax vault, estimates, deductions, and tax document operations
 */

// =============================================================================
// TYPES
// =============================================================================

export type TaxStatus = 'pending' | 'paid' | 'overdue';
export type QuarterlyStatus = 'paid' | 'partial' | 'due' | 'overdue' | 'upcoming';
export type DepositSource = 'MANUAL' | 'AUTO_SAVE' | 'PAYMENT';
export type WithdrawalReason = 'QUARTERLY_PAYMENT' | 'TAX_PAYMENT' | 'REFUND' | 'OTHER';

export interface TaxVault {
  id: string;
  userId: string;
  balance: number;
  savingsRate: number;
  autoSaveEnabled: boolean;
  targetQuarterly: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaxVaultSummary {
  vault: TaxVault;
  totalSavedThisYear: number;
  totalWithdrawnThisYear: number;
  nextQuarterlyDue: {
    quarter: number;
    dueDate: string;
    estimatedAmount: number;
    daysUntilDue: number;
  } | null;
  recentTransactions: TaxVaultTransaction[];
}

export interface TaxEstimate {
  year: number;
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  federalTax: number;
  selfEmploymentTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  quarterlyPayment: number;
}

export interface QuarterlyPayment {
  quarter: number;
  dueDate: string;
  estimatedAmount: number;
  paidAmount: number;
  status: QuarterlyStatus;
  daysUntilDue: number;
}

export interface TaxCategory {
  name: string;
  amount: number;
  deductible: boolean;
  percentage?: number;
}

export interface TaxDeduction {
  id: string;
  category: string;
  description: string;
  amount: number;
  percentage: number;
  effectiveAmount: number;
  date: string;
  receiptId?: string;
}

export interface TaxDocument {
  id: string;
  name: string;
  type: 'W-9' | '1099-NEC' | '1099-K' | '1099-MISC' | 'Schedule C' | 'other';
  year: number;
  uploadedAt: string;
  fileSize: number;
  downloadUrl?: string;
}

export interface TaxVaultTransaction {
  id: string;
  type: 'auto_save' | 'manual_deposit' | 'quarterly_payment' | 'withdrawal';
  amount: number;
  description: string;
  createdAt: string;
}

export interface TaxSummary {
  year: number;
  grossIncome: number;
  totalIncome: TaxCategory[];
  totalDeductions: number;
  deductionCategories: TaxCategory[];
  taxableIncome: number;
  selfEmploymentTax: number;
  federalTax: number;
  stateTax: number;
  totalEstimatedTax: number;
  effectiveRate: number;
  paidSoFar: number;
  remainingBalance: number;
  quarterlyEstimates: QuarterlyPayment[];
}

export interface AnnualTaxReport {
  year: number;
  summary: TaxSummary;
  deposits: {
    total: number;
    count: number;
    byMonth: Array<{ month: string; amount: number }>;
  };
  withdrawals: {
    total: number;
    count: number;
    byQuarter: Array<{ quarter: number; amount: number }>;
  };
  documents: TaxDocument[];
}

export interface DepositInput {
  amount: number;
  description?: string;
}

export interface WithdrawalInput {
  amount: number;
  reason: WithdrawalReason;
  description?: string;
}

export interface VaultSettingsInput {
  savingsRate?: number;
  autoSaveEnabled?: boolean;
  targetQuarterly?: number;
}

// =============================================================================
// API CLIENT
// =============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

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
    const error = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(error.message || error.error || `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const taxesApi = {
  // ===========================================================================
  // TAX VAULT OPERATIONS
  // ===========================================================================

  /**
   * Get or create tax vault for current user
   */
  getVault: async (): Promise<TaxVault> => {
    return apiRequest('/financial/tax-vault');
  },

  /**
   * Get vault with summary details (totals, next quarterly, recent transactions)
   */
  getVaultSummary: async (): Promise<TaxVaultSummary> => {
    return apiRequest('/financial/tax-vault/summary');
  },

  /**
   * Update vault settings (savings rate, auto-save toggle, quarterly target)
   */
  updateVaultSettings: async (settings: VaultSettingsInput): Promise<TaxVault> => {
    return apiRequest('/financial/tax-vault', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Make a manual deposit to the tax vault
   */
  deposit: async (input: DepositInput): Promise<TaxVaultTransaction> => {
    return apiRequest('/financial/tax-vault/deposit', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Withdraw from tax vault (e.g., for quarterly payment)
   */
  withdraw: async (input: WithdrawalInput): Promise<TaxVaultTransaction> => {
    return apiRequest('/financial/tax-vault/withdraw', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get deposit history
   */
  getDeposits: async (
    page = 1,
    limit = 20
  ): Promise<{ deposits: TaxVaultTransaction[]; total: number; pages: number }> => {
    return apiRequest(`/financial/tax-vault/deposits?page=${page}&limit=${limit}`);
  },

  /**
   * Get withdrawal history
   */
  getWithdrawals: async (
    page = 1,
    limit = 20
  ): Promise<{ withdrawals: TaxVaultTransaction[]; total: number; pages: number }> => {
    return apiRequest(`/financial/tax-vault/withdrawals?page=${page}&limit=${limit}`);
  },

  // ===========================================================================
  // TAX SUMMARY & ESTIMATES
  // ===========================================================================

  /**
   * Get annual tax summary with income, deductions, estimates
   */
  getTaxSummary: async (year: number): Promise<TaxSummary> => {
    return apiRequest(`/financial/tax-vault/report/${year}`);
  },

  /**
   * Get quarterly tax estimates for a year
   */
  getQuarterlyEstimates: async (year: number): Promise<QuarterlyPayment[]> => {
    const summary = await apiRequest<TaxSummary>(`/financial/tax-vault/report/${year}`);
    return summary.quarterlyEstimates;
  },

  /**
   * Get tax estimate calculation
   */
  getTaxEstimate: async (year: number): Promise<TaxEstimate> => {
    const summary = await apiRequest<TaxSummary>(`/financial/tax-vault/report/${year}`);
    return {
      year,
      grossIncome: summary.grossIncome,
      totalDeductions: summary.totalDeductions,
      taxableIncome: summary.taxableIncome,
      federalTax: summary.federalTax,
      selfEmploymentTax: summary.selfEmploymentTax,
      stateTax: summary.stateTax || 0,
      totalTax: summary.totalEstimatedTax,
      effectiveRate: summary.effectiveRate,
      quarterlyPayment: summary.totalEstimatedTax / 4,
    };
  },

  // ===========================================================================
  // DEDUCTIONS
  // ===========================================================================

  /**
   * Get tracked deductions for a year
   */
  getDeductions: async (year: number): Promise<TaxCategory[]> => {
    const summary = await apiRequest<TaxSummary>(`/financial/tax-vault/report/${year}`);
    return summary.deductionCategories;
  },

  /**
   * Get income categories for a year
   */
  getIncomeCategories: async (year: number): Promise<TaxCategory[]> => {
    const summary = await apiRequest<TaxSummary>(`/financial/tax-vault/report/${year}`);
    return summary.totalIncome;
  },

  // ===========================================================================
  // TAX DOCUMENTS
  // ===========================================================================

  /**
   * List tax documents
   */
  getTaxDocuments: async (year?: number): Promise<TaxDocument[]> => {
    const query = year ? `?year=${year}` : '';
    return apiRequest(`/financial/tax-documents${query}`);
  },

  /**
   * Download a tax document
   */
  downloadTaxDocument: async (id: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/financial/tax-documents/${id}/download`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.status}`);
    }

    return response.blob();
  },

  /**
   * Upload a tax document
   */
  uploadTaxDocument: async (
    file: File,
    metadata: { name: string; type: TaxDocument['type']; year: number }
  ): Promise<TaxDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', metadata.name);
    formData.append('type', metadata.type);
    formData.append('year', metadata.year.toString());

    const response = await fetch(`${API_BASE}/financial/tax-documents`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(error.message || `Upload failed: ${response.status}`);
    }

    return response.json() as Promise<TaxDocument>;
  },

  /**
   * Delete a tax document
   */
  deleteTaxDocument: async (id: string): Promise<void> => {
    return apiRequest(`/financial/tax-documents/${id}`, {
      method: 'DELETE',
    });
  },

  // ===========================================================================
  // QUARTERLY PAYMENT ACTIONS
  // ===========================================================================

  /**
   * Mark a quarterly payment as paid
   */
  markQuarterlyPaid: async (
    year: number,
    quarter: number,
    amount: number
  ): Promise<QuarterlyPayment> => {
    return apiRequest(`/financial/quarterly-payments/${year}/${quarter}/pay`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  /**
   * Export tax report as PDF
   */
  exportTaxReport: async (year: number): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/financial/tax-vault/report/${year}/export`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to export report: ${response.status}`);
    }

    return response.blob();
  },
};

export default taxesApi;
