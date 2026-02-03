'use client';

/**
 * InvoiceList Component
 *
 * Displays a list of all invoices with filtering, pagination, and actions.
 * Integrates with the real invoicing API.
 */

import { cn } from '@skillancer/ui';
import {
  Plus,
  Search,
  Filter,
  Download,
  MoreVertical,
  Send,
  Eye,
  Edit,
  Copy,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

import type { Invoice, InvoiceSummary, InvoiceStatus } from '@/lib/api/services/invoicing';

import {
  useInvoices,
  useInvoiceSummary,
  useDeleteInvoice,
  useSendInvoice,
  useDuplicateInvoice,
} from '@/hooks/api/use-invoicing';

// =============================================================================
// Types
// =============================================================================

interface InvoiceListProps {
  initialStatus?: InvoiceStatus;
  clientId?: string;
  projectId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const statusConfig: Record<
  InvoiceStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: Trash2 },
  refunded: { label: 'Refunded', color: 'bg-orange-100 text-orange-700', icon: RefreshCw },
};

const tabs = [
  { id: 'all', label: 'All Invoices' },
  { id: 'draft', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
];

// =============================================================================
// Component
// =============================================================================

export function InvoiceList({ initialStatus, clientId, projectId }: InvoiceListProps) {
  const [activeTab, setActiveTab] = useState(initialStatus || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  // API Queries
  const {
    data: invoicesData,
    isLoading,
    error,
    refetch,
  } = useInvoices({
    page,
    limit,
    status: activeTab === 'all' ? undefined : (activeTab as InvoiceStatus),
    search: searchQuery || undefined,
    clientId,
    projectId,
  });

  const { data: summaryData } = useInvoiceSummary();

  // Mutations
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const duplicateInvoice = useDuplicateInvoice();

  // Extract data with proper type narrowing
  const invoices = (invoicesData?.data ?? []) as unknown as Invoice[];
  const totalCount =
    (invoicesData?.pagination as unknown as { total?: number } | undefined)?.total ?? 0;
  const totalPages = Math.ceil(totalCount / limit);
  const summaryRaw = summaryData?.data;

  // Cast summary data safely
  const summary = summaryRaw ? (summaryRaw as unknown as InvoiceSummary) : undefined;

  // Stats from summary
  const stats = useMemo((): {
    drafts: number;
    outstanding: number;
    overdue: number;
    paidThisMonth: number;
  } => {
    if (!summary) {
      return {
        drafts: 0,
        outstanding: 0,
        overdue: 0,
        paidThisMonth: 0,
      };
    }
    return {
      drafts: summary.byStatus?.draft?.count ?? 0,
      outstanding: summary.outstandingAmount ?? 0,
      overdue: summary.overdueAmount ?? 0,
      paidThisMonth: summary.paidAmount ?? 0,
    };
  }, [summary]);

  // Handlers
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvoices(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map((i: Invoice) => i.id)));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      await deleteInvoice.mutateAsync(id);
      setActiveMenu(null);
    }
  };

  const handleSend = async (id: string) => {
    await sendInvoice.mutateAsync({ id });
    setActiveMenu(null);
  };

  const handleDuplicate = async (id: string) => {
    await duplicateInvoice.mutateAsync(id);
    setActiveMenu(null);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getDueDateDisplay = (invoice: Invoice) => {
    const daysUntilDue = getDaysUntilDue(invoice.dueDate);

    if (invoice.status === 'paid' && invoice.paidDate) {
      return <div className="text-xs text-green-600">Paid {formatDate(invoice.paidDate)}</div>;
    }
    if (invoice.status === 'overdue') {
      return <div className="text-xs text-red-600">{Math.abs(daysUntilDue)} days overdue</div>;
    }
    if (daysUntilDue <= 3 && daysUntilDue > 0) {
      return <div className="text-xs text-amber-600">Due in {daysUntilDue} days</div>;
    }
    return null;
  };

  // Loading state
  if (isLoading && !invoices.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-red-700">Failed to load invoices. Please try again.</p>
        <button
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <FileText className="h-4 w-4" />
            Drafts
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.drafts}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Outstanding
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(stats.outstanding)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="h-4 w-4" />
            Overdue
          </div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdue)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            Paid This Month
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(stats.paidThisMonth)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Search invoices..."
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors',
              showFilters
                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                  className="rounded border-gray-300"
                  type="checkbox"
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Invoice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Due Date
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center" colSpan={7}>
                  <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No invoices found</p>
                  <Link
                    className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                    href="/invoices/new"
                  >
                    <Plus className="h-4 w-4" />
                    Create your first invoice
                  </Link>
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const status = statusConfig[invoice.status] || statusConfig.draft;
                const StatusIcon = status.icon;

                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        checked={selectedInvoices.has(invoice.id)}
                        className="rounded border-gray-300"
                        type="checkbox"
                        onChange={() => toggleSelect(invoice.id)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        className="font-medium text-gray-900 hover:text-indigo-600"
                        href={`/invoices/${invoice.id}`}
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      {invoice.projectId && <div className="text-sm text-gray-500">Project</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{invoice.clientId}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                          status.color
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </div>
                      {invoice.amountDue > 0 && invoice.amountDue < invoice.total && (
                        <div className="text-xs text-gray-500">
                          {formatCurrency(invoice.amountDue, invoice.currency)} due
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{formatDate(invoice.dueDate)}</div>
                      {getDueDateDisplay(invoice)}
                    </td>
                    <td className="relative px-4 py-4">
                      <button
                        className="rounded p-1 hover:bg-gray-100"
                        onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                      >
                        <MoreVertical className="h-5 w-5 text-gray-400" />
                      </button>

                      {activeMenu === invoice.id && (
                        <div className="absolute right-4 top-12 z-10 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                          <Link
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            href={`/invoices/${invoice.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                          {invoice.status === 'draft' && (
                            <>
                              <Link
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                href={`/invoices/${invoice.id}/edit`}
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </Link>
                              <button
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => void handleSend(invoice.id)}
                              >
                                <Send className="h-4 w-4" />
                                Send
                              </button>
                            </>
                          )}
                          <button
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => void handleDuplicate(invoice.id)}
                          >
                            <Copy className="h-4 w-4" />
                            Duplicate
                          </button>
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <Download className="h-4 w-4" />
                            Download PDF
                          </button>
                          {invoice.status === 'draft' && (
                            <button
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              onClick={() => void handleDelete(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of{' '}
              {totalCount} invoices
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-gray-200 p-2 hover:bg-white disabled:opacity-50"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                className="rounded-lg border border-gray-200 p-2 hover:bg-white disabled:opacity-50"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvoiceList;
