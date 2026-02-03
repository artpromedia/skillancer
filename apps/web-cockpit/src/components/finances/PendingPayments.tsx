/**
 * Pending Payments Component
 * Shows pending escrow releases and upcoming payments
 */

'use client';

import { Clock, DollarSign, FileText } from 'lucide-react';

import { useBalance } from '@/hooks/api/use-cockpit-finances';

interface PendingPaymentsProps {
  className?: string;
}

export function PendingPayments({ className = '' }: Readonly<PendingPaymentsProps>) {
  const { data: balanceData, isLoading } = useBalance();

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  const pendingReleases = balanceData?.pendingReleases ?? [];
  const totalPending = balanceData?.pending ?? 0;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Pending Payments</h3>
            <p className="text-sm text-gray-500">Upcoming escrow releases</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">${totalPending.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{pendingReleases.length} releases</p>
          </div>
        </div>
      </div>

      {/* Pending Releases List */}
      <div className="divide-y divide-gray-200">
        {pendingReleases.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">No pending payments</p>
            <p className="mt-2 text-sm text-gray-400">
              Completed milestones will appear here until they are released
            </p>
          </div>
        ) : (
          pendingReleases.map((release, index) => (
            <div
              key={`${release.contractId}-${index}`}
              className="flex items-start gap-4 p-6 hover:bg-gray-50"
            >
              {/* Icon */}
              <div className="flex-shrink-0 rounded-full bg-blue-100 p-2">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>

              {/* Release Details */}
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {release.milestoneTitle ?? 'Milestone Payment'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {release.contractTitle ?? 'Contract'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      ${release.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Expected Release Date */}
                {release.expectedDate && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Expected release:{' '}
                      <span className="font-medium">
                        {new Date(release.expectedDate).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {pendingReleases.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total pending in escrow</span>
            <span className="font-semibold text-gray-900">${totalPending.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
