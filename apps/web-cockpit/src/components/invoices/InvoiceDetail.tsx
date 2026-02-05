'use client';

/**
 * InvoiceDetail Component
 *
 * Displays detailed view of a single invoice with actions and activity timeline.
 */

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
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Printer,
  FileText,
  CreditCard,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

import type { InvoiceStatus } from '@/lib/api/services/invoicing';

import {
  useInvoice,
  useDeleteInvoice,
  useSendInvoice,
  useDuplicateInvoice,
  useMarkInvoicePaid,
  useCancelInvoice,
  useSendReminder,
} from '@/hooks/api/use-invoicing';
import { invoicingService } from '@/lib/api/services/invoicing';

// =============================================================================
// Types
// =============================================================================

interface InvoiceDetailProps {
  invoiceId: string;
}

interface InvoiceActivity {
  id: string;
  type: 'created' | 'sent' | 'viewed' | 'reminder' | 'paid' | 'updated' | 'payment';
  description: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

// =============================================================================
// Constants
// =============================================================================

const statusConfig: Record<
  InvoiceStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: FileText },
  pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
  sent: { label: 'Sent', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Send },
  viewed: { label: 'Viewed', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Eye },
  paid: { label: 'Paid', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Trash2 },
  refunded: {
    label: 'Refunded',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: RefreshCw,
  },
};

const activityIcons: Record<string, React.ElementType> = {
  created: FileText,
  sent: Send,
  viewed: Eye,
  reminder: Clock,
  paid: CheckCircle,
  updated: Edit,
  payment: DollarSign,
};

// =============================================================================
// Component
// =============================================================================

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [_showPaymentModal, _setShowPaymentModal] = useState(false);

  // API Queries
  const { data: invoiceData, isLoading, error, refetch } = useInvoice(invoiceId);

  // Mutations
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const duplicateInvoice = useDuplicateInvoice();
  const markPaid = useMarkInvoicePaid();
  const cancelInvoice = useCancelInvoice();
  const sendReminder = useSendReminder();

  const invoice = invoiceData?.data;

  // Handlers
  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      await deleteInvoice.mutateAsync(invoiceId);
      router.push('/invoices');
    }
  };

  const handleSend = async () => {
    await sendInvoice.mutateAsync({ id: invoiceId });
    setShowMenu(false);
  };

  const handleDuplicate = async () => {
    const result = await duplicateInvoice.mutateAsync(invoiceId);
    const newInvoice = result.data;
    if (newInvoice) {
      router.push(`/invoices/${newInvoice.id}`);
    }
  };

  const handleMarkPaid = async () => {
    await markPaid.mutateAsync({ id: invoiceId });
    setShowMenu(false);
  };

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel this invoice?')) {
      await cancelInvoice.mutateAsync({ id: invoiceId });
      setShowMenu(false);
    }
  };

  const handleSendReminder = async () => {
    await sendReminder.mutateAsync(invoiceId);
    setShowMenu(false);
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await invoicingService.generatePdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Error state
  if (error || !invoice) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-red-700">Failed to load invoice. Please try again.</p>
        <button
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const status = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  // Mock activity - in production this would come from the API
  const activity: InvoiceActivity[] = [
    {
      id: '1',
      type: 'created',
      description: 'Invoice created',
      timestamp: invoice.createdAt,
    },
    ...(invoice.sentAt
      ? [
          {
            id: '2',
            type: 'sent' as const,
            description: 'Invoice sent',
            timestamp: invoice.sentAt,
          },
        ]
      : []),
    ...(invoice.viewedAt
      ? [
          {
            id: '3',
            type: 'viewed' as const,
            description: 'Invoice viewed by client',
            timestamp: invoice.viewedAt,
          },
        ]
      : []),
    ...(invoice.paidDate
      ? [
          {
            id: '4',
            type: 'paid' as const,
            description: 'Invoice paid',
            timestamp: invoice.paidDate,
          },
        ]
      : []),
  ];

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
                      status.bgColor,
                      status.color
                    )}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Created on {formatDate(invoice.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                onClick={() => void handleDownloadPdf()}
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              {invoice.status === 'draft' && (
                <button
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                  disabled={sendInvoice.isPending}
                  onClick={() => void handleSend()}
                >
                  {sendInvoice.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Invoice
                </button>
              )}
              <div className="relative">
                <button
                  className="rounded-lg border border-gray-200 p-2 transition-colors hover:bg-gray-50"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreVertical className="h-5 w-5 text-gray-500" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                    {invoice.status === 'draft' && (
                      <Link
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        href={`/invoices/${invoiceId}/edit`}
                      >
                        <Edit className="h-4 w-4" />
                        Edit Invoice
                      </Link>
                    )}
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => void handleDuplicate()}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                    {['sent', 'viewed', 'overdue'].includes(invoice.status) && (
                      <>
                        <button
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => void handleSendReminder()}
                        >
                          <Clock className="h-4 w-4" />
                          Send Reminder
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => _setShowPaymentModal(true)}
                        >
                          <CreditCard className="h-4 w-4" />
                          Record Payment
                        </button>
                        <button
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50"
                          onClick={() => void handleMarkPaid()}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark as Paid
                        </button>
                      </>
                    )}
                    {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                      <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => void handleCancel()}
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancel Invoice
                      </button>
                    )}
                    {invoice.status === 'draft' && (
                      <button
                        className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => void handleDelete()}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Invoice Preview */}
            <div ref={printRef} className="rounded-xl border border-gray-200 bg-white p-8">
              {/* Header */}
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                  <p className="text-gray-500">{invoice.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Issue Date</div>
                  <div className="font-medium text-gray-900">{formatDate(invoice.issueDate)}</div>
                  <div className="mt-2 text-sm text-gray-500">Due Date</div>
                  <div className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</div>
                </div>
              </div>

              {/* Client Info */}
              <div className="mb-8 rounded-lg bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-500">Bill To</div>
                <div className="mt-2 flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{invoice.clientId}</div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="mb-8">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 text-left text-sm font-medium text-gray-500">
                        Description
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-gray-500">Qty</th>
                      <th className="pb-3 text-right text-sm font-medium text-gray-500">Rate</th>
                      <th className="pb-3 text-right text-sm font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-4 text-gray-900">{item.description}</td>
                        <td className="py-4 text-right text-gray-900">{item.quantity}</td>
                        <td className="py-4 text-right text-gray-900">
                          {formatCurrency(item.unitPrice, invoice.currency)}
                        </td>
                        <td className="py-4 text-right font-medium text-gray-900">
                          {formatCurrency(item.total, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900">
                      {formatCurrency(invoice.subtotal, invoice.currency)}
                    </span>
                  </div>
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Tax</span>
                      <span className="text-gray-900">
                        {formatCurrency(invoice.taxAmount, invoice.currency)}
                      </span>
                    </div>
                  )}
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-green-600">
                        -{formatCurrency(invoice.discountAmount, invoice.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 py-2">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </span>
                  </div>
                  {invoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-500">Amount Paid</span>
                        <span className="text-green-600">
                          -{formatCurrency(invoice.amountPaid, invoice.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 py-2">
                        <span className="font-semibold text-gray-900">Amount Due</span>
                        <span className="font-semibold text-indigo-600">
                          {formatCurrency(invoice.amountDue, invoice.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <div className="text-sm font-medium text-gray-500">Notes</div>
                  <p className="mt-2 text-gray-700">{invoice.notes}</p>
                </div>
              )}

              {/* Terms */}
              {invoice.terms && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-500">Terms</div>
                  <p className="mt-2 text-gray-700">{invoice.terms}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Amount Summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Payment Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid</span>
                  <span className="text-green-600">
                    {formatCurrency(invoice.amountPaid, invoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="font-medium text-gray-900">Amount Due</span>
                  <span className="text-xl font-bold text-indigo-600">
                    {formatCurrency(invoice.amountDue, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Activity</h3>
              <div className="space-y-4">
                {activity.map((item, index) => {
                  const ActivityIcon = activityIcons[item.type] || FileText;
                  return (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                          <ActivityIcon className="h-4 w-4 text-gray-500" />
                        </div>
                        {index < activity.length - 1 && (
                          <div className="absolute left-4 top-8 h-full w-px bg-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="text-sm font-medium text-gray-900">{item.description}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payments */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Payments</h3>
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(payment.amount, invoice.currency)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.method} • {formatDate(payment.paidAt)}
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceDetail;
