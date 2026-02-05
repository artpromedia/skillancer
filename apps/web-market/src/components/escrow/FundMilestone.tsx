'use client';

/**
 * FundMilestone Component
 *
 * Allows clients to fund a specific milestone by selecting a payment method
 * and confirming the escrow deposit. Handles loading, confirmation,
 * success, and error states.
 *
 * @module components/escrow/FundMilestone
 */

import {
  DollarSign,
  CreditCard,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  usePaymentMethods,
  paymentKeys,
  type PaymentMethod,
} from '@/hooks/api/use-payments';

// =============================================================================
// Constants
// =============================================================================

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ?? 'http://localhost:4000/api/billing';

// =============================================================================
// Types
// =============================================================================

interface FundMilestoneProps {
  contractId: string;
  milestoneId: string;
  milestoneName: string;
  amount: number;
  currency?: string;
  onSuccess?: (result: FundEscrowResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

interface FundEscrowResult {
  transaction: Record<string, unknown>;
  escrowBalance: Record<string, unknown>;
  clientSecret?: string;
}

type FundingStep = 'select' | 'confirm' | 'processing' | 'success' | 'error';

// =============================================================================
// API Helper
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

async function fundEscrow(params: {
  contractId: string;
  milestoneId: string;
  amount: number;
  paymentMethodId: string;
}): Promise<FundEscrowResult> {
  const response = await fetch(`${BILLING_API_URL}/escrow/fund`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string; error?: string }).message ??
        (errorData as { error?: string }).error ??
        `Fund escrow failed with status ${response.status}`
    );
  }

  return response.json() as Promise<FundEscrowResult>;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function getCardIcon(brand?: string): string {
  switch (brand?.toLowerCase()) {
    case 'visa':
      return 'Visa';
    case 'mastercard':
      return 'MC';
    case 'amex':
      return 'Amex';
    case 'discover':
      return 'Disc';
    default:
      return 'Card';
  }
}

// =============================================================================
// Component
// =============================================================================

export function FundMilestone({
  contractId,
  milestoneId,
  milestoneName,
  amount,
  currency = 'USD',
  onSuccess,
  onError,
  onCancel,
  showCancel = true,
}: FundMilestoneProps) {
  const queryClient = useQueryClient();
  const { data: paymentMethods = [], isLoading: isLoadingMethods } = usePaymentMethods();

  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [step, setStep] = useState<FundingStep>('select');
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);

  // Auto-select default payment method
  const defaultMethod = paymentMethods.find((m) => m.isDefault);
  const effectiveSelectedId = selectedMethodId ?? defaultMethod?.id ?? null;
  const selectedMethod = paymentMethods.find((m) => m.id === effectiveSelectedId);

  // Fund mutation
  const fundMutation = useMutation({
    mutationFn: () =>
      fundEscrow({
        contractId,
        milestoneId,
        amount,
        paymentMethodId: selectedMethod?.stripePaymentMethodId ?? '',
      }),
    onSuccess: (result) => {
      setStep('success');
      void queryClient.invalidateQueries({ queryKey: paymentKeys.escrow() });
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      setFundingError(error.message);
      setStep('error');
      onError?.(error);
    },
  });

  const handleSelectMethod = useCallback((method: PaymentMethod) => {
    setSelectedMethodId(method.id);
    setShowMethodDropdown(false);
  }, []);

  const handleProceedToConfirm = useCallback(() => {
    if (!selectedMethod) return;
    setStep('confirm');
  }, [selectedMethod]);

  const handleConfirmFunding = useCallback(() => {
    setStep('processing');
    setFundingError(null);
    fundMutation.mutate();
  }, [fundMutation]);

  const handleRetry = useCallback(() => {
    setFundingError(null);
    setStep('select');
  }, []);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (isLoadingMethods) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="ml-3 text-sm text-gray-500">Loading payment methods...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No Payment Methods
  // ---------------------------------------------------------------------------

  if (paymentMethods.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-center py-8">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No Payment Methods</h3>
          <p className="mt-2 text-sm text-gray-500">
            Please add a payment method before funding a milestone.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Success State
  // ---------------------------------------------------------------------------

  if (step === 'success') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h3 className="mt-4 text-lg font-semibold text-green-900">Milestone Funded</h3>
          <p className="mt-2 text-sm text-green-700">
            {formatCurrency(amount, currency)} has been deposited into escrow for{' '}
            <span className="font-medium">{milestoneName}</span>.
          </p>
          <p className="mt-1 text-xs text-green-600">
            Funds will be released to the freelancer upon milestone approval.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (step === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-semibold text-red-900">Funding Failed</h3>
          <p className="mt-2 text-sm text-red-700">
            {fundingError ?? 'An unexpected error occurred while funding the milestone.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              onClick={handleRetry}
            >
              Try Again
            </button>
            {showCancel && onCancel && (
              <button
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Processing State
  // ---------------------------------------------------------------------------

  if (step === 'processing') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-center py-8">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Processing Payment</h3>
          <p className="mt-2 text-sm text-gray-500">
            Depositing {formatCurrency(amount, currency)} into escrow...
          </p>
          <p className="mt-1 text-xs text-gray-400">Please do not close this page.</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Confirmation Step
  // ---------------------------------------------------------------------------

  if (step === 'confirm') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Confirm Escrow Deposit</h3>
        <p className="mt-1 text-sm text-gray-500">
          Please review the details below before confirming.
        </p>

        <div className="mt-6 space-y-4">
          {/* Milestone Details */}
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{milestoneName}</p>
                <p className="text-xs text-gray-500">Escrow deposit</p>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(amount, currency)}
              </p>
            </div>
          </div>

          {/* Payment Method */}
          {selectedMethod && (
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Payment Method</p>
              <div className="mt-2 flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-900">
                  {selectedMethod.card
                    ? `${getCardIcon(selectedMethod.card.brand)} ending in ${selectedMethod.card.last4}`
                    : selectedMethod.bankAccount
                      ? `${selectedMethod.bankAccount.bankName ?? 'Bank'} ending in ${selectedMethod.bankAccount.last4}`
                      : 'Payment method'}
                </span>
              </div>
            </div>
          )}

          {/* Security Note */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
            <p className="text-xs text-blue-700">
              Funds are held securely in escrow and will only be released upon your approval of
              the completed milestone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setStep('select')}
          >
            Back
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            onClick={handleConfirmFunding}
          >
            Confirm & Fund {formatCurrency(amount, currency)}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Selection Step (Default)
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
          <DollarSign className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Fund Milestone</h3>
          <p className="text-sm text-gray-500">{milestoneName}</p>
        </div>
      </div>

      {/* Amount */}
      <div className="mt-6 rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Amount to Deposit</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(amount, currency)}</p>
      </div>

      {/* Payment Method Selector */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700">Payment Method</label>
        <div className="relative mt-2">
          <button
            className="relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-3 pl-4 pr-10 text-left shadow-sm hover:border-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            type="button"
            onClick={() => setShowMethodDropdown(!showMethodDropdown)}
          >
            {selectedMethod ? (
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-900">
                  {selectedMethod.card
                    ? `${getCardIcon(selectedMethod.card.brand)} ending in ${selectedMethod.card.last4}`
                    : selectedMethod.bankAccount
                      ? `${selectedMethod.bankAccount.bankName ?? 'Bank'} ending in ${selectedMethod.bankAccount.last4}`
                      : 'Payment method'}
                </span>
                {selectedMethod.isDefault && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    Default
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-500">Select a payment method</span>
            )}
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </span>
          </button>

          {/* Dropdown */}
          {showMethodDropdown && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                    method.id === effectiveSelectedId ? 'bg-indigo-50' : ''
                  }`}
                  type="button"
                  onClick={() => handleSelectMethod(method)}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">
                      {method.card
                        ? `${getCardIcon(method.card.brand)} ending in ${method.card.last4}`
                        : method.bankAccount
                          ? `${method.bankAccount.bankName ?? 'Bank'} ending in ${method.bankAccount.last4}`
                          : 'Payment method'}
                    </span>
                    {method.isDefault && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        Default
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {showCancel && onCancel && (
          <button
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!selectedMethod}
          type="button"
          onClick={handleProceedToConfirm}
        >
          Fund Milestone
        </button>
      </div>
    </div>
  );
}

export default FundMilestone;
