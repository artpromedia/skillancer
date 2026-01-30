/* eslint-disable jsx-a11y/label-has-associated-control */
'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Download,
  Send,
  Edit,
  Copy,
  Trash2,
  MoreVertical,
  Eye,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Printer,
  Share2,
  FileText,
  MailCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Types
type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

interface _LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxable: boolean;
}

interface InvoiceActivity {
  id: string;
  type: 'created' | 'sent' | 'viewed' | 'reminder' | 'paid' | 'updated';
  description: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/invoices/:id
const mockInvoice = {
  id: '1',
  invoiceNumber: 'INV-2024-001',
  status: 'sent' as InvoiceStatus,
  issueDate: '2024-12-01',
  dueDate: '2024-12-15',
  paymentTerms: 'Net 14',
  projectName: 'Website Redesign',
  isRecurring: false,
  client: {
    id: '1',
    name: 'John Smith',
    company: 'Acme Corp',
    email: 'billing@acme.com',
    phone: '+1 555-0123',
    address: '123 Main St, San Francisco, CA 94102',
  },
  lineItems: [
    {
      id: '1',
      description: 'Frontend Development - Homepage redesign',
      quantity: 16,
      rate: 150,
      amount: 2400,
      taxable: true,
    },
    {
      id: '2',
      description: 'Backend API Integration',
      quantity: 12,
      rate: 150,
      amount: 1800,
      taxable: true,
    },
    {
      id: '3',
      description: 'UI/UX Design Review',
      quantity: 4,
      rate: 125,
      amount: 500,
      taxable: true,
    },
    {
      id: '4',
      description: 'Content Migration',
      quantity: 8,
      rate: 100,
      amount: 800,
      taxable: true,
    },
  ],
  subtotal: 5500,
  taxRate: 9,
  taxAmount: 450,
  discount: 0,
  total: 5950,
  amountPaid: 0,
  amountDue: 5950,
  notes: 'Payment is due within 14 days. Please include invoice number with your payment.',
  paymentLink: 'https://pay.skillancer.com/inv/abc123',
};

const mockActivity: InvoiceActivity[] = [
  { id: '1', type: 'created', description: 'Invoice created', timestamp: '2024-12-01T10:00:00Z' },
  {
    id: '2',
    type: 'sent',
    description: 'Invoice sent to billing@acme.com',
    timestamp: '2024-12-01T10:05:00Z',
  },
  {
    id: '3',
    type: 'viewed',
    description: 'Invoice viewed by client',
    timestamp: '2024-12-02T14:30:00Z',
  },
  {
    id: '4',
    type: 'reminder',
    description: 'Payment reminder sent',
    timestamp: '2024-12-10T09:00:00Z',
  },
];

const statusConfig: Record<
  InvoiceStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: FileText },
  sent: { label: 'Sent', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Send },
  viewed: { label: 'Viewed', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Eye },
  paid: { label: 'Paid', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Trash2 },
};

export default function InvoiceDetailPage({
  params: _params,
}: Readonly<{ params: { invoiceId: string } }>) {
  const [showMenu, setShowMenu] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showSendReminder, setShowSendReminder] = useState(false);

  const invoice = mockInvoice;
  const activity = mockActivity;
  const StatusIcon = statusConfig[invoice.status].icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDaysUntilDue = () => {
    const due = new Date(invoice.dueDate);
    const today = new Date();
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysUntilDue = getDaysUntilDue();

  const activityIcon = (type: InvoiceActivity['type']) => {
    switch (type) {
      case 'created':
        return <FileText className="h-4 w-4" />;
      case 'sent':
        return <Send className="h-4 w-4" />;
      case 'viewed':
        return <Eye className="h-4 w-4" />;
      case 'reminder':
        return <MailCheck className="h-4 w-4" />;
      case 'paid':
        return <DollarSign className="h-4 w-4" />;
      case 'updated':
        return <Edit className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link className="rounded-lg p-2 transition-colors hover:bg-gray-100" href="/invoices">
                <ArrowLeft className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                      statusConfig[invoice.status].bgColor,
                      statusConfig[invoice.status].color
                    )}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusConfig[invoice.status].label}
                  </span>
                  {invoice.isRecurring && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      <RefreshCw className="h-3 w-3" />
                      Recurring
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{invoice.client.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoice.status === 'draft' && (
                <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
                  <Send className="h-4 w-4" />
                  Send Invoice
                </button>
              )}
              {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
                <>
                  <button
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                    onClick={() => setShowSendReminder(true)}
                  >
                    <MailCheck className="h-4 w-4" />
                    Send Reminder
                  </button>
                  <button
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                    onClick={() => setShowRecordPayment(true)}
                  >
                    <DollarSign className="h-4 w-4" />
                    Record Payment
                  </button>
                </>
              )}
              <div className="relative">
                <button
                  className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreVertical className="h-5 w-5 text-gray-500" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <Link
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      href={`/invoices/${invoice.id}/edit`}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Invoice
                    </Link>
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Share2 className="h-4 w-4" />
                      Share Link
                    </button>
                    <hr className="my-1 border-gray-100" />
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Invoice Preview */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {/* Invoice Header */}
              <div className="border-b border-gray-100 p-6">
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                    <p className="mt-1 text-gray-500">{invoice.invoiceNumber}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">Skillancer</div>
                    <div className="mt-1 text-sm text-gray-500">
                      <div>your-email@example.com</div>
                      <div>San Francisco, CA</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Client & Dates */}
              <div className="grid grid-cols-2 gap-6 border-b border-gray-100 p-6">
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Bill To
                  </div>
                  <div className="font-medium text-gray-900">{invoice.client.company}</div>
                  <div className="text-gray-600">{invoice.client.name}</div>
                  <div className="text-gray-600">{invoice.client.email}</div>
                  {invoice.client.address && (
                    <div className="text-gray-600">{invoice.client.address}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Issue Date
                      </span>
                      <div className="text-gray-900">{formatDate(invoice.issueDate)}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        Due Date
                      </span>
                      <div
                        className={cn(
                          'font-medium',
                          invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'
                        )}
                      >
                        {formatDate(invoice.dueDate)}
                      </div>
                    </div>
                    {invoice.projectName && (
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                          Project
                        </span>
                        <div className="text-gray-900">{invoice.projectName}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="border-b border-gray-100 p-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Description
                      </th>
                      <th className="w-20 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Qty
                      </th>
                      <th className="w-24 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Rate
                      </th>
                      <th className="w-28 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 text-gray-900">{item.description}</td>
                        <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                        <td className="py-3 text-right text-gray-600">${item.rate.toFixed(2)}</td>
                        <td className="py-3 text-right font-medium text-gray-900">
                          ${item.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-6">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>${invoice.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax ({invoice.taxRate}%)</span>
                      <span>${invoice.taxAmount.toLocaleString()}</span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Discount</span>
                        <span>-${invoice.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
                      <span>Total</span>
                      <span>${invoice.total.toLocaleString()}</span>
                    </div>
                    {invoice.amountPaid > 0 && (
                      <>
                        <div className="flex justify-between text-green-600">
                          <span>Amount Paid</span>
                          <span>-${invoice.amountPaid.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-gray-900">
                          <span>Amount Due</span>
                          <span>${invoice.amountDue.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="border-t border-gray-100 p-6">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Notes
                  </div>
                  <p className="text-gray-600">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment Link */}
            {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-3 font-semibold text-gray-900">Payment Link</h3>
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                  <input
                    readOnly
                    className="flex-1 bg-transparent text-sm text-gray-600 outline-none"
                    type="text"
                    value={invoice.paymentLink}
                  />
                  <button className="rounded p-1.5 transition-colors hover:bg-gray-200">
                    <Copy className="h-4 w-4 text-gray-500" />
                  </button>
                  <a
                    className="rounded p-1.5 transition-colors hover:bg-gray-200"
                    href={invoice.paymentLink}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-4 w-4 text-gray-500" />
                  </a>
                </div>
              </div>
            )}

            {/* Due Date Alert */}
            {invoice.status !== 'paid' && invoice.status !== 'draft' && (
              <div
                className={cn(
                  'rounded-xl border p-6',
                  invoice.status === 'overdue'
                    ? 'border-red-200 bg-red-50'
                    : daysUntilDue <= 3
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-blue-200 bg-blue-50'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  {invoice.status === 'overdue' ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-blue-600" />
                  )}
                  <span
                    className={cn(
                      'font-semibold',
                      invoice.status === 'overdue' ? 'text-red-900' : 'text-blue-900'
                    )}
                  >
                    {invoice.status === 'overdue'
                      ? `${Math.abs(daysUntilDue)} days overdue`
                      : daysUntilDue === 0
                        ? 'Due today'
                        : `Due in ${daysUntilDue} days`}
                  </span>
                </div>
                <p
                  className={cn(
                    'text-sm',
                    invoice.status === 'overdue' ? 'text-red-700' : 'text-blue-700'
                  )}
                >
                  {invoice.status === 'overdue'
                    ? 'Consider sending a payment reminder.'
                    : 'Payment expected by ' + formatDate(invoice.dueDate)}
                </p>
              </div>
            )}

            {/* Client Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Client</h3>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{invoice.client.company}</div>
                  <div className="text-sm text-gray-500">{invoice.client.name}</div>
                  <div className="mt-3 space-y-1">
                    <a
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600"
                      href={`mailto:${invoice.client.email}`}
                    >
                      <Mail className="h-4 w-4" />
                      {invoice.client.email}
                    </a>
                    {invoice.client.phone && (
                      <a
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600"
                        href={`tel:${invoice.client.phone}`}
                      >
                        <Phone className="h-4 w-4" />
                        {invoice.client.phone}
                      </a>
                    )}
                    {invoice.client.address && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="mt-0.5 h-4 w-4" />
                        {invoice.client.address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Link
                className="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-700"
                href={`/clients/${invoice.client.id}`}
              >
                View Client Profile
              </Link>
            </div>

            {/* Activity */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Activity</h3>
              <div className="space-y-4">
                {activity.map((item, _index) => (
                  <div key={item.id} className="flex gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        item.type === 'paid'
                          ? 'bg-green-100 text-green-600'
                          : item.type === 'viewed'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {activityIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{item.description}</p>
                      <p className="text-xs text-gray-500">{formatTimestamp(item.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showRecordPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Record Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    defaultValue={invoice.amountDue}
                    type="number"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment Date</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  type="date"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment Method
                </label>
                <select className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Bank Transfer</option>
                  <option>Credit Card</option>
                  <option>PayPal</option>
                  <option>Check</option>
                  <option>Cash</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Check #1234"
                  type="text"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowRecordPayment(false)}
              >
                Cancel
              </button>
              <button className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Reminder Modal */}
      {showSendReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Send Payment Reminder</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue={invoice.client.email}
                  type="text"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue={`Payment Reminder: ${invoice.invoiceNumber}`}
                  type="text"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue={`Hi ${invoice.client.name},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber} for $${invoice.amountDue.toLocaleString()} is due on ${formatDate(invoice.dueDate)}.\n\nPlease let me know if you have any questions.\n\nThank you!`}
                  rows={4}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowSendReminder(false)}
              >
                Cancel
              </button>
              <button className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
                Send Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
