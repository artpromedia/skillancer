'use client';

import { cn } from '@skillancer/ui';
import { Download, Printer, Share2, Mail, Phone, MapPin, Globe } from 'lucide-react';
import { forwardRef, useRef } from 'react';

// Types
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxable?: boolean;
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
}

interface InvoicePreviewProps {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  projectName?: string;
  status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue';
  client: ClientInfo;
  business?: BusinessInfo;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount?: number;
  total: number;
  amountPaid?: number;
  notes?: string;
  paymentTerms?: string;
  paymentInstructions?: string;
  accentColor?: string;
  template?: 'classic' | 'modern' | 'minimal';
  className?: string;
}

// Default business info
const defaultBusiness: BusinessInfo = {
  name: 'Your Business Name',
  email: 'hello@yourbusiness.com',
  phone: '+1 555-0123',
  address: '123 Business St, San Francisco, CA 94102',
  website: 'yourbusiness.com',
};

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
  (
    {
      invoiceNumber,
      issueDate,
      dueDate,
      projectName,
      status,
      client,
      business = defaultBusiness,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discount = 0,
      total,
      amountPaid = 0,
      notes,
      paymentTerms,
      paymentInstructions,
      accentColor = '#4F46E5',
      template: _template = 'modern',
      className,
    },
    ref
  ) => {
    const printRef = useRef<HTMLDivElement>(null);
    const amountDue = total - amountPaid;

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
        currency: 'USD',
      }).format(amount);
    };

    const handlePrint = () => {
      globalThis.print();
    };

    const handleDownload = () => {
      // Feature: Generate and download PDF - not yet implemented
    };

    const handleShare = () => {
      // Feature: Open share dialog - not yet implemented
    };

    return (
      <div className={cn('space-y-4', className)}>
        {/* Action Bar */}
        <div className="flex items-center justify-end gap-2 print:hidden">
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>

        {/* Invoice Document */}
        <div
          ref={ref || printRef}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm print:rounded-none print:border-none print:shadow-none"
          style={{ '--accent-color': accentColor } as React.CSSProperties}
        >
          {/* Header */}
          <div className="p-8 text-white" style={{ backgroundColor: accentColor }}>
            <div className="flex items-start justify-between">
              <div>
                {business.logo ? (
                  <img alt={business.name} className="mb-4 h-12" src={business.logo} />
                ) : (
                  <h1 className="mb-4 text-2xl font-bold">{business.name}</h1>
                )}
                <div className="space-y-1 text-sm opacity-90">
                  {business.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {business.email}
                    </div>
                  )}
                  {business.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {business.phone}
                    </div>
                  )}
                  {business.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {business.address}
                    </div>
                  )}
                  {business.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {business.website}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="mb-2 text-3xl font-bold">INVOICE</div>
                <div className="text-xl opacity-90">{invoiceNumber}</div>
                {status && (
                  <div className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-medium capitalize">
                    {status}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Client & Dates */}
          <div className="grid grid-cols-2 gap-8 border-b border-gray-100 p-8">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Bill To
              </div>
              <div className="space-y-1">
                {client.company && (
                  <div className="text-lg font-semibold text-gray-900">{client.company}</div>
                )}
                <div
                  className={cn(
                    client.company ? 'text-gray-600' : 'text-lg font-semibold text-gray-900'
                  )}
                >
                  {client.name}
                </div>
                <div className="text-gray-600">{client.email}</div>
                {client.phone && <div className="text-gray-600">{client.phone}</div>}
                {client.address && <div className="text-gray-600">{client.address}</div>}
              </div>
            </div>
            <div className="space-y-4 text-right">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Issue Date
                </div>
                <div className="font-medium text-gray-900">{formatDate(issueDate)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Due Date
                </div>
                <div className="font-medium text-gray-900">{formatDate(dueDate)}</div>
              </div>
              {paymentTerms && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Payment Terms
                  </div>
                  <div className="font-medium text-gray-900">{paymentTerms}</div>
                </div>
              )}
              {projectName && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Project
                  </div>
                  <div className="font-medium text-gray-900">{projectName}</div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="p-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderBottomColor: accentColor }}>
                  <th className="py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="w-20 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Qty
                  </th>
                  <th className="w-28 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Rate
                  </th>
                  <th className="w-28 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <div className="text-gray-900">{item.description}</div>
                    </td>
                    <td className="py-4 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-4 text-right text-gray-600">{formatCurrency(item.rate)}</td>
                    <td className="py-4 text-right font-medium text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 pb-8">
            <div className="flex justify-end">
              <div className="w-72">
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tax ({taxRate}%)</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Discount</span>
                      <span className="text-red-500">-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div
                    className="flex justify-between border-t-2 pt-3 text-lg font-bold"
                    style={{ borderTopColor: accentColor }}
                  >
                    <span className="text-gray-900">Total</span>
                    <span style={{ color: accentColor }}>{formatCurrency(total)}</span>
                  </div>
                  {amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Amount Paid</span>
                        <span>-{formatCurrency(amountPaid)}</span>
                      </div>
                      <div
                        className="flex justify-between pt-2 text-xl font-bold"
                        style={{ color: accentColor }}
                      >
                        <span>Amount Due</span>
                        <span>{formatCurrency(amountDue)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Payment Instructions */}
          {(notes || paymentInstructions) && (
            <div className="space-y-6 px-8 pb-8">
              {notes && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Notes
                  </div>
                  <p className="whitespace-pre-wrap text-gray-600">{notes}</p>
                </div>
              )}
              {paymentInstructions && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Payment Instructions
                  </div>
                  <p className="whitespace-pre-wrap text-gray-600">{paymentInstructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            className="px-8 py-4 text-center text-sm"
            style={{ backgroundColor: accentColor, color: 'white' }}
          >
            Thank you for your business!
          </div>
        </div>
      </div>
    );
  }
);

InvoicePreview.displayName = 'InvoicePreview';

export default InvoicePreview;
