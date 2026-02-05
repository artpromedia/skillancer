'use client';

/**
 * ReleasePayment Component
 *
 * Allows clients to release escrow funds to the freelancer
 * upon milestone completion. Includes a confirmation modal
 * and handles loading/success/error states.
 *
 * @module components/escrow/ReleasePayment
 */

import {
  ArrowUpCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { paymentKeys } from '@/hooks/api/use-payments';

// =============================================================================
// Constants
// =============================================================================

const BILLING_API_URL =
  process.env.NEXT_PUBLIC_BILLING_API_URL ?? 'http://localhost:4000/api/billing';

// =============================================================================
// Types
// =============================================================================

interface ReleasePaymentProps {
  escrowId: string;
  milestoneId?: string;
  milestoneName?: string;
  amount: number;
  currency?: string;
  onSuccess?: (result: ReleaseResult) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  variant?: 'button' | 'inline';
}

interface ReleaseResult {
  success: boolean;
  transferId?: string;
  amountReleased: number;
  remainingBalance: number;
  error?: string;
}

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

async function releaseEscrow(params: {
  escrowId: string;
  milestoneId?: string;
  amount?: number;
  notes?: string;
}): Promise<ReleaseResult> {
  const response = await fetch(`${BILLING_API_URL}/escrow/${params.escrowId}/release`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      milestoneId: params.milestoneId,
      amount: params.amount,
      notes: params.notes,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { message?: string; error?: string }).message ??
        (errorData as { error?: string }).error ??
        `Release failed with status ${response.status}`
    );
  }

  return response.json() as Promise<ReleaseResult>;
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

// =============================================================================
// Component
// =============================================================================

export function ReleasePayment({
  escrowId,
  milestoneId,
  milestoneName,
  amount,
  currency = 'USD',
  onSuccess,
  onError,
  disabled = false,
  variant = 'button',
}: ReleasePaymentProps) {
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: () =>
      releaseEscrow({
        escrowId,
        milestoneId,
        amount,
      }),
    onSuccess: (result) => {
      setShowConfirmModal(false);
      setShowSuccess(true);
      void queryClient.invalidateQueries({ queryKey: paymentKeys.escrow() });
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      setReleaseError(error.message);
      onError?.(error);
    },
  });

  const handleOpenConfirm = useCallback(() => {
    setReleaseError(null);
    setShowConfirmModal(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setShowConfirmModal(false);
    setReleaseError(null);
  }, []);

  const handleRelease = useCallback(() => {
    setReleaseError(null);
    releaseMutation.mutate();
  }, [releaseMutation]);

  // Reset success state after a delay
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // ---------------------------------------------------------------------------
  // Success State
  // ---------------------------------------------------------------------------

  if (showSuccess) {
    if (variant === 'inline') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-700">
            {formatCurrency(amount, currency)} released successfully
          </span>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
        <h3 className="mt-3 text-lg font-semibold text-green-900">Payment Released</h3>
        <p className="mt-1 text-sm text-green-700">
          {formatCurrency(amount, currency)} has been released to the freelancer
          {milestoneName ? ` for "${milestoneName}"` : ''}.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Release Button
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Trigger Button */}
      <button
        className={`inline-flex items-center gap-2 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          variant === 'inline'
            ? 'bg-green-600 px-4 py-2 text-white hover:bg-green-500'
            : 'bg-green-600 px-6 py-3 text-white shadow-sm hover:bg-green-500'
        }`}
        disabled={disabled || releaseMutation.isPending}
        type="button"
        onClick={handleOpenConfirm}
      >
        <ArrowUpCircle className="h-4 w-4" />
        Release Payment
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleCloseConfirm}
          />

          {/* Modal */}
          <div className="relative z-10 mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Release Payment</h3>
              <button
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onClick={handleCloseConfirm}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              {/* Amount Display */}
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Amount to Release
                </p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {formatCurrency(amount, currency)}
                </p>
                {milestoneName && (
                  <p className="mt-1 text-sm text-gray-500">For: {milestoneName}</p>
                )}
              </div>

              {/* Warning */}
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700">
                  This action cannot be undone. Once released, the funds will be transferred to the
                  freelancer&apos;s connected account.
                </p>
              </div>

              {/* Security Note */}
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                <p className="text-xs text-blue-700">
                  Only release payment when you are satisfied with the delivered work for this
                  milestone.
                </p>
              </div>

              {/* Error Message */}
              {releaseError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <p className="text-xs text-red-700">{releaseError}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={releaseMutation.isPending}
                onClick={handleCloseConfirm}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={releaseMutation.isPending}
                onClick={handleRelease}
              >
                {releaseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Releasing...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="h-4 w-4" />
                    Confirm Release
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ReleasePayment;
