/**
 * Payments API Hooks
 *
 * React Query hooks for payment-related operations including
 * Stripe Connect, payment methods, charges, and escrow.
 *
 * @module hooks/api/use-payments
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// =============================================================================
// Constants
// =============================================================================

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ?? 'http://localhost:4000/api/billing';

// =============================================================================
// Types
// =============================================================================

export type ConnectAccountStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'ONBOARDING'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'DISABLED';

export interface ConnectStatus {
  status: ConnectAccountStatus;
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  externalAccount: {
    type: string | null;
    last4: string | null;
    bank: string | null;
  } | null;
  payoutSchedule: {
    interval: string;
    delayDays: number;
  } | null;
}

export interface CreateConnectAccountResponse {
  success: boolean;
  accountId: string;
  onboardingUrl: string;
}

export interface ConnectDashboardResponse {
  success: boolean;
  url: string;
}

export interface DisconnectAccountResponse {
  success: boolean;
  message?: string;
}

export type PaymentMethodType = 'card' | 'us_bank_account' | 'sepa_debit';

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

export interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  card?: PaymentMethodCard;
  bankAccount?: PaymentMethodBankAccount;
  billingDetails?: {
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
  };
  createdAt: string;
  status?: string;
}

export interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
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

export type EscrowStatusValue =
  | 'PENDING_DEPOSIT'
  | 'FUNDED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'CANCELED';

export interface EscrowStatusResponse {
  id: string;
  status: EscrowStatusValue;
  totalAmount: number;
  fundedAmount: number;
  releasedAmount: number;
  availableBalance: number;
  platformFee: number;
  currency: string;
  milestones: Array<{
    id: string;
    name: string;
    amount: number;
    status: string;
    order: number;
    dueDate: string | null;
  }>;
  releases: Array<{
    id: string;
    grossAmount: number;
    netAmount: number;
    platformFee: number;
    approvedBy: string;
    approvalType: string;
    createdAt: string;
  }>;
  fundedAt: string | null;
  lastReleaseAt: string | null;
}

// =============================================================================
// API Helpers
// =============================================================================

function getAuthHeaders(): Record<string, string> {
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

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { message?: string; error?: string }).message ??
      (errorData as { error?: string }).error ??
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchConnectStatus(): Promise<ConnectStatus> {
  return apiFetch<ConnectStatus>(`${BILLING_API_URL}/connect/status`);
}

async function postCreateConnectAccount(): Promise<CreateConnectAccountResponse> {
  return apiFetch<CreateConnectAccountResponse>(`${BILLING_API_URL}/connect/account`, {
    method: 'POST',
  });
}

async function fetchConnectDashboard(): Promise<ConnectDashboardResponse> {
  return apiFetch<ConnectDashboardResponse>(`${BILLING_API_URL}/connect/dashboard`);
}

async function deleteConnectAccount(): Promise<DisconnectAccountResponse> {
  return apiFetch<DisconnectAccountResponse>(`${BILLING_API_URL}/connect/account`, {
    method: 'DELETE',
  });
}

async function fetchPaymentMethods(
  type?: 'card' | 'bank_account' | 'all'
): Promise<PaymentMethod[]> {
  const params = new URLSearchParams();
  if (type) {
    params.set('type', type);
  }
  const qs = params.toString();
  const url = `${BILLING_API_URL}/payment-methods${qs ? `?${qs}` : ''}`;
  const data = await apiFetch<{ paymentMethods: PaymentMethod[] }>(url);
  return data.paymentMethods;
}

async function postAddPaymentMethod(
  paymentMethodId: string,
  setAsDefault = false
): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>(`${BILLING_API_URL}/payment-methods`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethodId, setAsDefault }),
  });
}

async function deletePaymentMethod(paymentMethodId: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`${BILLING_API_URL}/payment-methods/${paymentMethodId}`, {
    method: 'DELETE',
  });
}

async function putSetDefaultPaymentMethod(paymentMethodId: string): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>(
    `${BILLING_API_URL}/payment-methods/${paymentMethodId}/default`,
    { method: 'PUT' }
  );
}

async function postCreateSetupIntent(
  type: PaymentMethodType = 'card',
  metadata?: Record<string, string>
): Promise<SetupIntentResponse> {
  return apiFetch<SetupIntentResponse>(`${BILLING_API_URL}/payment-methods/setup-intent`, {
    method: 'POST',
    body: JSON.stringify({ type, metadata }),
  });
}

async function postCreateCharge(params: ChargeRequest): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`${BILLING_API_URL}/charges`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

async function fetchEscrowStatus(escrowId: string): Promise<EscrowStatusResponse> {
  return apiFetch<EscrowStatusResponse>(`${BILLING_API_URL}/escrow/${escrowId}/status`);
}

// =============================================================================
// Query Keys
// =============================================================================

export const paymentKeys = {
  all: ['payments'] as const,
  connect: () => [...paymentKeys.all, 'connect'] as const,
  connectStatus: () => [...paymentKeys.connect(), 'status'] as const,
  methods: () => [...paymentKeys.all, 'methods'] as const,
  methodList: (type?: string) => [...paymentKeys.methods(), 'list', type] as const,
  escrow: () => [...paymentKeys.all, 'escrow'] as const,
  escrowStatus: (id: string) => [...paymentKeys.escrow(), 'status', id] as const,
};

// =============================================================================
// Connect Hooks
// =============================================================================

/**
 * Get the current Stripe Connect account status
 */
export function useConnectStatus(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: paymentKeys.connectStatus(),
    queryFn: fetchConnectStatus,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

/**
 * Create a new Stripe Connect Express account and get onboarding URL
 */
export function useCreateConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postCreateConnectAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.connectStatus() });
    },
  });
}

/**
 * Get a Stripe Express Dashboard link for the connected account
 */
export function useConnectDashboard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchConnectDashboard,
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
  });
}

/**
 * Disconnect (delete) the Stripe Connect account
 */
export function useDisconnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConnectAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.connectStatus() });
    },
  });
}

// =============================================================================
// Payment Methods Hooks
// =============================================================================

/**
 * Get all payment methods for the authenticated user
 */
export function usePaymentMethods(options?: {
  type?: 'card' | 'bank_account' | 'all';
  enabled?: boolean;
}) {
  const type = options?.type ?? 'all';

  return useQuery({
    queryKey: paymentKeys.methodList(type),
    queryFn: () => fetchPaymentMethods(type),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

/**
 * Add a new payment method using a Stripe PaymentMethod ID
 */
export function useAddPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentMethodId,
      setAsDefault,
    }: {
      paymentMethodId: string;
      setAsDefault?: boolean;
    }) => postAddPaymentMethod(paymentMethodId, setAsDefault),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

/**
 * Remove a payment method by ID
 */
export function useRemovePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentMethodId: string) => deletePaymentMethod(paymentMethodId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

/**
 * Set a payment method as the default
 */
export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentMethodId: string) => putSetDefaultPaymentMethod(paymentMethodId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

/**
 * Create a SetupIntent for securely collecting payment method details
 */
export function useCreateSetupIntent() {
  return useMutation({
    mutationFn: ({
      type,
      metadata,
    }: {
      type?: PaymentMethodType;
      metadata?: Record<string, string>;
    }) => postCreateSetupIntent(type, metadata),
  });
}

// =============================================================================
// Charges Hooks
// =============================================================================

/**
 * Create a payment charge
 */
export function useCreateCharge() {
  return useMutation({
    mutationFn: (params: ChargeRequest) => postCreateCharge(params),
  });
}

// =============================================================================
// Escrow Hooks
// =============================================================================

/**
 * Get escrow status by escrow ID
 */
export function useEscrowStatus(escrowId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: paymentKeys.escrowStatus(escrowId ?? ''),
    queryFn: () => fetchEscrowStatus(escrowId!),
    enabled: !!escrowId && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}
