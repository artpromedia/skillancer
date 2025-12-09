/**
 * @module @skillancer/service-client/clients/billing-client
 * Billing service client for payments, escrow, and invoicing
 */

import { BaseServiceClient, type ServiceClientConfig, type Pagination } from '../base-client.js';

// ============================================================================
// Types
// ============================================================================

export interface Money {
  amount: number;
  currency: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card' | 'bank_account' | 'paypal' | 'crypto';
  isDefault: boolean;
  details: CardDetails | BankAccountDetails | PaypalDetails | CryptoDetails;
  createdAt: string;
}

export interface CardDetails {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  holderName?: string;
}

export interface BankAccountDetails {
  bankName: string;
  accountType: 'checking' | 'savings';
  last4: string;
  routingNumber?: string;
}

export interface PaypalDetails {
  email: string;
}

export interface CryptoDetails {
  network: string;
  address: string;
}

export interface Escrow {
  id: string;
  contractId: string;
  clientUserId: string;
  freelancerUserId: string;
  amount: Money;
  status: EscrowStatus;
  milestoneId?: string;
  fundedAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type EscrowStatus =
  | 'pending'
  | 'funded'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'cancelled';

export interface Payment {
  id: string;
  userId: string;
  type: 'escrow_funding' | 'escrow_release' | 'refund' | 'payout' | 'fee';
  amount: Money;
  status: PaymentStatus;
  paymentMethodId?: string;
  escrowId?: string;
  invoiceId?: string;
  externalId?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface Invoice {
  id: string;
  userId: string;
  contractId?: string;
  invoiceNumber: string;
  type: 'client' | 'freelancer';
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: Money;
  tax?: Money;
  total: Money;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
}

export interface Payout {
  id: string;
  freelancerUserId: string;
  amount: Money;
  status: PayoutStatus;
  paymentMethodId: string;
  escrowIds: string[];
  fees: Money;
  netAmount: Money;
  scheduledFor?: string;
  processedAt?: string;
  createdAt: string;
}

export type PayoutStatus = 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';

export interface Wallet {
  userId: string;
  balance: Money;
  pendingBalance: Money;
  availableBalance: Money;
  currency: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: Money;
  balance: Money;
  description: string;
  reference?: string;
  referenceType?: 'escrow' | 'payment' | 'payout' | 'refund' | 'fee';
  createdAt: string;
}

export interface CreateEscrowInput {
  contractId: string;
  amount: Money;
  milestoneId?: string;
}

export interface FundEscrowInput {
  paymentMethodId: string;
}

export interface CreatePaymentMethodInput {
  type: PaymentMethod['type'];
  details: Record<string, unknown>;
  isDefault?: boolean;
}

// ============================================================================
// Billing Service Client
// ============================================================================

export class BillingServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['BILLING_SERVICE_URL'] ?? 'http://billing-svc:3005',
      serviceName: 'billing-svc',
      timeout: 30000, // Longer timeout for payment operations
      retries: 1, // Fewer retries for financial operations
      circuitBreaker: {
        enabled: true,
        threshold: 3, // Lower threshold for billing
        resetTimeout: 60000, // Longer reset for billing
      },
      ...config,
    });
  }

  // ==========================================================================
  // Payment Methods
  // ==========================================================================

  /**
   * List payment methods for user
   */
  async listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return this.get<PaymentMethod[]>(`users/${userId}/payment-methods`);
  }

  /**
   * Get payment method
   */
  async getPaymentMethod(userId: string, methodId: string): Promise<PaymentMethod> {
    return this.get<PaymentMethod>(`users/${userId}/payment-methods/${methodId}`);
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(userId: string, data: CreatePaymentMethodInput): Promise<PaymentMethod> {
    return this.post<PaymentMethod>(`users/${userId}/payment-methods`, data);
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(userId: string, methodId: string): Promise<void> {
    await this.delete(`users/${userId}/payment-methods/${methodId}`);
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, methodId: string): Promise<PaymentMethod> {
    return this.post<PaymentMethod>(`users/${userId}/payment-methods/${methodId}/default`);
  }

  // ==========================================================================
  // Escrow
  // ==========================================================================

  /**
   * Get escrow by ID
   */
  async getEscrow(escrowId: string): Promise<Escrow> {
    return this.get<Escrow>(`escrows/${escrowId}`);
  }

  /**
   * Get escrow by contract
   */
  async getEscrowByContract(contractId: string): Promise<Escrow[]> {
    return this.get<Escrow[]>(`contracts/${contractId}/escrows`);
  }

  /**
   * Create escrow
   */
  async createEscrow(data: CreateEscrowInput): Promise<Escrow> {
    return this.post<Escrow>('escrows', data);
  }

  /**
   * Fund escrow
   */
  async fundEscrow(escrowId: string, data: FundEscrowInput): Promise<Escrow> {
    return this.post<Escrow>(`escrows/${escrowId}/fund`, data);
  }

  /**
   * Release escrow to freelancer
   */
  async releaseEscrow(escrowId: string): Promise<Escrow> {
    return this.post<Escrow>(`escrows/${escrowId}/release`);
  }

  /**
   * Request escrow refund
   */
  async refundEscrow(escrowId: string, reason?: string): Promise<Escrow> {
    return this.post<Escrow>(`escrows/${escrowId}/refund`, { reason });
  }

  /**
   * Cancel escrow (before funding)
   */
  async cancelEscrow(escrowId: string): Promise<Escrow> {
    return this.post<Escrow>(`escrows/${escrowId}/cancel`);
  }

  /**
   * Dispute escrow
   */
  async disputeEscrow(escrowId: string, reason: string): Promise<Escrow> {
    return this.post<Escrow>(`escrows/${escrowId}/dispute`, { reason });
  }

  // ==========================================================================
  // Payments
  // ==========================================================================

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment> {
    return this.get<Payment>(`payments/${paymentId}`);
  }

  /**
   * List payments for user
   */
  async listPayments(
    userId: string,
    params?: {
      type?: Payment['type'];
      status?: PaymentStatus;
      startDate?: string;
      endDate?: string;
      pagination?: Pagination;
    }
  ): Promise<{ payments: Payment[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.type) searchParams['type'] = params.type;
    if (params?.status) searchParams['status'] = params.status;
    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ payments: Payment[]; total: number }>(`users/${userId}/payments`, {
      searchParams,
    });
  }

  /**
   * Process payment
   */
  async processPayment(data: {
    userId: string;
    amount: Money;
    paymentMethodId: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Payment> {
    return this.post<Payment>('payments', data);
  }

  // ==========================================================================
  // Invoices
  // ==========================================================================

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.get<Invoice>(`invoices/${invoiceId}`);
  }

  /**
   * List invoices for user
   */
  async listInvoices(
    userId: string,
    params?: {
      status?: InvoiceStatus;
      type?: Invoice['type'];
      startDate?: string;
      endDate?: string;
      pagination?: Pagination;
    }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.status) searchParams['status'] = params.status;
    if (params?.type) searchParams['type'] = params.type;
    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ invoices: Invoice[]; total: number }>(`users/${userId}/invoices`, {
      searchParams,
    });
  }

  /**
   * Get invoice PDF URL
   */
  async getInvoicePdf(invoiceId: string): Promise<{ url: string; expiresAt: string }> {
    return this.get(`invoices/${invoiceId}/pdf`);
  }

  // ==========================================================================
  // Payouts
  // ==========================================================================

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string): Promise<Payout> {
    return this.get<Payout>(`payouts/${payoutId}`);
  }

  /**
   * List payouts for freelancer
   */
  async listPayouts(
    freelancerUserId: string,
    params?: {
      status?: PayoutStatus;
      startDate?: string;
      endDate?: string;
      pagination?: Pagination;
    }
  ): Promise<{ payouts: Payout[]; total: number }> {
    const searchParams: Record<string, string> = {
      freelancerUserId,
    };

    if (params?.status) searchParams['status'] = params.status;
    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ payouts: Payout[]; total: number }>('payouts', { searchParams });
  }

  /**
   * Request payout
   */
  async requestPayout(freelancerUserId: string, paymentMethodId: string): Promise<Payout> {
    return this.post<Payout>('payouts', {
      freelancerUserId,
      paymentMethodId,
    });
  }

  // ==========================================================================
  // Wallet
  // ==========================================================================

  /**
   * Get wallet for user
   */
  async getWallet(userId: string): Promise<Wallet> {
    return this.get<Wallet>(`users/${userId}/wallet`);
  }

  /**
   * Get wallet transactions
   */
  async getWalletTransactions(
    userId: string,
    params?: {
      type?: Transaction['type'];
      startDate?: string;
      endDate?: string;
      pagination?: Pagination;
    }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.type) searchParams['type'] = params.type;
    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ transactions: Transaction[]; total: number }>(
      `users/${userId}/wallet/transactions`,
      { searchParams }
    );
  }

  // ==========================================================================
  // Fee Calculation
  // ==========================================================================

  /**
   * Calculate platform fees
   */
  async calculateFees(amount: Money): Promise<{
    amount: Money;
    platformFee: Money;
    processingFee: Money;
    totalFees: Money;
    netAmount: Money;
  }> {
    return this.post('fees/calculate', amount);
  }

  // ==========================================================================
  // Reporting
  // ==========================================================================

  /**
   * Get earnings summary
   */
  async getEarningsSummary(
    freelancerUserId: string,
    params?: {
      period?: 'week' | 'month' | 'quarter' | 'year';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    totalEarnings: Money;
    totalFees: Money;
    netEarnings: Money;
    pendingPayouts: Money;
    completedPayouts: Money;
    breakdown?: Array<{
      period: string;
      earnings: Money;
      fees: Money;
      net: Money;
    }>;
  }> {
    const searchParams: Record<string, string> = {};

    if (params?.period) searchParams['period'] = params.period;
    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;

    return this.get(`users/${freelancerUserId}/earnings`, { searchParams });
  }

  /**
   * Get spending summary
   */
  async getSpendingSummary(
    clientUserId: string,
    params?: {
      period?: 'week' | 'month' | 'quarter' | 'year';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    totalSpent: Money;
    totalFees: Money;
    escrowBalance: Money;
    breakdown?: Array<{
      period: string;
      spent: Money;
      fees: Money;
    }>;
  }> {
    const searchParams: Record<string, string> = {};

    if (params?.period) searchParams['period'] = params.period;
    if (params?.startDate) searchParams['startDate'] = params.startDate;
    if (params?.endDate) searchParams['endDate'] = params.endDate;

    return this.get(`users/${clientUserId}/spending`, { searchParams });
  }
}

// Export singleton instance
export const billingClient = new BillingServiceClient();
