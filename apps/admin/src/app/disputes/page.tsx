'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useDisputes, useDisputeStats } from '../../hooks/api/use-disputes';

type DisputeStatusFilter = 'open' | 'in_progress' | 'resolved' | 'escalated';
type DisputeTypeFilter = 'payment' | 'scope' | 'quality' | 'deadline' | 'communication';

const statusColors: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  escalated: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const typeLabels: Record<string, string> = {
  payment: 'Payment',
  scope: 'Scope',
  quality: 'Quality',
  deadline: 'Deadline',
  communication: 'Communication',
};

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState<DisputeStatusFilter | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DisputeTypeFilter | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'priority'>('date');
  const [page, setPage] = useState(1);

  const filters: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter !== 'all') filters.status = statusFilter;
  if (typeFilter !== 'all') filters.type = typeFilter;
  if (sortBy === 'date') {
    filters.sortBy = 'createdAt';
    filters.sortOrder = 'desc';
  } else if (sortBy === 'amount') {
    filters.sortBy = 'amount';
    filters.sortOrder = 'desc';
  } else if (sortBy === 'priority') {
    filters.sortBy = 'priority';
    filters.sortOrder = 'asc';
  }

  const { data: disputesData, isLoading, error } = useDisputes(filters as never);
  const { data: statsData } = useDisputeStats();

  const disputes = disputesData?.data ?? [];
  const totalPages = disputesData?.totalPages ?? 1;

  const stats = statsData?.data ?? {
    total: 0,
    open: 0,
    inProgress: 0,
    totalValue: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
          <p className="text-gray-600">Manage and resolve platform disputes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Total Disputes</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Open</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.open ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress ?? 0}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Value at Stake</div>
          <div className="text-2xl font-bold text-gray-900">
            ${(stats.totalValue ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as DisputeStatusFilter | 'all');
              setPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Type</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as DisputeTypeFilter | 'all');
              setPage(1);
            }}
          >
            <option value="all">All Types</option>
            <option value="payment">Payment</option>
            <option value="scope">Scope</option>
            <option value="quality">Quality</option>
            <option value="deadline">Deadline</option>
            <option value="communication">Communication</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Sort By</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'priority')}
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        <div className="ml-auto">
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Export Disputes
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-white py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <span className="ml-3 text-gray-500">Loading disputes...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Failed to load disputes</p>
          <p className="mt-1 text-sm text-red-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {/* Disputes List */}
      {!isLoading && !error && disputes.length > 0 && (
        <div className="space-y-4">
          {disputes.map((dispute: Record<string, unknown>) => (
            <Link
              key={dispute.id as string}
              className="block rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
              href={`/disputes/${dispute.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">
                      {(dispute.contractTitle as string) || (dispute.title as string) || `Dispute #${dispute.id}`}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[(dispute.status as string) || ''] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {((dispute.status as string) || '').replace('_', ' ')}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[(dispute.priority as string) || ''] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {dispute.priority as string}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {typeLabels[(dispute.type as string) || ''] || (dispute.type as string)} dispute
                    {dispute.contractId ? ` -- Contract #${dispute.contractId}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${((dispute.amount as number) || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">at stake</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                      {((dispute.client as Record<string, string>)?.name || (dispute.clientName as string) || '?').charAt(0)}
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Client:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {(dispute.client as Record<string, string>)?.name || (dispute.clientName as string) || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-300">vs</div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-700">
                      {((dispute.freelancer as Record<string, string>)?.name || (dispute.freelancerName as string) || '?').charAt(0)}
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Freelancer:</span>{' '}
                      <span className="font-medium text-gray-900">
                        {(dispute.freelancer as Record<string, string>)?.name || (dispute.freelancerName as string) || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  {(dispute.assignedTo as Record<string, string>) ? (
                    <span className="text-gray-600">
                      Assigned to:{' '}
                      <span className="font-medium">
                        {(dispute.assignedTo as Record<string, string>)?.name || 'Assigned'}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-indigo-600">Unassigned</span>
                  )}
                  <span className="text-gray-400">
                    Updated{' '}
                    {dispute.updatedAt
                      ? new Date(dispute.updatedAt as string).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
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
      {!isLoading && !error && disputes.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-lg font-medium text-gray-900">No disputes found</p>
          <p className="mt-1 text-gray-500">No disputes found matching your filters</p>
        </div>
      )}
    </div>
  );
}
