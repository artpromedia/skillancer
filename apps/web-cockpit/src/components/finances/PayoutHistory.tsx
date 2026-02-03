/**
 * Payout History Component
 * Displays past payouts with status, amount, and details
 */

'use client';

import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, XCircle, Download } from 'lucide-react';

import type { PayoutRecord } from '@/hooks/api/use-cockpit-finances';

import { usePayouts } from '@/hooks/api/use-cockpit-finances';

interface PayoutHistoryProps {
  limit?: number;
  className?: string;
}

function getStatusIcon(status: PayoutRecord['status']) {
  switch (status) {
    case 'PAID':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case 'PENDING':
    case 'PROCESSING':
    case 'IN_TRANSIT':
      return <Clock className="h-5 w-5 text-yellow-600" />;
    case 'FAILED':
    case 'CANCELLED':
      return <XCircle className="h-5 w-5 text-red-600" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusText(status: PayoutRecord['status']): string {
  switch (status) {
    case 'PAID':
      return 'Completed';
    case 'PENDING':
      return 'Pending';
    case 'PROCESSING':
      return 'Processing';
    case 'IN_TRANSIT':
      return 'In Transit';
    case 'FAILED':
      return 'Failed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

export function PayoutHistory({ limit = 10, className = '' }: Readonly<PayoutHistoryProps>) {
  const { data: payoutsData, isLoading } = usePayouts({ limit });

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
        <div className="h-96 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const payouts = payoutsData?.payouts ?? [];

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
            <p className="text-sm text-gray-500">Your recent payouts and transfers</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            type="button"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Payout List */}
      <div className="divide-y divide-gray-200">
        {payouts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No payouts yet</p>
            <p className="mt-2 text-sm text-gray-400">Your payout history will appear here</p>
          </div>
        ) : (
          payouts.map((payout) => (
            <div key={payout.id} className="flex items-center gap-4 p-6 hover:bg-gray-50">
              {/* Status Icon */}
              <div className="flex-shrink-0">{getStatusIcon(payout.status)}</div>

              {/* Payout Details */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">${payout.amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">
                      {payout.method === 'BANK_TRANSFER'
                        ? 'Bank Transfer'
                        : payout.method === 'PAYPAL'
                          ? 'PayPal'
                          : payout.method === 'WISE'
                            ? 'Wise'
                            : payout.method === 'INSTANT'
                              ? 'Instant Payout'
                              : 'Bank Transfer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      {getStatusText(payout.status)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(payout.requestedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {payout.estimatedArrival && payout.status === 'PENDING' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Arrives {new Date(payout.estimatedArrival).toLocaleDateString()}
                  </p>
                )}

                {payout.fees.total > 0 && (
                  <p className="mt-1 text-xs text-gray-500">Fee: ${payout.fees.total.toFixed(2)}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* View All Link */}
      {payouts.length >= limit && (
        <div className="border-t border-gray-200 p-4 text-center">
          <button className="text-sm font-medium text-blue-600 hover:text-blue-700" type="button">
            View all payouts →
          </button>
        </div>
      )}
    </div>
  );
}
