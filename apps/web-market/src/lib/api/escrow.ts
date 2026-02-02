/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Escrow API Client
 *
 * Functions for interacting with billing-svc escrow endpoints
 * Handles escrow funding, release, refund, and fee preview operations
 */

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ?? 'http://localhost:4000/api/billing';

// ============================================================================
// Types
// ============================================================================

export type EscrowTransactionType =
  | 'FUND'
  | 'RELEASE'
  | 'REFUND'
  | 'DISPUTE_HOLD'
  | 'DISPUTE_RELEASE';
export type EscrowTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface EscrowTransaction {
  id: string;
  contractId: string;
  milestoneId?: string | null;
  type: EscrowTransactionType;
  status: EscrowTransactionStatus;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  stripePaymentIntentId?: string | null;
  stripeTransferId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowBalance {
  id: string;
  contractId: string;
  totalFunded: number;
  totalReleased: number;
  totalRefunded: number;
  availableBalance: number;
  frozenBalance: number;
  isFrozen: boolean;
  frozenReason?: string | null;
  frozenAt?: string | null;
  updatedAt: string;
}

export interface FundEscrowRequest {
  contractId: string;
  milestoneId?: string;
  amount: number;
  paymentMethodId: string;
}

export interface FundEscrowResponse {
  transaction: EscrowTransaction;
  escrowBalance: EscrowBalance;
  clientSecret?: string;
}

export interface ReleaseEscrowRequest {
  contractId: string;
  milestoneId?: string;
  amount?: number;
}

export interface ReleaseEscrowResponse {
  transaction: EscrowTransaction;
  escrowBalance: EscrowBalance;
}

export interface RefundEscrowRequest {
  contractId: string;
  milestoneId?: string;
  amount?: number;
  reason: string;
}

export interface RefundEscrowResponse {
  transaction: EscrowTransaction;
  escrowBalance: EscrowBalance;
}

export interface EscrowFeePreviewRequest {
  amount: number;
  contractId?: string;
  platformFeePercent?: number;
  secureMode?: boolean;
  secureModeFeePercent?: number;
}

export interface EscrowFeePreview {
  grossAmount: number;
  platformFee: number;
  platformFeePercent: number;
  processingFee: number;
  processingFeePercent: number;
  secureModeEscrowFee: number;
  secureModeEscrowFeePercent: number;
  totalFees: number;
  netToFreelancer: number;
  totalClientCharge: number;
  breakdown: Array<{
    label: string;
    amount: number;
    description: string;
  }>;
}

export interface EscrowSummary {
  balance: EscrowBalance;
  transactions: EscrowTransaction[];
  milestoneEscrowStatus: Array<{
    milestoneId: string;
    funded: number;
    released: number;
    available: number;
    status: 'UNFUNDED' | 'PARTIALLY_FUNDED' | 'FUNDED' | 'RELEASED' | 'REFUNDED';
  }>;
}

export interface CompleteFundingRequest {
  paymentIntentId: string;
}

export interface CompleteFundingResponse {
  transaction: EscrowTransaction;
  escrowBalance: EscrowBalance;
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Create authorization header with user token
 */
function getAuthHeaders(): HeadersInit {
  // Get token from your auth system (e.g., NextAuth, custom auth)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const token =
    globalThis.window === undefined ? null : globalThis.window.localStorage?.getItem('authToken');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Generic API request handler
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BILLING_API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { error?: string }).error || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// Escrow API Functions
// ============================================================================

/**
 * Fund escrow for a contract or milestone
 * Creates a PaymentIntent with manual capture (hold)
 *
 * @param request - Fund escrow request with contract, milestone, amount, and payment method
 * @returns Transaction, updated balance, and client secret for Stripe confirmation
 */
export async function fundEscrow(request: FundEscrowRequest): Promise<FundEscrowResponse> {
  return apiRequest<FundEscrowResponse>('/escrow/fund', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Complete escrow funding after Stripe payment confirmation
 * Captures the held payment
 *
 * @param request - Payment intent ID to complete
 * @returns Transaction and updated balance
 */
export async function completeFunding(
  request: CompleteFundingRequest
): Promise<CompleteFundingResponse> {
  return apiRequest<CompleteFundingResponse>('/escrow/complete', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Release escrow funds to freelancer
 * Client approves milestone and releases payment
 *
 * @param request - Release escrow request with contract and optional milestone
 * @returns Transaction and updated balance
 */
export async function releaseEscrow(request: ReleaseEscrowRequest): Promise<ReleaseEscrowResponse> {
  return apiRequest<ReleaseEscrowResponse>('/escrow/release', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Refund escrow funds to client
 * Used for disputes, cancellations, or unused funds
 *
 * @param request - Refund escrow request with contract, amount, and reason
 * @returns Transaction and updated balance
 */
export async function refundEscrow(request: RefundEscrowRequest): Promise<RefundEscrowResponse> {
  return apiRequest<RefundEscrowResponse>('/escrow/refund', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get fee preview for an escrow amount
 * Shows breakdown of platform fees, processing fees, and net amounts
 *
 * @param request - Preview request with amount and optional contract
 * @returns Detailed fee breakdown
 */
export async function getEscrowFeePreview(
  request: EscrowFeePreviewRequest
): Promise<EscrowFeePreview> {
  return apiRequest<EscrowFeePreview>('/escrow/preview-fees', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get escrow summary for a contract
 * Returns balance, transaction history, and per-milestone status
 *
 * @param contractId - Contract ID to get escrow summary for
 * @returns Escrow summary with balance and transactions
 */
export async function getEscrowSummary(contractId: string): Promise<EscrowSummary> {
  return apiRequest<EscrowSummary>(`/escrow/${contractId}`);
}

/**
 * Get escrow balance for a contract
 * Quick check of current escrow state
 *
 * @param contractId - Contract ID to get balance for
 * @returns Current escrow balance
 */
export async function getEscrowBalance(contractId: string): Promise<EscrowBalance> {
  const summary = await getEscrowSummary(contractId);
  return summary.balance;
}

/**
 * Get escrow transactions for a contract
 *
 * @param contractId - Contract ID to get transactions for
 * @returns List of escrow transactions
 */
export async function getEscrowTransactions(contractId: string): Promise<EscrowTransaction[]> {
  const summary = await getEscrowSummary(contractId);
  return summary.transactions;
}

/**
 * Check if a milestone is funded
 *
 * @param contractId - Contract ID
 * @param milestoneId - Milestone ID to check
 * @returns Whether the milestone is funded
 */
export async function isMilestoneFunded(contractId: string, milestoneId: string): Promise<boolean> {
  const summary = await getEscrowSummary(contractId);
  const milestoneStatus = summary.milestoneEscrowStatus.find((m) => m.milestoneId === milestoneId);
  return milestoneStatus?.status === 'FUNDED' || milestoneStatus?.status === 'RELEASED';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency amount for display
 */
export function formatEscrowAmount(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100); // Amounts are in cents
}

/**
 * Get human-readable transaction type label
 */
export function getTransactionTypeLabel(type: EscrowTransactionType): string {
  const labels: Record<EscrowTransactionType, string> = {
    FUND: 'Escrow Funded',
    RELEASE: 'Payment Released',
    REFUND: 'Refund',
    DISPUTE_HOLD: 'Dispute Hold',
    DISPUTE_RELEASE: 'Dispute Released',
  };
  return labels[type];
}

/**
 * Get transaction status color for UI
 */
export function getTransactionStatusColor(status: EscrowTransactionStatus): string {
  const colors: Record<EscrowTransactionStatus, string> = {
    PENDING: 'yellow',
    PROCESSING: 'blue',
    COMPLETED: 'green',
    FAILED: 'red',
    CANCELLED: 'gray',
  };
  return colors[status];
}

/**
 * Calculate total escrow needed for milestones
 */
export function calculateTotalEscrowNeeded(
  milestones: Array<{ amount: number; status: string }>
): number {
  return milestones
    .filter((m) => m.status !== 'RELEASED' && m.status !== 'CANCELLED')
    .reduce((total, m) => total + m.amount, 0);
}
