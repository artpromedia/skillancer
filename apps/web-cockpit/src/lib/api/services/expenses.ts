/**
 * Expenses Service
 *
 * Type-safe API methods for expense tracking using the shared API client.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type ExpenseStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'reimbursed';

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  taxDeductible: boolean;
  isActive: boolean;
}

export interface ExpenseReceipt {
  id: string;
  expenseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  projectId?: string;
  clientId?: string;
  categoryId: string;
  category?: ExpenseCategory;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  amountInBaseCurrency?: number;
  date: string;
  status: ExpenseStatus;
  billable: boolean;
  reimbursable: boolean;
  taxDeductible: boolean;
  taxAmount?: number;
  receipts: ExpenseReceipt[];
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  tags: string[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reimbursedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCreate {
  projectId?: string;
  clientId?: string;
  categoryId: string;
  vendor: string;
  description: string;
  amount: number;
  currency?: string;
  date: string;
  billable?: boolean;
  reimbursable?: boolean;
  taxDeductible?: boolean;
  taxAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  tags?: string[];
}

export interface ExpenseUpdate {
  projectId?: string;
  clientId?: string;
  categoryId?: string;
  vendor?: string;
  description?: string;
  amount?: number;
  currency?: string;
  date?: string;
  billable?: boolean;
  reimbursable?: boolean;
  taxDeductible?: boolean;
  taxAmount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  tags?: string[];
}

export interface ExpenseFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  clientId?: string;
  categoryId?: string;
  status?: ExpenseStatus | ExpenseStatus[];
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  billable?: boolean;
  reimbursable?: boolean;
  search?: string;
  tags?: string[];
  sortBy?: 'date' | 'amount' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ExpenseSummary {
  totalExpenses: number;
  totalAmount: number;
  billableAmount: number;
  reimbursableAmount: number;
  taxDeductibleAmount: number;
  pendingReimbursement: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    amount: number;
  }>;
  byStatus: Record<ExpenseStatus, { count: number; amount: number }>;
  byMonth: Array<{
    month: string;
    count: number;
    amount: number;
  }>;
}

export interface ExpenseReport {
  period: {
    start: string;
    end: string;
  };
  totalExpenses: number;
  totalAmount: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>;
  byProject: Array<{
    projectId: string;
    projectName: string;
    amount: number;
  }>;
  byVendor: Array<{
    vendor: string;
    amount: number;
    count: number;
  }>;
  expenses: Expense[];
}

export interface MileageExpense {
  id: string;
  expenseId: string;
  distance: number;
  unit: 'miles' | 'kilometers';
  ratePerUnit: number;
  startLocation?: string;
  endLocation?: string;
  purpose?: string;
}

// =============================================================================
// Expenses API Service
// =============================================================================

export const expensesService = {
  // =============================================================================
  // Expenses CRUD
  // =============================================================================

  /**
   * List expenses with filters
   */
  async list(filters: ExpenseFilters = {}): Promise<PaginatedResponse<Expense>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, tags, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }
    if (tags?.length) {
      params.tags = tags.join(',');
    }

    return client.get<Expense[]>('/expenses', { params }) as Promise<PaginatedResponse<Expense>>;
  },

  /**
   * Get a single expense
   */
  async getById(id: string): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.get<Expense>(`/expenses/${id}`);
  },

  /**
   * Create an expense
   */
  async create(data: ExpenseCreate): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense, ExpenseCreate>('/expenses', data);
  },

  /**
   * Update an expense
   */
  async update(id: string, data: ExpenseUpdate): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.patch<Expense, ExpenseUpdate>(`/expenses/${id}`, data);
  },

  /**
   * Delete an expense
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/expenses/${id}`);
  },

  /**
   * Duplicate an expense
   */
  async duplicate(id: string): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense>(`/expenses/${id}/duplicate`);
  },

  // =============================================================================
  // Receipts
  // =============================================================================

  /**
   * Upload a receipt
   */
  async uploadReceipt(expenseId: string, file: File): Promise<ApiResponse<ExpenseReceipt>> {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('file', file);

    const axios = client.getAxiosInstance();
    const response = await axios.post(`/expenses/${expenseId}/receipts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete a receipt
   */
  async deleteReceipt(expenseId: string, receiptId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/expenses/${expenseId}/receipts/${receiptId}`);
  },

  /**
   * Scan receipt (OCR)
   */
  async scanReceipt(file: File): Promise<
    ApiResponse<{
      vendor?: string;
      amount?: number;
      date?: string;
      description?: string;
      confidence: number;
    }>
  > {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('file', file);

    const axios = client.getAxiosInstance();
    const response = await axios.post('/expenses/scan-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // =============================================================================
  // Approval Workflow
  // =============================================================================

  /**
   * Submit expense for approval
   */
  async submit(id: string): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense>(`/expenses/${id}/submit`);
  },

  /**
   * Approve an expense
   */
  async approve(id: string): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense>(`/expenses/${id}/approve`);
  },

  /**
   * Reject an expense
   */
  async reject(id: string, reason: string): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense>(`/expenses/${id}/reject`, { reason });
  },

  /**
   * Mark as reimbursed
   */
  async markReimbursed(id: string): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense>(`/expenses/${id}/reimburse`);
  },

  // =============================================================================
  // Categories
  // =============================================================================

  /**
   * List categories
   */
  async getCategories(): Promise<ApiResponse<ExpenseCategory[]>> {
    const client = getApiClient();
    return client.get<ExpenseCategory[]>('/expense-categories');
  },

  /**
   * Create a category
   */
  async createCategory(
    data: Omit<ExpenseCategory, 'id' | 'isActive'>
  ): Promise<ApiResponse<ExpenseCategory>> {
    const client = getApiClient();
    return client.post<ExpenseCategory>('/expense-categories', data);
  },

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    data: Partial<ExpenseCategory>
  ): Promise<ApiResponse<ExpenseCategory>> {
    const client = getApiClient();
    return client.patch<ExpenseCategory>(`/expense-categories/${id}`, data);
  },

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/expense-categories/${id}`);
  },

  // =============================================================================
  // Mileage
  // =============================================================================

  /**
   * Create mileage expense
   */
  async createMileageExpense(data: {
    date: string;
    distance: number;
    unit: 'miles' | 'kilometers';
    ratePerUnit?: number;
    startLocation?: string;
    endLocation?: string;
    purpose?: string;
    projectId?: string;
    clientId?: string;
  }): Promise<ApiResponse<Expense>> {
    const client = getApiClient();
    return client.post<Expense>('/expenses/mileage', data);
  },

  /**
   * Get mileage rate
   */
  async getMileageRate(): Promise<ApiResponse<{ rate: number; unit: 'miles' | 'kilometers' }>> {
    const client = getApiClient();
    return client.get<{ rate: number; unit: 'miles' | 'kilometers' }>('/expenses/mileage-rate');
  },

  // =============================================================================
  // Reports & Summary
  // =============================================================================

  /**
   * Get expense summary
   */
  async getSummary(params?: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
  }): Promise<ApiResponse<ExpenseSummary>> {
    const client = getApiClient();
    return client.get<ExpenseSummary>('/expenses/summary', { params });
  },

  /**
   * Generate expense report
   */
  async generateReport(params: {
    startDate: string;
    endDate: string;
    projectId?: string;
    clientId?: string;
    categoryIds?: string[];
  }): Promise<ApiResponse<ExpenseReport>> {
    const client = getApiClient();
    const { categoryIds, ...rest } = params;
    const queryParams: Record<string, unknown> = { ...rest };
    if (categoryIds?.length) {
      queryParams.categoryIds = categoryIds.join(',');
    }
    return client.get<ExpenseReport>('/expenses/report', { params: queryParams });
  },

  /**
   * Export expenses
   */
  async export(filters: ExpenseFilters & { format: 'csv' | 'xlsx' | 'pdf' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/expenses/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  // =============================================================================
  // Bulk Operations
  // =============================================================================

  /**
   * Bulk delete expenses
   */
  async bulkDelete(ids: string[]): Promise<ApiResponse<{ deleted: number }>> {
    const client = getApiClient();
    return client.post<{ deleted: number }>('/expenses/bulk-delete', { ids });
  },

  /**
   * Bulk submit for approval
   */
  async bulkSubmit(ids: string[]): Promise<ApiResponse<{ submitted: number }>> {
    const client = getApiClient();
    return client.post<{ submitted: number }>('/expenses/bulk-submit', { ids });
  },

  /**
   * Bulk approve
   */
  async bulkApprove(ids: string[]): Promise<ApiResponse<{ approved: number }>> {
    const client = getApiClient();
    return client.post<{ approved: number }>('/expenses/bulk-approve', { ids });
  },
};

export default expensesService;
