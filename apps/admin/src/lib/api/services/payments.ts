/**
 * Payments Service
 *
 * Type-safe API methods for payment management in the admin panel.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'disputed'
  | 'cancelled';
export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'paypal'
  | 'stripe'
  | 'crypto'
  | 'escrow';
export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'on_hold'
  | 'cancelled';

export interface Payment {
  id: string;
  transactionId: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
  projectId?: string;
  projectName?: string;
  milestoneId?: string;
  milestoneName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  type: 'project_payment' | 'subscription' | 'fee' | 'refund' | 'payout';
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  exchangeRate?: number;
  externalId?: string;
  externalStatus?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  type?: Payment['type'] | Payment['type'][];
  method?: PaymentMethod | PaymentMethod[];
  status?: PaymentStatus | PaymentStatus[];
  userId?: string;
  projectId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: 'createdAt' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface Payout {
  id: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
  status: PayoutStatus;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  method: 'bank_transfer' | 'paypal' | 'payoneer' | 'wise' | 'crypto';
  destination: {
    type: string;
    identifier: string;
    name?: string;
    bankName?: string;
    last4?: string;
  };
  batchId?: string;
  externalId?: string;
  failureReason?: string;
  holdReason?: string;
  releasedBy?: string;
  releasedAt?: string;
  processedAt?: string;
  estimatedArrival?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutFilters {
  page?: number;
  limit?: number;
  status?: PayoutStatus | PayoutStatus[];
  method?: Payout['method'] | Payout['method'][];
  userId?: string;
  batchId?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: 'createdAt' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface Refund {
  id: string;
  paymentId: string;
  payment?: Payment;
  type: 'full' | 'partial';
  amount: number;
  currency: string;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedBy?: string;
  externalId?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

export interface RefundFilters {
  page?: number;
  limit?: number;
  status?: Refund['status'] | Refund['status'][];
  type?: 'full' | 'partial';
  paymentId?: string;
  userId?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface PaymentStats {
  totalVolume: number;
  totalTransactions: number;
  totalFees: number;
  averageTransaction: number;
  byStatus: Record<PaymentStatus, { count: number; amount: number }>;
  byMethod: Record<PaymentMethod, { count: number; amount: number }>;
  byType: Record<Payment['type'], { count: number; amount: number }>;
  dailyVolume: Array<{ date: string; amount: number; count: number }>;
  conversionRate: number;
  failureRate: number;
}

export interface PayoutStats {
  totalPaid: number;
  pendingAmount: number;
  onHoldAmount: number;
  byStatus: Record<PayoutStatus, { count: number; amount: number }>;
  byMethod: Record<string, { count: number; amount: number }>;
  averageProcessingTime: number;
}

// =============================================================================
// Payments API Service
// =============================================================================

export const paymentsService = {
  // =============================================================================
  // Payments
  // =============================================================================

  /**
   * List payments
   */
  async listPayments(filters: PaymentFilters = {}): Promise<PaginatedResponse<Payment>> {
    const client = getApiClient();
    const { page = 1, limit = 20, type, method, status, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (type) {
      params.type = Array.isArray(type) ? type.join(',') : type;
    }
    if (method) {
      params.method = Array.isArray(method) ? method.join(',') : method;
    }
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<Payment[]>('/admin/payments', { params }) as Promise<
      PaginatedResponse<Payment>
    >;
  },

  /**
   * Get payment by ID
   */
  async getPayment(id: string): Promise<ApiResponse<Payment>> {
    const client = getApiClient();
    return client.get<Payment>(`/admin/payments/${id}`);
  },

  /**
   * Get payment by transaction ID
   */
  async getByTransactionId(transactionId: string): Promise<ApiResponse<Payment>> {
    const client = getApiClient();
    return client.get<Payment>(`/admin/payments/transaction/${transactionId}`);
  },

  /**
   * Retry failed payment
   */
  async retryPayment(id: string): Promise<ApiResponse<Payment>> {
    const client = getApiClient();
    return client.post<Payment>(`/admin/payments/${id}/retry`);
  },

  /**
   * Cancel payment
   */
  async cancelPayment(id: string, reason: string): Promise<ApiResponse<Payment>> {
    const client = getApiClient();
    return client.post<Payment>(`/admin/payments/${id}/cancel`, { reason });
  },

  /**
   * Mark payment as completed (manual)
   */
  async markPaymentCompleted(
    id: string,
    data: { externalId?: string; notes?: string }
  ): Promise<ApiResponse<Payment>> {
    const client = getApiClient();
    return client.post<Payment>(`/admin/payments/${id}/complete`, data);
  },

  // =============================================================================
  // Refunds
  // =============================================================================

  /**
   * List refunds
   */
  async listRefunds(filters: RefundFilters = {}): Promise<PaginatedResponse<Refund>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<Refund[]>('/admin/refunds', { params }) as Promise<PaginatedResponse<Refund>>;
  },

  /**
   * Get refund by ID
   */
  async getRefund(id: string): Promise<ApiResponse<Refund>> {
    const client = getApiClient();
    return client.get<Refund>(`/admin/refunds/${id}`);
  },

  /**
   * Create refund
   */
  async createRefund(
    paymentId: string,
    data: { type: 'full' | 'partial'; amount?: number; reason: string }
  ): Promise<ApiResponse<Refund>> {
    const client = getApiClient();
    return client.post<Refund>('/admin/refunds', { paymentId, ...data });
  },

  /**
   * Process refund
   */
  async processRefund(id: string): Promise<ApiResponse<Refund>> {
    const client = getApiClient();
    return client.post<Refund>(`/admin/refunds/${id}/process`);
  },

  /**
   * Cancel refund
   */
  async cancelRefund(id: string, reason: string): Promise<ApiResponse<Refund>> {
    const client = getApiClient();
    return client.post<Refund>(`/admin/refunds/${id}/cancel`, { reason });
  },

  // =============================================================================
  // Payouts
  // =============================================================================

  /**
   * List payouts
   */
  async listPayouts(filters: PayoutFilters = {}): Promise<PaginatedResponse<Payout>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, method, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }
    if (method) {
      params.method = Array.isArray(method) ? method.join(',') : method;
    }

    return client.get<Payout[]>('/admin/payouts', { params }) as Promise<PaginatedResponse<Payout>>;
  },

  /**
   * Get payout by ID
   */
  async getPayout(id: string): Promise<ApiResponse<Payout>> {
    const client = getApiClient();
    return client.get<Payout>(`/admin/payouts/${id}`);
  },

  /**
   * Approve payout
   */
  async approvePayout(id: string): Promise<ApiResponse<Payout>> {
    const client = getApiClient();
    return client.post<Payout>(`/admin/payouts/${id}/approve`);
  },

  /**
   * Reject payout
   */
  async rejectPayout(id: string, reason: string): Promise<ApiResponse<Payout>> {
    const client = getApiClient();
    return client.post<Payout>(`/admin/payouts/${id}/reject`, { reason });
  },

  /**
   * Put payout on hold
   */
  async holdPayout(id: string, reason: string): Promise<ApiResponse<Payout>> {
    const client = getApiClient();
    return client.post<Payout>(`/admin/payouts/${id}/hold`, { reason });
  },

  /**
   * Release payout from hold
   */
  async releasePayout(id: string): Promise<ApiResponse<Payout>> {
    const client = getApiClient();
    return client.post<Payout>(`/admin/payouts/${id}/release`);
  },

  /**
   * Process payout manually
   */
  async processPayout(
    id: string,
    data: { externalId?: string; notes?: string }
  ): Promise<ApiResponse<Payout>> {
    const client = getApiClient();
    return client.post<Payout>(`/admin/payouts/${id}/process`, data);
  },

  /**
   * Bulk approve payouts
   */
  async bulkApprovePayouts(ids: string[]): Promise<ApiResponse<{ approved: number }>> {
    const client = getApiClient();
    return client.post<{ approved: number }>('/admin/payouts/bulk-approve', { ids });
  },

  /**
   * Bulk process payouts
   */
  async bulkProcessPayouts(
    ids: string[]
  ): Promise<ApiResponse<{ processed: number; failed: number }>> {
    const client = getApiClient();
    return client.post<{ processed: number; failed: number }>('/admin/payouts/bulk-process', {
      ids,
    });
  },

  // =============================================================================
  // Statistics
  // =============================================================================

  /**
   * Get payment statistics
   */
  async getPaymentStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<PaymentStats>> {
    const client = getApiClient();
    return client.get<PaymentStats>('/admin/payments/stats', { params });
  },

  /**
   * Get payout statistics
   */
  async getPayoutStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<PayoutStats>> {
    const client = getApiClient();
    return client.get<PayoutStats>('/admin/payouts/stats', { params });
  },

  /**
   * Get revenue report
   */
  async getRevenueReport(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<
    ApiResponse<{
      totalRevenue: number;
      totalFees: number;
      byPeriod: Array<{
        period: string;
        revenue: number;
        fees: number;
        transactions: number;
      }>;
      byType: Record<string, number>;
    }>
  > {
    const client = getApiClient();
    return client.get('/admin/payments/reports/revenue', { params });
  },

  // =============================================================================
  // Export
  // =============================================================================

  /**
   * Export payments
   */
  async exportPayments(filters: PaymentFilters & { format: 'csv' | 'xlsx' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/payments/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Export payouts
   */
  async exportPayouts(filters: PayoutFilters & { format: 'csv' | 'xlsx' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/payouts/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  // =============================================================================
  // Escrow
  // =============================================================================

  /**
   * Get escrow balance
   */
  async getEscrowBalance(): Promise<
    ApiResponse<{
      total: number;
      byCurrency: Record<string, number>;
      pendingRelease: number;
      disputed: number;
    }>
  > {
    const client = getApiClient();
    return client.get('/admin/payments/escrow/balance');
  },

  /**
   * Release escrow funds
   */
  async releaseEscrow(
    milestoneId: string,
    data?: { amount?: number; notes?: string }
  ): Promise<ApiResponse<Payment>> {
    const client = getApiClient();
    return client.post<Payment>(`/admin/payments/escrow/${milestoneId}/release`, data);
  },
};

export default paymentsService;
