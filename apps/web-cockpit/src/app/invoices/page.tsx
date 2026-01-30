'use client';

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
  Calendar,
  Building2,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { ReactNode } from 'react';

// Types
type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  projectName?: string;
  isRecurring?: boolean;
}

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/invoices
const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    clientName: 'Acme Corp',
    clientEmail: 'billing@acme.com',
    amount: 5000,
    tax: 450,
    total: 5450,
    status: 'paid',
    issueDate: '2024-12-01',
    dueDate: '2024-12-15',
    paidDate: '2024-12-12',
    projectName: 'Website Redesign',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    clientName: 'TechStart Inc',
    clientEmail: 'accounts@techstart.io',
    amount: 8500,
    tax: 765,
    total: 9265,
    status: 'sent',
    issueDate: '2024-12-05',
    dueDate: '2024-12-19',
    projectName: 'Mobile App Phase 1',
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    clientName: 'Design Studio',
    clientEmail: 'hello@designstudio.co',
    amount: 2400,
    tax: 216,
    total: 2616,
    status: 'overdue',
    issueDate: '2024-11-20',
    dueDate: '2024-12-04',
    projectName: 'Brand Identity',
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    clientName: 'Global Enterprises',
    clientEmail: 'finance@globalent.com',
    amount: 12000,
    tax: 1080,
    total: 13080,
    status: 'viewed',
    issueDate: '2024-12-10',
    dueDate: '2024-12-24',
    projectName: 'E-commerce Platform',
  },
  {
    id: '5',
    invoiceNumber: 'INV-2024-005',
    clientName: 'Startup Labs',
    clientEmail: 'pay@startuplabs.io',
    amount: 3200,
    tax: 288,
    total: 3488,
    status: 'draft',
    issueDate: '2024-12-14',
    dueDate: '2024-12-28',
    projectName: 'MVP Development',
  },
  {
    id: '6',
    invoiceNumber: 'INV-2024-006',
    clientName: 'Acme Corp',
    clientEmail: 'billing@acme.com',
    amount: 1800,
    tax: 162,
    total: 1962,
    status: 'paid',
    issueDate: '2024-11-15',
    dueDate: '2024-11-29',
    paidDate: '2024-11-28',
    projectName: 'Monthly Retainer',
    isRecurring: true,
  },
];

const statusConfig: Record<
  InvoiceStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: Trash2 },
};

const tabs = [
  { id: 'all', label: 'All Invoices' },
  { id: 'draft', label: 'Drafts' },
  { id: 'sent', label: 'Sent' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
];

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Filter invoices
  const filteredInvoices = mockInvoices.filter((invoice) => {
    const matchesTab = activeTab === 'all' || invoice.status === activeTab;
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.projectName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Stats
  const stats = {
    total: mockInvoices.length,
    draft: mockInvoices.filter((i) => i.status === 'draft').length,
    outstanding: mockInvoices
      .filter((i) => ['sent', 'viewed', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + i.total, 0),
    overdue: mockInvoices
      .filter((i) => i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0),
    paidThisMonth: mockInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0),
  };

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
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map((i) => i.id)));
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getDueDateDisplay = (invoice: Invoice, daysUntilDue: number): ReactNode => {
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

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">Create and manage your invoices</p>
        </div>
        <Link
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
          href="/invoices/new"
        >
          <Plus className="h-5 w-5" />
          Create Invoice
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <FileText className="h-4 w-4" />
            Drafts
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.draft}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Outstanding
          </div>
          <div className="text-2xl font-bold text-blue-600">
            ${stats.outstanding.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="h-4 w-4" />
            Overdue
          </div>
          <div className="text-2xl font-bold text-red-600">${stats.overdue.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            Paid This Month
          </div>
          <div className="text-2xl font-bold text-green-600">
            ${stats.paidThisMonth.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id !== 'all' && (
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {mockInvoices.filter((i) => i.status === tab.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search invoices..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
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

      {/* Bulk Actions */}
      {selectedInvoices.size > 0 && (
        <div className="mb-4 flex items-center gap-4 rounded-lg bg-indigo-50 p-3">
          <span className="text-sm text-indigo-700">{selectedInvoices.size} selected</span>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
              <Send className="h-4 w-4" />
              Send All
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Download
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  checked={
                    selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Due Date
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInvoices.map((invoice) => {
              const StatusIcon = statusConfig[invoice.status].icon;
              const daysUntilDue = getDaysUntilDue(invoice.dueDate);

              return (
                <tr key={invoice.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      checked={selectedInvoices.has(invoice.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      type="checkbox"
                      onChange={() => toggleSelect(invoice.id)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Link className="hover:text-indigo-600" href={`/invoices/${invoice.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
                        {invoice.isRecurring && <RefreshCw className="h-3.5 w-3.5 text-gray-400" />}
                      </div>
                      {invoice.projectName && (
                        <div className="text-sm text-gray-500">{invoice.projectName}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <Building2 className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{invoice.clientName}</div>
                        <div className="text-sm text-gray-500">{invoice.clientEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-900">
                      ${invoice.total.toLocaleString()}
                    </div>
                    {invoice.tax > 0 && (
                      <div className="text-xs text-gray-500">
                        Tax: ${invoice.tax.toLocaleString()}
                      </div>
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
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-gray-900">{formatDate(invoice.dueDate)}</div>
                        {getDueDateDisplay(invoice, daysUntilDue)}
                      </div>
                    </div>
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
                            href={`/invoices/${invoice.id}`}
                          >
                            <Eye className="h-4 w-4" />
                            View Invoice
                          </Link>
                          <Link
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            href={`/invoices/${invoice.id}/edit`}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Link>
                          {invoice.status === 'draft' && (
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <Send className="h-4 w-4" />
                              Send Invoice
                            </button>
                          )}
                          {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <MailCheck className="h-4 w-4" />
                              Send Reminder
                            </button>
                          )}
                          {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
                            <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-gray-50">
                              <DollarSign className="h-4 w-4" />
                              Record Payment
                            </button>
                          )}
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Copy className="h-4 w-4" />
                            Duplicate
                          </button>
                          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Download className="h-4 w-4" />
                            Download PDF
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
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">No invoices found</h3>
            <p className="mb-4 text-gray-500">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating your first invoice'}
            </p>
            {!searchQuery && (
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                href="/invoices/new"
              >
                <Plus className="h-5 w-5" />
                Create Invoice
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
