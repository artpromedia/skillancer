/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Payment Methods API Client
 *
 * Functions for interacting with billing-svc for payment method management
 */

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ?? 'http://localhost:4000/api/billing';

// ============================================================================
// Types
// ============================================================================

export type PaymentMethodType = 'card' | 'us_bank_account' | 'sepa_debit';
export type PaymentMethodStatus = 'ACTIVE' | 'EXPIRED' | 'INVALID' | 'REMOVED';

export interface PaymentMethodCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding?: string;
  country?: string;
}

export interface PaymentMethodBankAccount {
  bankName: string | null;
  last4: string;
  accountHolderType?: string;
  accountType?: string;
}

export interface PaymentMethodBillingDetails {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: {
    city?: string | null;
    country?: string | null;
    line1?: string | null;
    line2?: string | null;
    postal_code?: string | null;
    state?: string | null;
  } | null;
}

export interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  card?: PaymentMethodCard;
  bankAccount?: PaymentMethodBankAccount;
  billingDetails?: PaymentMethodBillingDetails;
  createdAt: string;
  status?: PaymentMethodStatus;
}

export interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

export interface FeePreview {
  grossAmount: number;
  platformFee: number;
  platformFeePercent: number;
  processingFee: number;
  totalCharge: number;
  breakdown: Array<{
    label: string;
    amount: number;
    description: string;
  }>;
}

export interface ChargeResult {
  paymentIntentId: string;
  status: string;
  amount: number;
  currency: string;
  requiresAction: boolean;
  clientSecret?: string;
  nextAction?: {
    type: string;
    redirectToUrl?: string;
  };
  chargeId?: string;
  receiptUrl?: string;
}

export interface ChargeRequest {
  amount: number;
  currency?: string;
  paymentMethodId: string;
  description?: string;
  metadata?: Record<string, string>;
  contractId?: string;
  milestoneId?: string;
  transferDestination?: string;
  applicationFeePercent?: number;
  captureMethod?: 'automatic' | 'manual';
  setupFutureUsage?: 'off_session' | 'on_session';
  idempotencyKey?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      code?: string;
    };
    throw new Error(error.message ?? error.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// ============================================================================
// Payment Methods API
// ============================================================================

/**
 * Get all payment methods for the authenticated user
 */
export async function getPaymentMethods(
  type?: 'card' | 'bank_account' | 'all'
): Promise<PaymentMethod[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (type) {
    params.set('type', type);
  }

  const url = `${BILLING_API_URL}/payment-methods${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const data = await handleResponse<{ paymentMethods: PaymentMethod[] }>(response);
  return data.paymentMethods;
}

/**
 * Get a specific payment method by ID
 */
export async function getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payment-methods/${paymentMethodId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<PaymentMethod>(response);
}

/**
 * Add a new payment method using Stripe PaymentMethod ID
 */
export async function addPaymentMethod(
  paymentMethodId: string,
  setAsDefault = false
): Promise<PaymentMethod> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payment-methods`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ paymentMethodId, setAsDefault }),
  });

  return handleResponse<PaymentMethod>(response);
}

/**
 * Set a payment method as the default
 */
export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payment-methods/${paymentMethodId}/default`, {
    method: 'PUT',
    headers,
    credentials: 'include',
  });

  return handleResponse<PaymentMethod>(response);
}

/**
 * Remove a payment method
 */
export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payment-methods/${paymentMethodId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  await handleResponse<{ success: boolean }>(response);
}

/**
 * Create a SetupIntent for securely collecting payment method details
 */
export async function createSetupIntent(
  type: PaymentMethodType = 'card',
  metadata?: Record<string, string>
): Promise<SetupIntentResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/payment-methods/setup-intent`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ type, metadata }),
  });

  return handleResponse<SetupIntentResponse>(response);
}

// ============================================================================
// Charges API
// ============================================================================

/**
 * Create a payment charge
 */
export async function createCharge(params: ChargeRequest): Promise<ChargeResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/charges`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(params),
  });

  return handleResponse<ChargeResult>(response);
}

/**
 * Confirm a payment that requires action (3D Secure)
 */
export async function confirmPayment(
  paymentIntentId: string,
  paymentMethodId?: string,
  returnUrl?: string
): Promise<ChargeResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/charges/${paymentIntentId}/confirm`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ paymentMethodId, returnUrl }),
  });

  return handleResponse<ChargeResult>(response);
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentIntentId: string): Promise<ChargeResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/charges/${paymentIntentId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  return handleResponse<ChargeResult>(response);
}

/**
 * Capture an authorized payment
 */
export async function capturePayment(
  paymentIntentId: string,
  amountToCapture?: number
): Promise<ChargeResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/charges/${paymentIntentId}/capture`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ amountToCapture }),
  });

  return handleResponse<ChargeResult>(response);
}

/**
 * Refund a payment
 */
export async function refundPayment(
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<{ refundId: string; status: string; amount: number; currency: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/charges/${paymentIntentId}/refund`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ amount, reason }),
  });

  return handleResponse(response);
}

/**
 * Preview fees for an amount
 */
export async function previewFees(
  amount: number,
  applicationFeePercent?: number
): Promise<FeePreview> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BILLING_API_URL}/charges/fee-preview`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ amount, applicationFeePercent }),
  });

  return handleResponse<FeePreview>(response);
}
