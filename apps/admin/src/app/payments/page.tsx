'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePayments, usePaymentStats } from '../../hooks/api/use-payments';

type TransactionType = 'payment' | 'payout' | 'refund' | 'fee';
type TransactionStatus = 'completed' | 'pending' | 'failed' | 'processing';

const typeColors: Record<string, string> = {
  payment: 'bg-green-100 text-green-800',
  payout: 'bg-blue-100 text-blue-800',
  refund: 'bg-orange-100 text-orange-800',
  fee: 'bg-purple-100 text-purple-800',
};

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
};

export default function PaymentsPage() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, unknown> = { page, limit: 20 };
  if (typeFilter !== 'all') filters.type = typeFilter;
  if (statusFilter !== 'all') filters.status = statusFilter;
  if (searchQuery) filters.search = searchQuery;

  const { data: paymentsData, isLoading, error } = usePayments(filters as never);
  const { data: statsData } = usePaymentStats();

  const transactions = paymentsData?.data ?? [];
  const totalCount = paymentsData?.total ?? 0;
  const totalPages = paymentsData?.totalPages ?? 1;

  const stats = statsData?.data ?? {
    todayVolume: 0,
    pendingPayouts: 0,
    failedTransactions: 0,
    disputeValue: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Monitor and manage platform transactions</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Export Transactions
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Today&apos;s Volume</div>
          <div className="text-2xl font-bold text-gray-900">
            ${(stats.todayVolume ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Pending Payouts</div>
          <div className="text-2xl font-bold text-yellow-600">
            ${(stats.pendingPayouts ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Failed Transactions</div>
          <div className="text-2xl font-bold text-red-600">{stats.failedTransactions ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Disputes Value</div>
          <div className="text-2xl font-bold text-orange-600">
            ${(stats.disputeValue ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
        <div className="flex-1">
          <input
            className="w-full rounded-lg border px-4 py-2 text-sm"
            placeholder="Search by reference, payer, or payee..."
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as TransactionType | 'all');
            setPage(1);
          }}
        >
          <option value="all">All Types</option>
          <option value="payment">Payment</option>
          <option value="payout">Payout</option>
          <option value="refund">Refund</option>
          <option value="fee">Fee</option>
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as TransactionStatus | 'all');
            setPage(1);
          }}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-white py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <span className="ml-3 text-gray-500">Loading transactions...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Failed to load transactions</p>
          <p className="mt-1 text-sm text-red-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {/* Transactions Table */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Payer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Payee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((tx: Record<string, unknown>) => (
                <tr key={tx.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      className="font-mono text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      href={`/payments/${tx.id}`}
                    >
                      {(tx.reference as string) || (tx.id as string)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${typeColors[(tx.type as string) || ''] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {tx.type as string}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      ${((tx.amount as number) || 0).toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">
                      {(tx.currency as string) || 'USD'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[(tx.status as string) || ''] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {tx.status as string}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {(tx.payer as Record<string, string>)?.name || (tx.payerName as string) || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {(tx.payee as Record<string, string>)?.name || (tx.payeeName as string) || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {tx.createdAt ? new Date(tx.createdAt as string).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      href={`/payments/${tx.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-gray-500">
              Showing page {page} of {totalPages} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && transactions.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-gray-500">No transactions found matching your filters</p>
        </div>
      )}
    </div>
  );
}
