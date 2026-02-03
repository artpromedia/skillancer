'use client';

/**
 * CreateInvoice Component
 *
 * Form for creating a new invoice with client selection, line items, and settings.
 */

import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  Clock,
  Building2,
  User,
  Mail,
  Phone,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';

import type { Invoice, InvoiceCreate, InvoiceSettings } from '@/lib/api/services/invoicing';

import { useCreateInvoice, useSendInvoice, useInvoiceSettings } from '@/hooks/api/use-invoicing';

// =============================================================================
// Types
// =============================================================================

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
}

interface CreateInvoiceProps {
  clients?: Client[];
  projects?: Array<{ id: string; name: string; clientId: string }>;
  timeEntries?: Array<{
    id: string;
    description: string;
    hours: number;
    rate: number;
    date: string;
    projectId: string;
  }>;
}

// =============================================================================
// Component
// =============================================================================

export function CreateInvoice({
  clients = [],
  projects = [],
  timeEntries = [],
}: CreateInvoiceProps) {
  const router = useRouter();

  // API Hooks
  const createInvoice = useCreateInvoice();
  const sendInvoice = useSendInvoice();
  const { data: settingsData } = useInvoiceSettings();
  const settings = settingsData?.data as unknown as InvoiceSettings | undefined;

  // Form State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState(
    settings?.invoiceNumberPrefix
      ? `${settings.invoiceNumberPrefix}${settings.nextInvoiceNumber ?? ''}`
      : 'INV-2024-001'
  );
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + (settings?.defaultPaymentTermsDays ?? 14) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
  );
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, rate: 0, taxable: true },
  ]);
  const [taxRate, setTaxRate] = useState(settings?.taxRate ?? 0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [notes, setNotes] = useState(settings?.defaultNotes ?? '');
  const [terms, setTerms] = useState(settings?.defaultTerms ?? '');
  const [currency, setCurrency] = useState(settings?.defaultCurrency ?? 'USD');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showImportTime, setShowImportTime] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly' | 'quarterly'>(
    'monthly'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculations
  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0),
    [lineItems]
  );

  const taxableAmount = useMemo(
    () =>
      lineItems
        .filter((item) => item.taxable)
        .reduce((sum, item) => sum + item.quantity * item.rate, 0),
    [lineItems]
  );

  const taxAmount = (taxableAmount * taxRate) / 100;
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal + taxAmount - discountAmount;

  // Handlers
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

  const importTimeEntries = () => {
    const projectEntries = timeEntries.filter((e) => e.projectId === selectedProject);
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

  const handleSaveDraft = async () => {
    if (!selectedClient) {
      setError('Please select a client');
      return;
    }

    if (lineItems.every((item) => !item.description)) {
      setError('Please add at least one line item');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const invoiceData: InvoiceCreate = {
        clientId: selectedClient.id,
        projectId: selectedProject || undefined,
        issueDate,
        dueDate,
        currency,
        lineItems: lineItems
          .filter((item) => item.description)
          .map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.rate,
            taxRate: item.taxable ? taxRate : undefined,
          })),
        notes: notes || undefined,
        terms: terms || undefined,
      };

      const result = await createInvoice.mutateAsync(invoiceData);
      const newInvoice = result.data as unknown as Invoice | undefined;
      if (newInvoice) {
        router.push(`/invoices/${newInvoice.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedClient) {
      setError('Please select a client');
      return;
    }

    if (lineItems.every((item) => !item.description)) {
      setError('Please add at least one line item');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const invoiceData: InvoiceCreate = {
        clientId: selectedClient.id,
        projectId: selectedProject || undefined,
        issueDate,
        dueDate,
        currency,
        lineItems: lineItems
          .filter((item) => item.description)
          .map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.rate,
            taxRate: item.taxable ? taxRate : undefined,
          })),
        notes: notes || undefined,
        terms: terms || undefined,
      };

      const result = await createInvoice.mutateAsync(invoiceData);
      const newInvoice = result.data as unknown as Invoice | undefined;
      if (newInvoice) {
        await sendInvoice.mutateAsync({ id: newInvoice.id });
        router.push(`/invoices/${newInvoice.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create and send invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Filter projects by selected client
  const clientProjects = selectedClient
    ? projects.filter((p) => p.clientId === selectedClient.id)
    : [];

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
              <Link
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                href={`/invoices/preview?data=${encodeURIComponent(
                  JSON.stringify({ lineItems, client: selectedClient, subtotal, total })
                )}`}
              >
                <Eye className="h-4 w-4" />
                Preview
              </Link>
              <button
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void handleSaveDraft()}
              >
                {isSaving && !sendInvoice.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Draft
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void handleSendInvoice()}
              >
                {sendInvoice.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        </div>
      )}

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
                        {selectedClient.company || selectedClient.name}
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
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {clients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No clients found.{' '}
                          <Link className="text-indigo-600" href="/clients/new">
                            Add a client
                          </Link>
                        </div>
                      ) : (
                        clients.map((client) => (
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
                                {client.company || client.name}
                              </div>
                              <div className="text-sm text-gray-500">{client.email}</div>
                            </div>
                          </button>
                        ))
                      )}
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

              {/* Project Selection */}
              {selectedClient && clientProjects.length > 0 && (
                <div className="mt-4">
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="project-select"
                  >
                    Project (Optional)
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="project-select"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                  >
                    <option value="">No project</option>
                    {clientProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
                {selectedProject && timeEntries.length > 0 && (
                  <button
                    className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm text-indigo-600 transition-colors hover:bg-indigo-100"
                    onClick={() => setShowImportTime(true)}
                  >
                    <Clock className="h-4 w-4" />
                    Import Time Entries
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {lineItems.map((item, _index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4">
                    <div className="col-span-6">
                      <label className="sr-only" htmlFor={`line-desc-${item.id}`}>
                        Description
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        id={`line-desc-${item.id}`}
                        placeholder="Description"
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="sr-only" htmlFor={`line-qty-${item.id}`}>
                        Quantity
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 text-right focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        id={`line-qty-${item.id}`}
                        min="0"
                        placeholder="Qty"
                        step="0.5"
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="sr-only" htmlFor={`line-rate-${item.id}`}>
                        Rate
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 text-right focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        id={`line-rate-${item.id}`}
                        min="0"
                        placeholder="Rate"
                        step="0.01"
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className="text-gray-900">
                        {formatCurrency(item.quantity * item.rate)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <button
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                        onClick={() => removeLineItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="mt-4 flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                onClick={addLineItem}
              >
                <Plus className="h-4 w-4" />
                Add Line Item
              </button>
            </div>

            {/* Notes & Terms */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Notes & Terms</h2>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="invoice-notes"
                  >
                    Notes (visible to client)
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="invoice-notes"
                    placeholder="Thank you for your business!"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="invoice-terms"
                  >
                    Payment Terms
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="invoice-terms"
                    placeholder="Payment is due within the terms specified above."
                    rows={3}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Invoice Details */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Invoice Details</h3>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="invoice-number"
                  >
                    Invoice Number
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="invoice-number"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="issue-date"
                  >
                    Issue Date
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="due-date"
                  >
                    Due Date
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="currency"
                  >
                    Currency
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tax & Discounts */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Tax & Discounts</h3>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="tax-rate"
                  >
                    Tax Rate (%)
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="tax-rate"
                    min="0"
                    step="0.1"
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="discount-value"
                  >
                    Discount
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="discount-value"
                      min="0"
                      step="0.01"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                    <label className="sr-only" htmlFor="discount-type">
                      Discount Type
                    </label>
                    <select
                      className="rounded-lg border border-gray-200 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="discount-type"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                    >
                      <option value="percent">%</option>
                      <option value="fixed">$</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({taxRate}%)</span>
                    <span className="text-gray-900">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Discount (
                      {discountType === 'percent' ? `${discount}%` : formatCurrency(discount)})
                    </span>
                    <span className="text-green-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-indigo-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Recurring Option */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Recurring Invoice</h3>
                  <p className="text-sm text-gray-500">Auto-generate on a schedule</p>
                </div>
                <div className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={isRecurring}
                    className="peer sr-only"
                    id="is-recurring"
                    type="checkbox"
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                  <label
                    className="peer h-6 w-11 cursor-pointer rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300"
                    htmlFor="is-recurring"
                  >
                    <span className="sr-only">Enable recurring invoice</span>
                  </label>
                </div>
              </div>

              {isRecurring && (
                <div className="mt-4">
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="recurring-frequency"
                  >
                    Frequency
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Time Entries Modal */}
      {showImportTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Import Time Entries</h3>
            <p className="mb-4 text-gray-500">
              {timeEntries.filter((e) => e.projectId === selectedProject).length} unbilled time
              entries found for this project.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowImportTime(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                onClick={importTimeEntries}
              >
                Import All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateInvoice;
