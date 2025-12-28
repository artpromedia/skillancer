/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Client Financials Component
 *
 * Displays financial overview for a client including
 * revenue, invoices, and payment history.
 *
 * @module components/clients/client-financials
 */

import {
  DollarSign,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  project?: string;
  link?: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  invoiceNumber?: string;
  reference?: string;
}

export interface ClientFinancialsProps {
  clientId: string;
  totalRevenue: number;
  outstandingBalance: number;
  averageProjectValue: number;
  revenueGrowth: number; // percentage
  invoices: Invoice[];
  payments: Payment[];
  currency?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInvoiceStatusColor(status: Invoice['status']): string {
  const colors: Record<Invoice['status'], string> = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500',
  };
  return colors[status];
}

function getInvoiceStatusIcon(status: Invoice['status']) {
  const icons: Record<Invoice['status'], typeof CheckCircle> = {
    draft: FileText,
    sent: Clock,
    paid: CheckCircle,
    overdue: AlertCircle,
    cancelled: FileText,
  };
  return icons[status];
}

// ============================================================================
// Stats Card Component
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  variant = 'default',
}: Readonly<{
  icon: typeof DollarSign;
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'warning' | 'success';
}>) {
  const variantStyles = {
    default: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    success: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${variantStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {Math.abs(trend)}%{trendLabel && <span className="text-gray-400">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Invoice Row Component
// ============================================================================

function InvoiceRow({ invoice, currency }: Readonly<{ invoice: Invoice; currency: string }>) {
  const StatusIcon = getInvoiceStatusIcon(invoice.status);
  const isOverdue =
    invoice.status === 'overdue' ||
    (invoice.status === 'sent' && new Date(invoice.dueDate) < new Date());

  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-0 dark:border-gray-700">
      <div className={`rounded-lg p-2 ${getInvoiceStatusColor(invoice.status)}`}>
        <StatusIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">{invoice.number}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getInvoiceStatusColor(invoice.status)}`}
          >
            {invoice.status}
          </span>
          {isOverdue && invoice.status !== 'overdue' && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Overdue
            </span>
          )}
        </div>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">
          {invoice.project || 'General'}
          {' · '}
          Due {formatDate(invoice.dueDate)}
        </p>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900 dark:text-white">
          {formatCurrency(invoice.amount, currency)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(invoice.date)}</p>
      </div>
      <div className="flex items-center gap-1">
        {invoice.link && (
          <a
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            href={invoice.link}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Payment Row Component
// ============================================================================

function PaymentRow({ payment, currency }: Readonly<{ payment: Payment; currency: string }>) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-0 dark:border-gray-700">
      <div className="rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 dark:text-white">
          {formatCurrency(payment.amount, currency)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {payment.method}
          {payment.invoiceNumber && ` · Invoice ${payment.invoiceNumber}`}
          {payment.reference && ` · Ref: ${payment.reference}`}
        </p>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{formatDate(payment.date)}</div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClientFinancials({
  clientId,
  totalRevenue,
  outstandingBalance,
  averageProjectValue,
  revenueGrowth,
  invoices,
  payments,
  currency = 'USD',
}: Readonly<ClientFinancialsProps>) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState<Invoice['status'] | 'all'>('all');

  const filteredInvoices =
    invoiceFilter === 'all' ? invoices : invoices.filter((inv) => inv.status === invoiceFilter);

  const paidTotal = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const pendingTotal = invoices
    .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0);

  function getTabContent() {
    if (activeTab === 'invoices') {
      if (filteredInvoices.length > 0) {
        return (
          <div>
            {filteredInvoices.map((invoice) => (
              <InvoiceRow key={invoice.id} currency={currency} invoice={invoice} />
            ))}
          </div>
        );
      }
      return (
        <div className="py-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-2 text-gray-500 dark:text-gray-400">No invoices found</p>
        </div>
      );
    }

    if (payments.length > 0) {
      return (
        <div>
          {payments.map((payment) => (
            <PaymentRow key={payment.id} currency={currency} payment={payment} />
          ))}
        </div>
      );
    }
    return (
      <div className="py-8 text-center">
        <DollarSign className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-gray-500 dark:text-gray-400">No payments recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          trend={revenueGrowth}
          trendLabel="vs last year"
          value={formatCurrency(totalRevenue, currency)}
          variant="success"
        />
        <StatCard
          icon={Clock}
          label="Outstanding"
          value={formatCurrency(outstandingBalance, currency)}
          variant={outstandingBalance > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Project Value"
          value={formatCurrency(averageProjectValue, currency)}
        />
        <StatCard icon={FileText} label="Invoices" value={`${invoices.length}`} />
      </div>

      {/* Revenue Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Revenue Breakdown</h3>
        <div className="flex h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="bg-green-500"
            style={{ width: `${(paidTotal / (paidTotal + pendingTotal)) * 100 || 0}%` }}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${(pendingTotal / (paidTotal + pendingTotal)) * 100 || 0}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Paid: {formatCurrency(paidTotal, currency)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Pending: {formatCurrency(pendingTotal, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <div className="flex">
            <button
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              onClick={() => setActiveTab('invoices')}
            >
              Invoices ({invoices.length})
            </button>
            <button
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'payments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              onClick={() => setActiveTab('payments')}
            >
              Payments ({payments.length})
            </button>
          </div>

          {activeTab === 'invoices' && (
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={invoiceFilter}
                onChange={(e) => setInvoiceFilter(e.target.value as Invoice['status'] | 'all')}
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          )}
        </div>

        <div className="p-4">{getTabContent()}</div>
      </div>
    </div>
  );
}

export default ClientFinancials;
