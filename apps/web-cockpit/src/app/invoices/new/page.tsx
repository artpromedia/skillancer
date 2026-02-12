'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Paperclip,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useClients } from '@/hooks/api/use-clients';
import { useProjects } from '@/hooks/api/use-projects';
import type { Client, Address } from '@/lib/api/services/clients';
import type { Project } from '@/lib/api/services/projects';

// Types
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

// Helpers
function formatAddress(address?: Address): string | undefined {
  if (!address) return undefined;
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

// Inline hook for unbilled time entries (no dedicated hook available yet)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function useUnbilledTimeEntries(projectId: string) {
  return useQuery<
    Array<{
      id: string;
      description: string;
      hours: number;
      rate: number;
      date: string;
      projectId: string;
    }>
  >({
    queryKey: ['cockpit', 'time', 'unbilled', projectId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/cockpit/time?projectId=${projectId}&billable=true&invoiced=false`
      );
      if (!res.ok) throw new Error('Failed to fetch time entries');
      const json = await res.json();
      return json.data?.items ?? json.items ?? json.data ?? [];
    },
    enabled: !!projectId,
  });
}

export default function NewInvoicePage() {
  const { data: clientsResponse, isLoading: clientsLoading, error: clientsError } = useClients();
  const {
    data: projectsResponse,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjects({ status: 'active' });

  const clients: Client[] = clientsResponse?.data ?? [];
  const projects: Project[] = projectsResponse?.data ?? [];

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2024-007');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, taxable: true },
  ]);
  const [taxRate, setTaxRate] = useState(9);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 14');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showImportTime, setShowImportTime] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'quarterly'>(
    'monthly'
  );

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxableAmount = lineItems
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal + taxAmount - discountAmount;

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: 1, rate: 0, taxable: true },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number | boolean) => {
    setLineItems(lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const { data: unbilledEntries = [] } = useUnbilledTimeEntries(selectedProject);

  const importTimeEntries = () => {
    const projectEntries = unbilledEntries.filter((e) => e.projectId === selectedProject);
    const newItems: LineItem[] = projectEntries.map((entry) => ({
      id: Date.now().toString() + entry.id,
      description: `${entry.description} (${entry.date})`,
      quantity: entry.hours,
      rate: entry.rate,
      taxable: true,
    }));
    setLineItems([...lineItems.filter((item) => item.description !== ''), ...newItems]);
    setShowImportTime(false);
  };

  const isLoading = clientsLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (clientsError || projectsError) {
    const errorMsg = clientsError?.message || projectsError?.message || 'Unknown error';
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <h3 className="text-lg font-medium text-red-800">Failed to load form data</h3>
          <p className="mt-1 text-sm text-red-600">{errorMsg}</p>
        </div>
      </div>
    );
  }

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
                <h1 className="text-xl font-bold text-gray-900">Create Invoice</h1>
                <p className="text-sm text-gray-500">{invoiceNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50">
                <Eye className="h-4 w-4" />
                Preview
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50">
                <Save className="h-4 w-4" />
                Save Draft
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
                <Send className="h-4 w-4" />
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="space-y-6 lg:col-span-2">
            {/* Client Selection */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Bill To</h2>

              {selectedClient ? (
                <div className="flex items-start justify-between rounded-lg bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {selectedClient.displayName || selectedClient.name}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">{selectedClient.name}</div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Mail className="h-3.5 w-3.5" />
                        {selectedClient.email}
                      </div>
                      {selectedClient.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Phone className="h-3.5 w-3.5" />
                          {selectedClient.phone}
                        </div>
                      )}
                      {selectedClient.billingAddress && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {formatAddress(selectedClient.billingAddress)}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                    onClick={() => setSelectedClient(null)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <button
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300"
                    onClick={() => setShowClientDropdown(!showClientDropdown)}
                  >
                    <div className="flex items-center gap-2 text-gray-500">
                      <User className="h-5 w-5" />
                      Select a client
                    </div>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </button>

                  {showClientDropdown && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg">
                      {clients.map((client) => (
                        <button
                          key={client.id}
                          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-50"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientDropdown(false);
                          }}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                            <Building2 className="h-4 w-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {client.displayName || client.name}
                            </div>
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </div>
                        </button>
                      ))}
                      <div className="border-t border-gray-100 p-2">
                        <Link
                          className="flex items-center gap-2 rounded-lg p-2 text-indigo-600 transition-colors hover:bg-indigo-50"
                          href="/clients/new"
                        >
                          <Plus className="h-4 w-4" />
                          Add New Client
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
                <div className="flex gap-2">
                  <button
                    className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm text-indigo-600 transition-colors hover:bg-indigo-100"
                    onClick={() => setShowImportTime(true)}
                  >
                    <Clock className="h-4 w-4" />
                    Import Time Entries
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-3 px-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-1" />
                </div>

                {/* Items */}
                {lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-5">
                      <input
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Item description"
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        min="0"
                        step="0.5"
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(
                            item.id,
                            'quantity',
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          className="w-full rounded-lg border border-gray-200 py-2 pl-7 pr-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          min="0"
                          step="0.01"
                          type="number"
                          value={item.rate}
                          onChange={(e) =>
                            updateLineItem(item.id, 'rate', Number.parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="rounded-lg bg-gray-50 px-3 py-2 font-medium text-gray-900">
                        ${(item.quantity * item.rate).toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        className="p-2 text-gray-400 transition-colors hover:text-red-500"
                        onClick={() => removeLineItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-indigo-600 transition-colors hover:bg-indigo-50"
                onClick={addLineItem}
              >
                <Plus className="h-4 w-4" />
                Add Line Item
              </button>

              {/* Totals */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>${subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Tax</span>
                        <input
                          className="w-16 rounded border border-gray-200 px-2 py-1 text-sm"
                          type="number"
                          value={taxRate}
                          onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-gray-400">%</span>
                      </div>
                      <span className="text-gray-600">${taxAmount.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Discount</span>
                        <span className="text-red-500">-${discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
                      <span>Total</span>
                      <span>${total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Notes & Terms</h2>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Add any notes or payment instructions..."
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="mt-4 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-gray-400" />
                <button className="text-sm text-indigo-600 hover:text-indigo-700">
                  Attach files
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Invoice Details */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Invoice Details</h2>

              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="invoice-number"
                  >
                    Invoice Number
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="invoice-number"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="project-select"
                  >
                    Project
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="project-select"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="issue-date"
                  >
                    Issue Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="issue-date"
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="due-date"
                  >
                    Due Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="payment-terms"
                  >
                    Payment Terms
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="payment-terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 7">Net 7</option>
                    <option value="Net 14">Net 14</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Discount */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Discount</h2>

              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number.parseFloat(e.target.value) || 0)}
                  />
                </div>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                >
                  <option value="percent">%</option>
                  <option value="fixed">$</option>
                </select>
              </div>
            </div>

            {/* Recurring */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recurring Invoice</h2>
                <button
                  className={cn(
                    'relative h-6 w-12 rounded-full transition-colors',
                    isRecurring ? 'bg-indigo-600' : 'bg-gray-200'
                  )}
                  onClick={() => setIsRecurring(!isRecurring)}
                >
                  <span
                    className={cn(
                      'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                      isRecurring ? 'left-7' : 'left-1'
                    )}
                  />
                </button>
              </div>

              {isRecurring && (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-gray-700"
                    htmlFor="recurring-frequency"
                  >
                    Frequency
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="recurring-frequency"
                    value={recurringFrequency}
                    onChange={(e) =>
                      setRecurringFrequency(e.target.value as 'weekly' | 'monthly' | 'quarterly')
                    }
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                  <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <RefreshCw className="h-3 w-3" />
                    Invoice will be automatically sent each {recurringFrequency}
                  </p>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-indigo-50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <span className="font-semibold text-indigo-900">Invoice Summary</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Line Items</span>
                  <span>{lineItems.filter((i) => i.description).length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({taxRate}%)</span>
                  <span>${taxAmount.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Discount</span>
                    <span>-${discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-indigo-200 pt-2 font-bold text-indigo-900">
                  <span>Total Due</span>
                  <span>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Time Entries Modal */}
      {showImportTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Import Time Entries</h3>

            {selectedProject ? (
              <>
                <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
                  {unbilledEntries
                    .filter((e) => e.projectId === selectedProject)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{entry.description}</div>
                          <div className="text-sm text-gray-500">{entry.date}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            ${(entry.hours * entry.rate).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.hours}h x ${entry.rate}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowImportTime(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                    onClick={importTimeEntries}
                  >
                    Import All
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-gray-600">
                  Please select a project first to import time entries.
                </p>
                <button
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowImportTime(false)}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
