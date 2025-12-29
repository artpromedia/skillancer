'use client';

import Link from 'next/link';
import { useState } from 'react';

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';
type DisputeType = 'payment' | 'scope' | 'quality' | 'deadline' | 'communication';

interface Dispute {
  id: string;
  contractId: string;
  contractTitle: string;
  type: DisputeType;
  status: DisputeStatus;
  amount: number;
  client: { id: string; name: string; avatar?: string };
  freelancer: { id: string; name: string; avatar?: string };
  assignedTo?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

const mockDisputes: Dispute[] = [
  {
    id: 'd1',
    contractId: 'c1',
    contractTitle: 'E-commerce Website Development',
    type: 'payment',
    status: 'open',
    amount: 5000,
    client: { id: 'u1', name: 'TechCorp Inc.' },
    freelancer: { id: 'u2', name: 'Alex Developer' },
    createdAt: '2024-01-14T10:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
    priority: 'high',
  },
  {
    id: 'd2',
    contractId: 'c2',
    contractTitle: 'Mobile App Design',
    type: 'quality',
    status: 'in_progress',
    amount: 2500,
    client: { id: 'u3', name: 'StartupXYZ' },
    freelancer: { id: 'u4', name: 'Sarah Designer' },
    assignedTo: { id: 'a1', name: 'Admin John' },
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
    priority: 'medium',
  },
  {
    id: 'd3',
    contractId: 'c3',
    contractTitle: 'SEO Optimization',
    type: 'scope',
    status: 'escalated',
    amount: 1500,
    client: { id: 'u5', name: 'MarketingPro' },
    freelancer: { id: 'u6', name: 'Mike SEO' },
    assignedTo: { id: 'a2', name: 'Admin Sarah' },
    createdAt: '2024-01-10T11:00:00Z',
    updatedAt: '2024-01-14T16:00:00Z',
    priority: 'urgent',
  },
  {
    id: 'd4',
    contractId: 'c4',
    contractTitle: 'Content Writing',
    type: 'deadline',
    status: 'resolved',
    amount: 800,
    client: { id: 'u7', name: 'BlogCo' },
    freelancer: { id: 'u8', name: 'Emma Writer' },
    assignedTo: { id: 'a1', name: 'Admin John' },
    createdAt: '2024-01-08T09:00:00Z',
    updatedAt: '2024-01-13T15:00:00Z',
    priority: 'low',
  },
];

const statusColors: Record<DisputeStatus, string> = {
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

const typeLabels: Record<DisputeType, string> = {
  payment: 'Payment',
  scope: 'Scope',
  quality: 'Quality',
  deadline: 'Deadline',
  communication: 'Communication',
};

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DisputeType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'priority'>('date');

  const filteredDisputes = mockDisputes
    .filter((d) => statusFilter === 'all' || d.status === statusFilter)
    .filter((d) => typeFilter === 'all' || d.type === typeFilter)
    .sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount;
      if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = {
    total: mockDisputes.length,
    open: mockDisputes.filter((d) => d.status === 'open').length,
    inProgress: mockDisputes.filter((d) => d.status === 'in_progress').length,
    totalValue: mockDisputes
      .filter((d) => d.status !== 'resolved')
      .reduce((sum, d) => sum + d.amount, 0),
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
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Open</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Value at Stake</div>
          <div className="text-2xl font-bold text-gray-900">
            ${stats.totalValue.toLocaleString()}
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
            onChange={(e) => setStatusFilter(e.target.value as DisputeStatus | 'all')}
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
            onChange={(e) => setTypeFilter(e.target.value as DisputeType | 'all')}
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

      {/* Disputes List */}
      <div className="space-y-4">
        {filteredDisputes.map((dispute) => (
          <Link
            key={dispute.id}
            className="block rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
            href={`/disputes/${dispute.id}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">{dispute.contractTitle}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[dispute.status]}`}
                  >
                    {dispute.status.replace('_', ' ')}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[dispute.priority]}`}
                  >
                    {dispute.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {typeLabels[dispute.type]} dispute • Contract #{dispute.contractId}
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  ${dispute.amount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">at stake</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                    {dispute.client.name.charAt(0)}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Client:</span>{' '}
                    <span className="font-medium text-gray-900">{dispute.client.name}</span>
                  </div>
                </div>
                <div className="text-gray-300">vs</div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-medium text-green-700">
                    {dispute.freelancer.name.charAt(0)}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Freelancer:</span>{' '}
                    <span className="font-medium text-gray-900">{dispute.freelancer.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                {dispute.assignedTo ? (
                  <span className="text-gray-600">
                    Assigned to: <span className="font-medium">{dispute.assignedTo.name}</span>
                  </span>
                ) : (
                  <button
                    className="font-medium text-indigo-600 hover:text-indigo-700"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Assign to self:', dispute.id);
                    }}
                  >
                    Assign to me
                  </button>
                )}
                <span className="text-gray-400">
                  Updated {new Date(dispute.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredDisputes.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-gray-500">No disputes found matching your filters</p>
        </div>
      )}
    </div>
  );
}
