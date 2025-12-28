/**
 * Expense API Client
 * Handles all expense-related API calls including receipts and mileage
 */

// Types
export type ExpenseCategory =
  | 'software'
  | 'hardware'
  | 'cloud'
  | 'professional'
  | 'marketing'
  | 'office'
  | 'travel'
  | 'meals'
  | 'education'
  | 'mileage'
  | 'other';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';
export type ReceiptStatus = 'pending' | 'processed' | 'matched' | 'error';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  merchant: string;
  isDeductible: boolean;
  deductiblePercentage: number;
  projectId?: string;
  paymentMethod: string;
  notes?: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  status: ReceiptStatus;
  extractedData?: {
    merchant?: string;
    amount?: number;
    date?: string;
    category?: ExpenseCategory;
  };
  matchedExpenseId?: string;
}

export interface MileageTrip {
  id: string;
  date: string;
  purpose: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  ratePerMile: number;
  isRoundTrip: boolean;
  projectId?: string;
  projectName?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  date: string;
  merchant: string;
  isDeductible?: boolean;
  deductiblePercentage?: number;
  projectId?: string;
  paymentMethod: string;
  notes?: string;
  receiptFile?: File;
}

export interface UpdateExpenseInput extends Partial<CreateExpenseInput> {
  id: string;
}

export interface ExpenseFilters {
  category?: ExpenseCategory | ExpenseCategory[];
  status?: ExpenseStatus;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  isDeductible?: boolean;
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'category' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ExpenseListResponse {
  expenses: Expense[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalDeductible: number;
  byCategory: Record<ExpenseCategory, number>;
  monthlyTotals: Array<{ month: string; amount: number }>;
  pendingCount: number;
  pendingAmount: number;
}

export interface CreateMileageTripInput {
  date: string;
  purpose: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  isRoundTrip: boolean;
  projectId?: string;
  notes?: string;
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

// Expense CRUD operations
export const expenseApi = {
  /**
   * List expenses with optional filters
   */
  list: async (filters?: ExpenseFilters): Promise<ExpenseListResponse> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    const query = params.toString();
    const url = query ? `/expenses?${query}` : '/expenses';
    return apiRequest(url);
  },

  /**
   * Get a single expense by ID
   */
  get: async (id: string): Promise<Expense> => {
    return apiRequest(`/expenses/${id}`);
  },

  /**
   * Create a new expense
   */
  create: async (input: CreateExpenseInput): Promise<Expense> => {
    if (input.receiptFile) {
      const formData = new FormData();
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && key !== 'receiptFile') {
          formData.append(key, String(value));
        }
      });
      formData.append('receipt', input.receiptFile);

      const response = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create expense');
      }

      return response.json() as Promise<Expense>;
    }

    return apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing expense
   */
  update: async (input: UpdateExpenseInput): Promise<Expense> => {
    const { id, ...data } = input;
    return apiRequest(`/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete an expense
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/expenses/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Bulk delete expenses
   */
  bulkDelete: async (ids: string[]): Promise<{ deleted: number }> => {
    return apiRequest('/expenses/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  /**
   * Get expense statistics
   */
  getStats: async (dateRange?: { start: string; end: string }): Promise<ExpenseStats> => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
    return apiRequest(`/expenses/stats${params}`);
  },

  /**
   * Export expenses
   */
  export: async (filters?: ExpenseFilters, format: 'csv' | 'pdf' = 'csv'): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await fetch(`${API_BASE}/expenses/export?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export expenses');
    }

    return response.blob();
  },

  /**
   * Categorize expenses automatically
   */
  autoCategorize: async (ids: string[]): Promise<{ updated: number }> => {
    return apiRequest('/expenses/auto-categorize', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },
};

// Receipt operations
export const receiptApi = {
  /**
   * List receipts
   */
  list: async (filters?: {
    status?: ReceiptStatus;
    unmatched?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ receipts: Receipt[]; total: number }> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const query = params.toString();
    const url = query ? `/receipts?${query}` : '/receipts';
    return apiRequest(url);
  },

  /**
   * Upload a receipt
   */
  upload: async (file: File): Promise<Receipt> => {
    const formData = new FormData();
    formData.append('receipt', file);

    const response = await fetch(`${API_BASE}/receipts`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload receipt');
    }

    return response.json() as Promise<Receipt>;
  },

  /**
   * Upload multiple receipts
   */
  uploadBatch: async (files: File[]): Promise<Receipt[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('receipts', file));

    const response = await fetch(`${API_BASE}/receipts/batch`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to upload receipts');
    }

    return response.json() as Promise<Receipt[]>;
  },

  /**
   * Get a single receipt
   */
  get: async (id: string): Promise<Receipt> => {
    return apiRequest(`/receipts/${id}`);
  },

  /**
   * Delete a receipt
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/receipts/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Create expense from receipt
   */
  createExpense: async (
    receiptId: string,
    overrides?: Partial<CreateExpenseInput>
  ): Promise<Expense> => {
    return apiRequest(`/receipts/${receiptId}/create-expense`, {
      method: 'POST',
      body: JSON.stringify(overrides || {}),
    });
  },

  /**
   * Match receipt to existing expense
   */
  matchToExpense: async (receiptId: string, expenseId: string): Promise<Receipt> => {
    return apiRequest(`/receipts/${receiptId}/match`, {
      method: 'POST',
      body: JSON.stringify({ expenseId }),
    });
  },

  /**
   * Retry OCR processing
   */
  retryOcr: async (id: string): Promise<Receipt> => {
    return apiRequest(`/receipts/${id}/retry-ocr`, {
      method: 'POST',
    });
  },
};

// Mileage operations
export const mileageApi = {
  /**
   * List mileage trips
   */
  list: async (filters?: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    trips: MileageTrip[];
    total: number;
    totalMiles: number;
    totalDeduction: number;
  }> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const query = params.toString();
    const url = query ? `/mileage?${query}` : '/mileage';
    return apiRequest(url);
  },

  /**
   * Get a single trip
   */
  get: async (id: string): Promise<MileageTrip> => {
    return apiRequest(`/mileage/${id}`);
  },

  /**
   * Create a mileage trip
   */
  create: async (input: CreateMileageTripInput): Promise<MileageTrip> => {
    return apiRequest('/mileage', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a mileage trip
   */
  update: async (id: string, input: Partial<CreateMileageTripInput>): Promise<MileageTrip> => {
    return apiRequest(`/mileage/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a mileage trip
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest(`/mileage/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get current IRS mileage rate
   */
  getRate: async (year?: number): Promise<{ rate: number; year: number }> => {
    const query = year ? `?year=${year}` : '';
    return apiRequest(`/mileage/rate${query}`);
  },

  /**
   * Get mileage summary
   */
  getSummary: async (dateRange?: {
    start: string;
    end: string;
  }): Promise<{
    totalMiles: number;
    totalDeduction: number;
    tripCount: number;
    byMonth: Array<{ month: string; miles: number; deduction: number }>;
  }> => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';
    return apiRequest(`/mileage/summary${params}`);
  },

  /**
   * Export mileage log
   */
  export: async (dateRange?: { start: string; end: string }): Promise<Blob> => {
    const params = dateRange ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : '';

    const response = await fetch(`${API_BASE}/mileage/export${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export mileage log');
    }

    return response.blob();
  },
};

export default {
  expenses: expenseApi,
  receipts: receiptApi,
  mileage: mileageApi,
};
