'use client';

import { cn } from '@skillancer/ui';
import {
  Plus,
  Search,
  MoreVertical,
  RefreshCw,
  Calendar,
  DollarSign,
  Clock,
  Pause,
  Play,
  Edit,
  Trash2,
  Eye,
  Copy,
  Building2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Types
type RecurringStatus = 'active' | 'paused' | 'ended' | 'draft';
type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

interface RecurringInvoice {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  amount: number;
  frequency: RecurringFrequency;
  status: RecurringStatus;
  nextInvoiceDate: string;
  lastInvoiceDate?: string;
  startDate: string;
  endDate?: string;
  invoicesGenerated: number;
  invoicePrefix: string;
  autoSend: boolean;
}

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/invoices/recurring
const mockRecurringInvoices: RecurringInvoice[] = [
  {
    id: '1',
    title: 'Monthly Retainer',
    clientId: '1',
    clientName: 'Acme Corp',
    amount: 3000,
    frequency: 'monthly',
    status: 'active',
    nextInvoiceDate: '2025-01-01',
    lastInvoiceDate: '2024-12-01',
    startDate: '2024-01-01',
    invoicesGenerated: 12,
    invoicePrefix: 'RET',
    autoSend: true,
  },
  {
    id: '2',
    title: 'Weekly Consulting',
    clientId: '2',
    clientName: 'TechStart Inc',
    amount: 1500,
    frequency: 'weekly',
    status: 'active',
    nextInvoiceDate: '2024-12-21',
    lastInvoiceDate: '2024-12-14',
    startDate: '2024-10-01',
    invoicesGenerated: 11,
    invoicePrefix: 'CON',
    autoSend: true,
  },
  {
    id: '3',
    title: 'Quarterly Support',
    clientId: '3',
    clientName: 'Design Studio',
    amount: 5000,
    frequency: 'quarterly',
    status: 'paused',
    nextInvoiceDate: '2025-01-01',
    lastInvoiceDate: '2024-10-01',
    startDate: '2024-01-01',
    invoicesGenerated: 4,
    invoicePrefix: 'SUP',
    autoSend: false,
  },
  {
    id: '4',
    title: 'Annual License',
    clientId: '4',
    clientName: 'Global Enterprises',
    amount: 12000,
    frequency: 'yearly',
    status: 'active',
    nextInvoiceDate: '2025-06-01',
    lastInvoiceDate: '2024-06-01',
    startDate: '2023-06-01',
    invoicesGenerated: 2,
    invoicePrefix: 'LIC',
    autoSend: true,
  },
];

const statusConfig: Record<
  RecurringStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  paused: { label: 'Paused', color: 'bg-amber-100 text-amber-700', icon: Pause },
  ended: { label: 'Ended', color: 'bg-gray-100 text-gray-600', icon: AlertCircle },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: Edit },
};

const frequencyLabels: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default function RecurringInvoicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecurringStatus | 'all'>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Filter invoices
  const filteredInvoices = mockRecurringInvoices.filter((invoice) => {
    const matchesSearch =
      invoice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const activeCount = mockRecurringInvoices.filter((i) => i.status === 'active').length;
  const totalMonthlyValue = mockRecurringInvoices
    .filter((i) => i.status === 'active')
    .reduce((sum, i) => {
      switch (i.frequency) {
        case 'weekly':
          return sum + i.amount * 4.33;
        case 'biweekly':
          return sum + i.amount * 2.17;
        case 'monthly':
          return sum + i.amount;
        case 'quarterly':
          return sum + i.amount / 3;
        case 'yearly':
          return sum + i.amount / 12;
        default:
          return sum;
      }
    }, 0);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilNext = (nextDate: string) => {
    const next = new Date(nextDate);
    const today = new Date();
    return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Invoices</h1>
          <p className="text-gray-500">Automate your regular billing</p>
        </div>
        <Link
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
          href="/invoices/recurring/new"
        >
          <Plus className="h-5 w-5" />
          New Recurring Invoice
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4" />
            Active Recurring
          </div>
          <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            Est. Monthly Revenue
          </div>
          <div className="text-2xl font-bold text-green-600">
            ${Math.round(totalMonthlyValue).toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            Next Invoice
          </div>
          <div className="text-lg font-bold text-gray-900">
            {filteredInvoices
              .filter((i) => i.status === 'active')
              .sort(
                (a, b) =>
                  new Date(a.nextInvoiceDate).getTime() - new Date(b.nextInvoiceDate).getTime()
              )[0]?.nextInvoiceDate
              ? formatDate(
                  filteredInvoices
                    .filter((i) => i.status === 'active')
                    .sort(
                      (a, b) =>
                        new Date(a.nextInvoiceDate).getTime() -
                        new Date(b.nextInvoiceDate).getTime()
                    )[0].nextInvoiceDate
                )
              : 'None scheduled'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search recurring invoices..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'paused', 'ended'] as const).map((status) => (
            <button
              key={status}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Recurring Invoices List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Frequency
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Next Invoice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInvoices.map((invoice) => {
              const StatusIcon = statusConfig[invoice.status].icon;
              const daysUntilNext = getDaysUntilNext(invoice.nextInvoiceDate);

              return (
                <tr key={invoice.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{invoice.title}</div>
                        <div className="text-sm text-gray-500">
                          {invoice.invoicesGenerated} invoices generated
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <Building2 className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="text-gray-900">{invoice.clientName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-900">
                      ${invoice.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock className="h-4 w-4" />
                      {frequencyLabels[invoice.frequency]}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {invoice.status === 'active' ? (
                      <div>
                        <div className="text-gray-900">{formatDate(invoice.nextInvoiceDate)}</div>
                        <div
                          className={cn(
                            'text-xs',
                            daysUntilNext <= 7 ? 'text-amber-600' : 'text-gray-500'
                          )}
                        >
                          {(() => {
                            if (daysUntilNext === 0) return 'Today';
                            if (daysUntilNext === 1) return 'Tomorrow';
                            return `In ${daysUntilNext} days`;
                          })()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        statusConfig[invoice.status].color
                      )}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {statusConfig[invoice.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative">
                      <button
                        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                        onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                      >
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>

                      {activeMenu === invoice.id && (
                        <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          <Link
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            href={`/invoices/recurring/${invoice.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </Link>
                          <Link
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            href={`/invoices/recurring/${invoice.id}/edit`}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Link>
                          {invoice.status === 'active' && (
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <Pause className="h-4 w-4" />
                              Pause
                            </button>
                          )}
                          {invoice.status === 'paused' && (
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-gray-50">
                              <Play className="h-4 w-4" />
                              Resume
                            </button>
                          )}
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Copy className="h-4 w-4" />
                            Duplicate
                          </button>
                          <hr className="my-1 border-gray-100" />
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredInvoices.length === 0 && (
          <div className="p-12 text-center">
            <RefreshCw className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No recurring invoices</h3>
            <p className="mb-4 text-gray-500">Set up automatic billing for your regular clients</p>
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              href="/invoices/recurring/new"
            >
              <Plus className="h-5 w-5" />
              Create Recurring Invoice
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
