'use client';

import Link from 'next/link';
import { useState } from 'react';

type TransactionType = 'payment' | 'payout' | 'refund' | 'fee';
type TransactionStatus = 'completed' | 'pending' | 'failed' | 'processing';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  payer: { id: string; name: string };
  payee: { id: string; name: string };
  contractId?: string;
  createdAt: string;
  reference: string;
}

const mockTransactions: Transaction[] = [
  {
    id: 't1',
    type: 'payment',
    amount: 2500,
    currency: 'USD',
    status: 'completed',
    payer: { id: 'u1', name: 'TechCorp' },
    payee: { id: 'u2', name: 'Alex Dev' },
    contractId: 'c1',
    createdAt: '2024-01-15T10:00:00Z',
    reference: 'PAY-001234',
  },
  {
    id: 't2',
    type: 'payout',
    amount: 2375,
    currency: 'USD',
    status: 'pending',
    payer: { id: 'platform', name: 'Skillancer' },
    payee: { id: 'u2', name: 'Alex Dev' },
    createdAt: '2024-01-15T11:00:00Z',
    reference: 'PO-001235',
  },
  {
    id: 't3',
    type: 'refund',
    amount: 500,
    currency: 'USD',
    status: 'completed',
    payer: { id: 'platform', name: 'Skillancer' },
    payee: { id: 'u3', name: 'StartupXYZ' },
    contractId: 'c2',
    createdAt: '2024-01-14T15:00:00Z',
    reference: 'REF-001236',
  },
  {
    id: 't4',
    type: 'payment',
    amount: 1000,
    currency: 'USD',
    status: 'failed',
    payer: { id: 'u4', name: 'DesignCo' },
    payee: { id: 'u5', name: 'Sarah Designer' },
    contractId: 'c3',
    createdAt: '2024-01-14T12:00:00Z',
    reference: 'PAY-001237',
  },
  {
    id: 't5',
    type: 'fee',
    amount: 125,
    currency: 'USD',
    status: 'completed',
    payer: { id: 'u2', name: 'Alex Dev' },
    payee: { id: 'platform', name: 'Skillancer' },
    contractId: 'c1',
    createdAt: '2024-01-15T10:00:00Z',
    reference: 'FEE-001238',
  },
];

const typeColors: Record<TransactionType, string> = {
  payment: 'bg-green-100 text-green-800',
  payout: 'bg-blue-100 text-blue-800',
  refund: 'bg-orange-100 text-orange-800',
  fee: 'bg-purple-100 text-purple-800',
};

const statusColors: Record<TransactionStatus, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  processing: 'bg-blue-100 text-blue-800',
};

export default function PaymentsPage() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = mockTransactions
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter(
      (t) =>
        searchQuery === '' ||
        t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.payer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.payee.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const stats = {
    todayVolume: 125000,
    pendingPayouts: 45000,
    failedTransactions: 3,
    disputeValue: 8500,
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
            ${stats.todayVolume.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Pending Payouts</div>
          <div className="text-2xl font-bold text-yellow-600">
            ${stats.pendingPayouts.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Failed Transactions</div>
          <div className="text-2xl font-bold text-red-600">{stats.failedTransactions}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Disputes Value</div>
          <div className="text-2xl font-bold text-orange-600">
            ${stats.disputeValue.toLocaleString()}
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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
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
          onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Transactions Table */}
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
            {filteredTransactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    className="font-mono text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    href={`/payments/${tx.id}`}
                  >
                    {tx.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${typeColors[tx.type]}`}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">${tx.amount.toLocaleString()}</span>
                  <span className="ml-1 text-xs text-gray-500">{tx.currency}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[tx.status]}`}
                  >
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{tx.payer.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{tx.payee.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(tx.createdAt).toLocaleDateString()}
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
      </div>

      {filteredTransactions.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-gray-500">No transactions found matching your filters</p>
        </div>
      )}
    </div>
  );
}
