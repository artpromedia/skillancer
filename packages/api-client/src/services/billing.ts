/**
 * @module @skillancer/api-client/services/billing
 * Billing service client for payments, invoices, and escrow
 */

import type { HttpClient, ApiResponse } from '../http/base-client';

// =============================================================================
// Types
// =============================================================================

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
    accountType: 'checking' | 'savings';
  };
  paypal?: {
    email: string;
  };
  createdAt: string;
}

export interface AddCardRequest {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
  setAsDefault?: boolean;
}

export interface AddBankAccountRequest {
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
  accountHolderName: string;
  setAsDefault?: boolean;
}

export interface Wallet {
  balance: number;
  pendingBalance: number;
  currency: string;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  metadata?: {
    contractId?: string;
    invoiceId?: string;
    milestoneId?: string;
    withdrawalId?: string;
  };
  fee?: number;
  net?: number;
  createdAt: string;
  completedAt?: string;
}

export type TransactionType =
  | 'payment'
  | 'escrow_deposit'
  | 'escrow_release'
  | 'withdrawal'
  | 'refund'
  | 'fee'
  | 'bonus'
  | 'adjustment';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contractId: string;
  contract: {
    id: string;
    title: string;
  };
  clientId: string;
  client: {
    id: string;
    displayName: string;
  };
  freelancerId: string;
  freelancer: {
    id: string;
    displayName: string;
  };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  fees: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  type: 'hourly' | 'fixed' | 'milestone' | 'bonus' | 'expense';
}

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'disputed';

export interface CreateInvoiceRequest {
  contractId: string;
  lineItems: Omit<InvoiceLineItem, 'amount'>[];
  dueDate: string;
  notes?: string;
}

export interface Escrow {
  id: string;
  contractId: string;
  milestoneId?: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  fundedAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  createdAt: string;
}

export type EscrowStatus = 'pending' | 'funded' | 'released' | 'refunded' | 'disputed';

export interface WithdrawalRequest {
  amount: number;
  paymentMethodId: string;
  notes?: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  paymentMethodId: string;
  paymentMethod: PaymentMethod;
  status: WithdrawalStatus;
  processedAt?: string;
  failureReason?: string;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    proposals?: number;
    connects?: number;
    featuredProfile?: boolean;
    prioritySupport?: boolean;
  };
}

export interface Subscription {
  id: string;
  planId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing';

// =============================================================================
// Billing Service Client
// =============================================================================

export class BillingServiceClient {
  private httpClient: HttpClient;
  private basePath: string;

  constructor(httpClient: HttpClient, basePath: string = '/billing') {
    this.httpClient = httpClient;
    this.basePath = basePath;
  }

  // ===========================================================================
  // Payment Methods
  // ===========================================================================

  /**
   * Get user's payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return this.httpClient.get<PaymentMethod[]>(`${this.basePath}/payment-methods`);
  }

  /**
   * Add credit/debit card
   */
  async addCard(data: AddCardRequest): Promise<PaymentMethod> {
    return this.httpClient.post<PaymentMethod>(`${this.basePath}/payment-methods/card`, data);
  }

  /**
   * Add bank account
   */
  async addBankAccount(data: AddBankAccountRequest): Promise<PaymentMethod> {
    return this.httpClient.post<PaymentMethod>(`${this.basePath}/payment-methods/bank`, data);
  }

  /**
   * Connect PayPal account
   */
  async connectPayPal(): Promise<{ authorizationUrl: string }> {
    return this.httpClient.post<{ authorizationUrl: string }>(
      `${this.basePath}/payment-methods/paypal/connect`
    );
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/payment-methods/${paymentMethodId}/default`
    );
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/payment-methods/${paymentMethodId}`
    );
  }

  // ===========================================================================
  // Wallet
  // ===========================================================================

  /**
   * Get wallet balance
   */
  async getWallet(): Promise<Wallet> {
    return this.httpClient.get<Wallet>(`${this.basePath}/wallet`);
  }

  /**
   * Get transaction history
   */
  async getTransactions(params?: {
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ transactions: Transaction[]; total: number }>> {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryString.append(key, String(value));
      });
    }

    return this.httpClient.get<ApiResponse<{ transactions: Transaction[]; total: number }>>(
      `${this.basePath}/transactions?${queryString.toString()}`
    );
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    return this.httpClient.get<Transaction>(`${this.basePath}/transactions/${transactionId}`);
  }

  // ===========================================================================
  // Withdrawals
  // ===========================================================================

  /**
   * Request withdrawal
   */
  async requestWithdrawal(data: WithdrawalRequest): Promise<Withdrawal> {
    return this.httpClient.post<Withdrawal>(`${this.basePath}/withdrawals`, data);
  }

  /**
   * Get withdrawals
   */
  async getWithdrawals(params?: {
    status?: WithdrawalStatus;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ withdrawals: Withdrawal[]; total: number }>> {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryString.append(key, String(value));
      });
    }

    return this.httpClient.get<ApiResponse<{ withdrawals: Withdrawal[]; total: number }>>(
      `${this.basePath}/withdrawals?${queryString.toString()}`
    );
  }

  /**
   * Cancel pending withdrawal
   */
  async cancelWithdrawal(withdrawalId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(
      `${this.basePath}/withdrawals/${withdrawalId}/cancel`
    );
  }

  // ===========================================================================
  // Invoices
  // ===========================================================================

  /**
   * Get invoices
   */
  async getInvoices(params?: {
    contractId?: string;
    status?: InvoiceStatus;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ invoices: Invoice[]; total: number }>> {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryString.append(key, String(value));
      });
    }

    return this.httpClient.get<ApiResponse<{ invoices: Invoice[]; total: number }>>(
      `${this.basePath}/invoices?${queryString.toString()}`
    );
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    return this.httpClient.get<Invoice>(`${this.basePath}/invoices/${invoiceId}`);
  }

  /**
   * Create invoice (freelancer)
   */
  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    return this.httpClient.post<Invoice>(`${this.basePath}/invoices`, data);
  }

  /**
   * Pay invoice (client)
   */
  async payInvoice(
    invoiceId: string,
    paymentMethodId?: string
  ): Promise<ApiResponse<{ transactionId: string }>> {
    return this.httpClient.post<ApiResponse<{ transactionId: string }>>(
      `${this.basePath}/invoices/${invoiceId}/pay`,
      { paymentMethodId }
    );
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoice(invoiceId: string): Promise<Blob> {
    const response = await this.httpClient
      .getAxiosInstance()
      .get(`${this.basePath}/invoices/${invoiceId}/download`, {
        responseType: 'blob',
      });
    return response.data;
  }

  // ===========================================================================
  // Escrow
  // ===========================================================================

  /**
   * Get escrow for contract
   */
  async getContractEscrow(contractId: string): Promise<Escrow[]> {
    return this.httpClient.get<Escrow[]>(`${this.basePath}/escrow/contract/${contractId}`);
  }

  /**
   * Fund escrow (client)
   */
  async fundEscrow(
    contractId: string,
    milestoneId?: string,
    paymentMethodId?: string
  ): Promise<Escrow> {
    return this.httpClient.post<Escrow>(`${this.basePath}/escrow/fund`, {
      contractId,
      milestoneId,
      paymentMethodId,
    });
  }

  /**
   * Release escrow (client)
   */
  async releaseEscrow(escrowId: string): Promise<Escrow> {
    return this.httpClient.post<Escrow>(`${this.basePath}/escrow/${escrowId}/release`);
  }

  /**
   * Request escrow refund (client)
   */
  async requestEscrowRefund(escrowId: string, reason: string): Promise<Escrow> {
    return this.httpClient.post<Escrow>(`${this.basePath}/escrow/${escrowId}/refund`, { reason });
  }

  // ===========================================================================
  // Subscriptions
  // ===========================================================================

  /**
   * Get available subscription plans
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.httpClient.get<SubscriptionPlan[]>(`${this.basePath}/subscriptions/plans`);
  }

  /**
   * Get current subscription
   */
  async getCurrentSubscription(): Promise<Subscription | null> {
    return this.httpClient.get<Subscription | null>(`${this.basePath}/subscriptions/current`);
  }

  /**
   * Subscribe to plan
   */
  async subscribe(planId: string, paymentMethodId?: string): Promise<Subscription> {
    return this.httpClient.post<Subscription>(`${this.basePath}/subscriptions`, {
      planId,
      paymentMethodId,
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(immediately?: boolean): Promise<Subscription> {
    return this.httpClient.post<Subscription>(`${this.basePath}/subscriptions/cancel`, {
      immediately,
    });
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(): Promise<Subscription> {
    return this.httpClient.post<Subscription>(`${this.basePath}/subscriptions/reactivate`);
  }

  // ===========================================================================
  // Billing History
  // ===========================================================================

  /**
   * Get billing history/receipts
   */
  async getBillingHistory(params?: { year?: number; page?: number; limit?: number }): Promise<
    ApiResponse<{
      receipts: Array<{
        id: string;
        type: string;
        amount: number;
        currency: string;
        description: string;
        downloadUrl: string;
        createdAt: string;
      }>;
      total: number;
    }>
  > {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryString.append(key, String(value));
      });
    }

    return this.httpClient.get<
      ApiResponse<{
        receipts: Array<{
          id: string;
          type: string;
          amount: number;
          currency: string;
          description: string;
          downloadUrl: string;
          createdAt: string;
        }>;
        total: number;
      }>
    >(`${this.basePath}/history?${queryString.toString()}`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBillingServiceClient(
  httpClient: HttpClient,
  basePath?: string
): BillingServiceClient {
  return new BillingServiceClient(httpClient, basePath);
}
