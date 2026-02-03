'use client';

/**
 * InvoicePDF Component
 *
 * Printable invoice template optimized for PDF generation and printing.
 * Can be used client-side for preview or server-side for PDF generation.
 */

import { forwardRef } from 'react';

// =============================================================================
// Types
// =============================================================================

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
}

interface BusinessInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  logo?: string;
  taxId?: string;
}

interface ClientInfo {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

interface InvoicePDFProps {
  invoiceNumber: string;
  status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  currency: string;
  client: ClientInfo;
  business: BusinessInfo;
  lineItems: LineItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount: number;
  discountAmount?: number;
  discountLabel?: string;
  total: number;
  amountPaid?: number;
  amountDue: number;
  notes?: string;
  terms?: string;
  footer?: string;
  paymentInstructions?: string;
  accentColor?: string;
}

// =============================================================================
// Component
// =============================================================================

export const InvoicePDF = forwardRef<HTMLDivElement, InvoicePDFProps>(
  (
    {
      invoiceNumber,
      status,
      issueDate,
      dueDate,
      paidDate,
      currency,
      client,
      business,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount = 0,
      discountLabel,
      total,
      amountPaid = 0,
      amountDue,
      notes,
      terms,
      footer,
      paymentInstructions,
      accentColor = '#4F46E5',
    },
    ref
  ) => {
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    };

    const statusColors: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: '#F3F4F6', text: '#374151', label: 'DRAFT' },
      sent: { bg: '#DBEAFE', text: '#1D4ED8', label: 'SENT' },
      viewed: { bg: '#E9D5FF', text: '#7C3AED', label: 'VIEWED' },
      paid: { bg: '#D1FAE5', text: '#059669', label: 'PAID' },
      overdue: { bg: '#FEE2E2', text: '#DC2626', label: 'OVERDUE' },
      cancelled: { bg: '#F3F4F6', text: '#6B7280', label: 'CANCELLED' },
    };

    const statusStyle = status ? statusColors[status] : null;

    return (
      <div
        ref={ref}
        className="mx-auto max-w-[800px] bg-white p-8 font-sans text-gray-900"
        style={{ fontSize: '14px', lineHeight: '1.5' }}
      >
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            {business.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- Using img for PDF rendering compatibility
              <img alt={business.name} className="mb-4 h-16" src={business.logo} />
            ) : (
              <div className="mb-4 text-2xl font-bold" style={{ color: accentColor }}>
                {business.name}
              </div>
            )}
            <div className="text-sm text-gray-600">
              {business.address && <div>{business.address}</div>}
              {business.phone && <div>{business.phone}</div>}
              {business.email && <div>{business.email}</div>}
              {business.website && <div>{business.website}</div>}
              {business.taxId && <div>Tax ID: {business.taxId}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-3">
              <h1 className="text-3xl font-bold" style={{ color: accentColor }}>
                INVOICE
              </h1>
              {statusStyle && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                >
                  {statusStyle.label}
                </span>
              )}
            </div>
            <div className="mt-2 text-xl font-semibold text-gray-700">{invoiceNumber}</div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mb-8 grid grid-cols-2 gap-8">
          {/* Bill To */}
          <div>
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              Bill To
            </div>
            <div className="font-semibold text-gray-900">{client.company || client.name}</div>
            {client.company && <div className="text-gray-600">{client.name}</div>}
            {client.address && (
              <div className="whitespace-pre-line text-gray-600">{client.address}</div>
            )}
            {client.email && <div className="text-gray-600">{client.email}</div>}
            {client.phone && <div className="text-gray-600">{client.phone}</div>}
            {client.taxId && <div className="text-gray-600">Tax ID: {client.taxId}</div>}
          </div>

          {/* Invoice Details */}
          <div className="text-right">
            <div className="space-y-2">
              <div className="flex justify-end gap-4">
                <span className="text-gray-500">Issue Date:</span>
                <span className="font-medium">{formatDate(issueDate)}</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-gray-500">Due Date:</span>
                <span className="font-medium">{formatDate(dueDate)}</span>
              </div>
              {paidDate && (
                <div className="flex justify-end gap-4">
                  <span className="text-gray-500">Paid Date:</span>
                  <span className="font-medium text-green-600">{formatDate(paidDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: accentColor }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">
                  Description
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">
                  Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-4 py-3 text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-8 flex justify-end">
          <div className="w-72">
            <div className="flex justify-between border-b border-gray-200 py-2">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between border-b border-gray-200 py-2">
                <span className="text-gray-500">Tax {taxRate ? `(${taxRate}%)` : ''}</span>
                <span className="text-gray-900">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between border-b border-gray-200 py-2">
                <span className="text-gray-500">{discountLabel || 'Discount'}</span>
                <span className="text-green-600">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div
              className="flex justify-between py-3"
              style={{ backgroundColor: accentColor + '10' }}
            >
              <span className="text-lg font-bold" style={{ color: accentColor }}>
                Total
              </span>
              <span className="text-lg font-bold" style={{ color: accentColor }}>
                {formatCurrency(total)}
              </span>
            </div>
            {amountPaid > 0 && (
              <>
                <div className="flex justify-between border-b border-gray-200 py-2">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="text-green-600">-{formatCurrency(amountPaid)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-semibold text-gray-900">Amount Due</span>
                  <span className="text-xl font-bold" style={{ color: accentColor }}>
                    {formatCurrency(amountDue)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Instructions */}
        {paymentInstructions && (
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              Payment Instructions
            </div>
            <div className="whitespace-pre-line text-sm text-gray-700">{paymentInstructions}</div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="mb-6">
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              Notes
            </div>
            <div className="whitespace-pre-line text-sm text-gray-700">{notes}</div>
          </div>
        )}

        {/* Terms */}
        {terms && (
          <div className="mb-6">
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              Terms & Conditions
            </div>
            <div className="whitespace-pre-line text-sm text-gray-700">{terms}</div>
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="mt-8 border-t border-gray-200 pt-4 text-center text-sm text-gray-500">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

InvoicePDF.displayName = 'InvoicePDF';

export default InvoicePDF;
