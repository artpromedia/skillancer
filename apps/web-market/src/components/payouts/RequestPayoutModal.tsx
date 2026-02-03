'use client';

/**
 * Request Payout Modal Component
 *
 * Allows users to request a manual payout with amount, currency, and method selection.
 */

import { X, Loader2, AlertCircle, CheckCircle, ArrowRight, Zap, Clock, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

import {
  useBalance,
  usePayoutPreview,
  useRequestPayout,
  useRequestInstantPayout,
  formatCurrency,
  type PayoutMethod,
} from '@/hooks/use-payouts';

// ============================================================================
// Types
// ============================================================================

interface RequestPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PayoutTypeOption = 'standard' | 'instant';

// ============================================================================
// Component
// ============================================================================

export function RequestPayoutModal({
  isOpen,
  onClose,
  onSuccess,
}: Readonly<RequestPayoutModalProps>) {
  const { data: balance, isLoading: balanceLoading } = useBalance();
  const requestPayout = useRequestPayout();
  const requestInstantPayout = useRequestInstantPayout();

  // Form state
  const [payoutType, setPayoutType] = useState<PayoutTypeOption>('standard');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [method, setMethod] = useState<PayoutMethod>('BANK_TRANSFER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get available balance
  const availableBalance = balance?.balances.find((b) => b.currency === currency)?.available ?? 0;

  // Preview query
  const { data: preview, error: previewError } = usePayoutPreview(
    Number.parseFloat(amount) || 0,
    currency,
    {
      method,
      instant: payoutType === 'instant',
      enabled: isOpen && Number.parseFloat(amount) > 0,
    }
  );

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setError(null);
      setSuccess(false);
      setPayoutType('standard');
    }
  }, [isOpen]);

  // Set initial currency from balance
  useEffect(() => {
    if (balance?.balances.length && !currency) {
      setCurrency(balance.balances[0].currency);
    }
  }, [balance, currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = Number.parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (numAmount > availableBalance) {
      setError('Insufficient balance');
      return;
    }

    try {
      if (payoutType === 'instant') {
        await requestInstantPayout.mutateAsync({
          amount: numAmount,
          currency,
        });
      } else {
        await requestPayout.mutateAsync({
          amount: numAmount,
          currency,
          method,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request payout');
    }
  };

  const handleWithdrawAll = () => {
    setAmount(availableBalance.toString());
  };

  if (!isOpen) return null;

  const isSubmitting = requestPayout.isPending || requestInstantPayout.isPending;
  const canSubmit =
    Number.parseFloat(amount) > 0 &&
    Number.parseFloat(amount) <= availableBalance &&
    preview?.canProcess &&
    !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50"
        type="button"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Request Payout</h2>
          <button
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Payout Requested!</h3>
            <p className="mt-2 text-sm text-gray-600">
              Your payout of {formatCurrency(Number.parseFloat(amount), currency)} is being
              processed.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            {/* Available Balance */}
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Available Balance</span>
                <span className="text-lg font-semibold text-gray-900">
                  {balanceLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    formatCurrency(availableBalance, currency)
                  )}
                </span>
              </div>
            </div>

            {/* Payout Type Selection */}
            <div className="mt-6">
              <label
                className="mb-2 block text-sm font-medium text-gray-700"
                htmlFor="payout-type-standard"
              >
                Payout Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-colors ${
                    payoutType === 'standard'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  type="button"
                  onClick={() => setPayoutType('standard')}
                >
                  <Clock
                    className={`h-5 w-5 ${payoutType === 'standard' ? 'text-indigo-600' : 'text-gray-400'}`}
                  />
                  <div>
                    <p
                      className={`font-medium ${payoutType === 'standard' ? 'text-indigo-900' : 'text-gray-900'}`}
                    >
                      Standard
                    </p>
                    <p className="text-xs text-gray-500">2-5 business days</p>
                  </div>
                </button>
                <button
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-colors ${
                    payoutType === 'instant'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled={!preview?.instantAvailable}
                  type="button"
                  onClick={() => setPayoutType('instant')}
                >
                  <Zap
                    className={`h-5 w-5 ${payoutType === 'instant' ? 'text-indigo-600' : 'text-gray-400'}`}
                  />
                  <div>
                    <p
                      className={`font-medium ${payoutType === 'instant' ? 'text-indigo-900' : 'text-gray-900'}`}
                    >
                      Instant
                    </p>
                    <p className="text-xs text-gray-500">Within 30 minutes</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700" htmlFor="amount-input">
                  Amount
                </label>
                <button
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  type="button"
                  onClick={handleWithdrawAll}
                >
                  Withdraw All
                </button>
              </div>
              <div className="mt-2 flex rounded-lg border border-gray-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <span className="flex items-center border-r border-gray-300 bg-gray-50 px-3 text-gray-500">
                  {currency}
                </span>
                <input
                  className="block w-full rounded-r-lg border-0 py-3 pl-4 pr-4 text-lg font-semibold focus:outline-none"
                  id="amount-input"
                  min="0"
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Method Selection (for standard payouts) */}
            {payoutType === 'standard' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700" htmlFor="method-select">
                  Payout Method
                </label>
                <select
                  className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="method-select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PayoutMethod)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (ACH/SEPA)</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="WISE">Wise</option>
                </select>
              </div>
            )}

            {/* Fee Preview */}
            {Boolean(preview && Number.parseFloat(amount) > 0) && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="text-sm font-medium text-gray-700">Fee Breakdown</h4>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payout Amount</span>
                    <span className="font-medium">
                      {formatCurrency(preview.grossAmount, currency)}
                    </span>
                  </div>
                  {preview.fees.payoutFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payout Fee</span>
                      <span className="text-red-600">
                        -{formatCurrency(preview.fees.payoutFee, currency)}
                      </span>
                    </div>
                  )}
                  {Boolean(preview.fees.instantFee && preview.fees.instantFee > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Instant Fee</span>
                      <span className="text-red-600">
                        -{formatCurrency(preview.fees.instantFee, currency)}
                      </span>
                    </div>
                  )}
                  {preview.fees.conversionFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Conversion Fee</span>
                      <span className="text-red-600">
                        -{formatCurrency(preview.fees.conversionFee, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-medium">
                    <span>You&apos;ll Receive</span>
                    <span className="text-green-600">
                      {formatCurrency(preview.netAmount, currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      Est. arrival: {new Date(preview.estimatedArrival).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Info Notice */}
            {payoutType === 'instant' && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>
                  Instant payouts are subject to availability and may have higher fees. Funds are
                  typically delivered within 30 minutes.
                </p>
              </div>
            )}

            {/* Error Message */}
            {(error || previewError) && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error || previewError?.message}
              </div>
            )}

            {/* Submit Button */}
            <button
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit}
              type="submit"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Request Payout
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default RequestPayoutModal;
