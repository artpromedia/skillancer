'use client';

/**
 * Payout History Table Component
 *
 * Displays a table of past and pending payouts with status, amounts, and actions.
 */

import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Loader2,
  ChevronRight,
  RefreshCw,
  Truck,
  Ban,
} from 'lucide-react';
import { useState } from 'react';

import {
  usePayoutHistory,
  useCancelPayout,
  formatCurrency,
  getPayoutStatusInfo,
  type PayoutResponse,
  type PayoutStatus,
} from '@/hooks/use-payouts';

// ============================================================================
// Types
// ============================================================================

interface PayoutHistoryTableProps {
  limit?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
  className?: string;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: Readonly<{ status: PayoutStatus }>) {
  const { label, color, bgColor } = getPayoutStatusInfo(status);

  const Icon =
    {
      PENDING: Clock,
      PROCESSING: RefreshCw,
      IN_TRANSIT: Truck,
      PAID: CheckCircle,
      FAILED: XCircle,
      CANCELLED: Ban,
    }[status] || AlertCircle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${bgColor} ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ============================================================================
// Payout Date Component
// ============================================================================

interface PayoutDateProps {
  estimatedArrival?: string;
  arrivedAt?: string;
  isProcessing: boolean;
}

function PayoutDate({ estimatedArrival, arrivedAt, isProcessing }: Readonly<PayoutDateProps>) {
  if (estimatedArrival) {
    return (
      <p className="text-sm text-gray-600">
        {isProcessing ? 'Est. ' : ''}
        {new Date(estimatedArrival).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}
      </p>
    );
  }

  if (arrivedAt) {
    return <p className="text-sm text-green-600">{new Date(arrivedAt).toLocaleDateString()}</p>;
  }

  return <span className="text-sm text-gray-400">—</span>;
}

// ============================================================================
// Payout Row Component
// ============================================================================

interface PayoutRowProps {
  payout: PayoutResponse;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}

function PayoutRow({ payout, onCancel, isCancelling }: Readonly<PayoutRowProps>) {
  const [expanded, setExpanded] = useState(false);

  const canCancel = payout.status === 'PENDING';
  const isProcessing = payout.status === 'PROCESSING' || payout.status === 'IN_TRANSIT';

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <ArrowUpRight className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {payout.type === 'INSTANT' ? 'Instant Payout' : 'Standard Payout'}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(payout.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <StatusBadge status={payout.status} />
        </td>
        <td className="px-4 py-4 text-right">
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(payout.amount, payout.currency)}
          </p>
          {payout.fees.totalFee > 0 && (
            <p className="text-xs text-gray-500">
              Fee: {formatCurrency(payout.fees.totalFee, payout.currency)}
            </p>
          )}
        </td>
        <td className="px-4 py-4 text-right">
          <PayoutDate
            arrivedAt={payout.arrivedAt}
            estimatedArrival={payout.estimatedArrival}
            isProcessing={isProcessing}
          />
        </td>
        <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {canCancel && onCancel && (
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={isCancelling}
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(payout.id);
                }}
              >
                {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel'}
              </button>
            )}
            <ChevronRight
              className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </div>
        </td>
      </tr>

      {/* Expanded Details */}
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td className="px-4 py-4" colSpan={5}>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              {/* Payout Details */}
              <div>
                <h4 className="mb-2 font-medium text-gray-900">Payout Details</h4>
                <dl className="space-y-1 text-gray-600">
                  <div className="flex justify-between">
                    <dt>Method:</dt>
                    <dd className="font-medium">{payout.method.replace('_', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Type:</dt>
                    <dd>{payout.type}</dd>
                  </div>
                  {payout.destination && (
                    <div className="flex justify-between">
                      <dt>Destination:</dt>
                      <dd>
                        {payout.destination.bankName || 'Bank'} ••••{payout.destination.last4}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Fee Breakdown */}
              <div>
                <h4 className="mb-2 font-medium text-gray-900">Fee Breakdown</h4>
                <dl className="space-y-1 text-gray-600">
                  <div className="flex justify-between">
                    <dt>Payout Amount:</dt>
                    <dd>
                      {formatCurrency(payout.netAmount + payout.fees.totalFee, payout.currency)}
                    </dd>
                  </div>
                  {payout.fees.payoutFee > 0 && (
                    <div className="flex justify-between">
                      <dt>Payout Fee:</dt>
                      <dd className="text-red-600">
                        -{formatCurrency(payout.fees.payoutFee, payout.currency)}
                      </dd>
                    </div>
                  )}
                  {payout.fees.conversionFee > 0 && (
                    <div className="flex justify-between">
                      <dt>Conversion Fee:</dt>
                      <dd className="text-red-600">
                        -{formatCurrency(payout.fees.conversionFee, payout.currency)}
                      </dd>
                    </div>
                  )}
                  {Boolean(payout.fees.instantFee && payout.fees.instantFee > 0) && (
                    <div className="flex justify-between">
                      <dt>Instant Fee:</dt>
                      <dd className="text-red-600">
                        -{formatCurrency(payout.fees.instantFee, payout.currency)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-1 font-medium">
                    <dt>Net Amount:</dt>
                    <dd className="text-green-600">
                      {formatCurrency(payout.netAmount, payout.currency)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Status & Failure Info */}
              <div>
                <h4 className="mb-2 font-medium text-gray-900">Status</h4>
                {payout.status === 'FAILED' ? (
                  <div className="rounded-lg bg-red-50 p-3 text-red-700">
                    <p className="font-medium">Payout Failed</p>
                    {payout.failureMessage && (
                      <p className="mt-1 text-sm">{payout.failureMessage}</p>
                    )}
                    {payout.failureCode && (
                      <p className="mt-1 text-xs opacity-75">Code: {payout.failureCode}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 text-gray-600">
                    <p>ID: {payout.id.slice(0, 8)}...</p>
                    <p>Created: {new Date(payout.createdAt).toLocaleString()}</p>
                    {payout.updatedAt !== payout.createdAt && (
                      <p>Updated: {new Date(payout.updatedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PayoutHistoryTable({
  limit = 10,
  showViewAll = true,
  onViewAll,
  className = '',
}: Readonly<PayoutHistoryTableProps>) {
  const { data, isLoading, error, refetch } = usePayoutHistory({ limit });
  const cancelMutation = useCancelPayout();

  const handleCancel = async (payoutId: string) => {
    if (confirm('Are you sure you want to cancel this payout?')) {
      try {
        await cancelMutation.mutateAsync(payoutId);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to cancel payout');
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className}`}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm text-red-600">{error.message}</p>
          <button
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            onClick={() => {
              void refetch();
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const payouts = data?.payouts ?? [];

  if (payouts.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-8 text-center ${className}`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <ArrowUpRight className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">No Payouts Yet</h3>
        <p className="mt-2 text-sm text-gray-500">
          Your payout history will appear here once you request your first withdrawal.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
        <button
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Payout</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Arrival</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <PayoutRow
                key={payout.id}
                isCancelling={cancelMutation.isPending}
                payout={payout}
                onCancel={(id) => {
                  void handleCancel(id);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {showViewAll && data?.hasMore && (
        <div className="border-t border-gray-200 px-4 py-3 text-center">
          <button
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            onClick={onViewAll}
          >
            View All Payouts ({data.total} total)
          </button>
        </div>
      )}
    </div>
  );
}

export default PayoutHistoryTable;
