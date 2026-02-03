'use client';

/**
 * Accounting Integrations Component
 *
 * Export to QuickBooks, Wave, and other accounting software formats.
 * Includes webhook configuration for real-time sync.
 */

import { cn } from '@skillancer/ui';
import {
  Download,
  Link as LinkIcon,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  Key,
  Webhook,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

import { invoicingService } from '@/lib/api/services/invoicing';

// =============================================================================
// Types
// =============================================================================

interface AccountingConnection {
  id: string;
  provider: 'quickbooks' | 'wave' | 'xero' | 'freshbooks';
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: string;
  lastSyncAt?: string;
  companyName?: string;
  error?: string;
}

interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  extension: string;
  icon: string;
}

// =============================================================================
// Constants
// =============================================================================

const accountingProviders = [
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices, expenses, and payments with QuickBooks',
    logo: '/images/integrations/quickbooks.svg',
    features: ['Auto-sync invoices', 'Expense tracking', 'Bank reconciliation'],
  },
  {
    id: 'wave',
    name: 'Wave Accounting',
    description: 'Free accounting software for small businesses',
    logo: '/images/integrations/wave.svg',
    features: ['Invoice sync', 'Receipt scanning', 'Financial reports'],
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Cloud-based accounting for growing businesses',
    logo: '/images/integrations/xero.svg',
    features: ['Multi-currency', 'Bank feeds', 'Payroll integration'],
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Simple invoicing and accounting',
    logo: '/images/integrations/freshbooks.svg',
    features: ['Time tracking', 'Project management', 'Team collaboration'],
  },
];

const exportFormats: ExportFormat[] = [
  {
    id: 'quickbooks-iif',
    name: 'QuickBooks IIF',
    description: 'Intuit Interchange Format for QuickBooks Desktop',
    extension: '.iif',
    icon: '📊',
  },
  {
    id: 'quickbooks-csv',
    name: 'QuickBooks CSV',
    description: 'CSV format compatible with QuickBooks Online import',
    extension: '.csv',
    icon: '📋',
  },
  {
    id: 'wave-csv',
    name: 'Wave CSV',
    description: 'CSV format for Wave Accounting import',
    extension: '.csv',
    icon: '🌊',
  },
  {
    id: 'generic-csv',
    name: 'Generic CSV',
    description: 'Standard CSV format compatible with most software',
    extension: '.csv',
    icon: '📄',
  },
  {
    id: 'ofx',
    name: 'OFX (Open Financial Exchange)',
    description: 'Bank-compatible format for financial data',
    extension: '.ofx',
    icon: '🏦',
  },
];

const webhookEvents = [
  { id: 'invoice.created', label: 'Invoice Created', description: 'When a new invoice is created' },
  { id: 'invoice.sent', label: 'Invoice Sent', description: 'When an invoice is sent to client' },
  { id: 'invoice.paid', label: 'Invoice Paid', description: 'When an invoice is marked as paid' },
  {
    id: 'invoice.overdue',
    label: 'Invoice Overdue',
    description: 'When an invoice becomes overdue',
  },
  { id: 'payment.received', label: 'Payment Received', description: 'When a payment is recorded' },
  { id: 'expense.created', label: 'Expense Created', description: 'When a new expense is logged' },
];

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Generate QuickBooks IIF format export
 */
function generateQuickBooksIIF(data: {
  invoices: Array<{
    invoiceNumber: string;
    clientName: string;
    issueDate: string;
    dueDate: string;
    total: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  }>;
}): string {
  const lines: string[] = [];

  // Header
  lines.push('!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO');
  lines.push('!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO');
  lines.push('!ENDTRNS');

  data.invoices.forEach((invoice, index) => {
    const date = new Date(invoice.issueDate).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });

    // Transaction line
    lines.push(
      `TRNS\t${index + 1}\tINVOICE\t${date}\tAccounts Receivable\t${invoice.clientName}\t${invoice.total.toFixed(2)}\t${invoice.invoiceNumber}\t`
    );

    // Split lines for each line item
    invoice.lineItems.forEach((item, itemIndex) => {
      lines.push(
        `SPL\t${index + 1}-${itemIndex + 1}\tINVOICE\t${date}\tSales\t${invoice.clientName}\t${(-item.total).toFixed(2)}\t${invoice.invoiceNumber}\t${item.description}`
      );
    });

    lines.push('ENDTRNS');
  });

  return lines.join('\n');
}

/**
 * Generate Wave CSV format export
 */
function generateWaveCSV(data: {
  invoices: Array<{
    invoiceNumber: string;
    clientName: string;
    clientEmail: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    total: number;
    status: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  }>;
}): string {
  const lines: string[] = [];

  // Header
  lines.push(
    'Invoice Number,Customer,Email,Invoice Date,Due Date,Currency,Status,Item Description,Quantity,Price,Amount'
  );

  data.invoices.forEach((invoice) => {
    invoice.lineItems.forEach((item, index) => {
      lines.push(
        [
          index === 0 ? invoice.invoiceNumber : '',
          index === 0 ? `"${invoice.clientName}"` : '',
          index === 0 ? invoice.clientEmail : '',
          index === 0 ? invoice.issueDate : '',
          index === 0 ? invoice.dueDate : '',
          index === 0 ? invoice.currency : '',
          index === 0 ? invoice.status : '',
          `"${item.description}"`,
          item.quantity.toString(),
          item.unitPrice.toFixed(2),
          item.total.toFixed(2),
        ].join(',')
      );
    });
  });

  return lines.join('\n');
}

/**
 * Generate QuickBooks CSV format export
 */
function generateQuickBooksCSV(data: {
  invoices: Array<{
    invoiceNumber: string;
    clientName: string;
    clientEmail: string;
    issueDate: string;
    dueDate: string;
    total: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
}): string {
  const lines: string[] = [];

  // Header
  lines.push(
    'InvoiceNo,Customer,CustomerEmail,TxnDate,DueDate,Item,ItemDescription,ItemQty,ItemRate,ItemAmount'
  );

  data.invoices.forEach((invoice) => {
    invoice.lineItems.forEach((item) => {
      lines.push(
        [
          invoice.invoiceNumber,
          `"${invoice.clientName}"`,
          invoice.clientEmail,
          invoice.issueDate,
          invoice.dueDate,
          'Services',
          `"${item.description}"`,
          item.quantity.toString(),
          item.unitPrice.toFixed(2),
          (item.quantity * item.unitPrice).toFixed(2),
        ].join(',')
      );
    });
  });

  return lines.join('\n');
}

// =============================================================================
// Components
// =============================================================================

export function AccountingIntegrations() {
  const [activeTab, setActiveTab] = useState<'connections' | 'export' | 'webhooks'>('connections');
  const [connections, setConnections] = useState<AccountingConnection[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('quickbooks-csv');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: [] as string[],
  });
  const [showAddWebhook, setShowAddWebhook] = useState(false);

  const handleConnect = (providerId: string) => {
    // In production, this would redirect to OAuth flow
    window.open(`/api/integrations/${providerId}/connect`, '_blank');
  };

  const handleDisconnect = (connectionId: string) => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch invoices for the date range
      const response = await invoicingService.list({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      const invoices = response.data || [];

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (exportFormat) {
        case 'quickbooks-iif':
          content = generateQuickBooksIIF({
            invoices: invoices.map((inv) => ({
              invoiceNumber: inv.invoiceNumber,
              clientName: inv.clientId, // Would be resolved to name in production
              issueDate: inv.issueDate,
              dueDate: inv.dueDate,
              total: inv.total,
              lineItems: inv.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              })),
            })),
          });
          filename = `invoices-${dateRange.start}-to-${dateRange.end}.iif`;
          mimeType = 'text/plain';
          break;

        case 'quickbooks-csv':
          content = generateQuickBooksCSV({
            invoices: invoices.map((inv) => ({
              invoiceNumber: inv.invoiceNumber,
              clientName: inv.clientId,
              clientEmail: '',
              issueDate: inv.issueDate,
              dueDate: inv.dueDate,
              total: inv.total,
              lineItems: inv.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            })),
          });
          filename = `invoices-quickbooks-${dateRange.start}-to-${dateRange.end}.csv`;
          mimeType = 'text/csv';
          break;

        case 'wave-csv':
          content = generateWaveCSV({
            invoices: invoices.map((inv) => ({
              invoiceNumber: inv.invoiceNumber,
              clientName: inv.clientId,
              clientEmail: '',
              issueDate: inv.issueDate,
              dueDate: inv.dueDate,
              currency: inv.currency,
              total: inv.total,
              status: inv.status,
              lineItems: inv.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              })),
            })),
          });
          filename = `invoices-wave-${dateRange.start}-to-${dateRange.end}.csv`;
          mimeType = 'text/csv';
          break;

        default:
          // Generic CSV
          content = generateQuickBooksCSV({
            invoices: invoices.map((inv) => ({
              invoiceNumber: inv.invoiceNumber,
              clientName: inv.clientId,
              clientEmail: '',
              issueDate: inv.issueDate,
              dueDate: inv.dueDate,
              total: inv.total,
              lineItems: inv.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            })),
          });
          filename = `invoices-${dateRange.start}-to-${dateRange.end}.csv`;
          mimeType = 'text/csv';
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddWebhook = () => {
    if (!newWebhook.url || newWebhook.events.length === 0) {
      alert('Please enter a URL and select at least one event');
      return;
    }

    const webhook: WebhookConfig = {
      id: `wh_${Date.now()}`,
      url: newWebhook.url,
      secret: `whsec_${Math.random().toString(36).substring(2, 15)}`,
      events: newWebhook.events,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    setWebhooks((prev) => [...prev, webhook]);
    setNewWebhook({ url: '', events: [] });
    setShowAddWebhook(false);
  };

  const handleDeleteWebhook = (webhookId: string) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    }
  };

  const toggleWebhookEvent = (eventId: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const tabs = [
    { id: 'connections' as const, label: 'Connections', icon: LinkIcon },
    { id: 'export' as const, label: 'Export Data', icon: Download },
    { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounting Integrations</h1>
        <p className="text-gray-500">
          Connect to accounting software and export your financial data
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Connections Tab */}
        {activeTab === 'connections' && (
          <div className="grid gap-4 md:grid-cols-2">
            {accountingProviders.map((provider) => {
              const connection = connections.find((c) => c.provider === provider.id);
              const isConnected = connection?.status === 'connected';

              return (
                <div
                  key={provider.id}
                  className={cn(
                    'rounded-xl border p-6',
                    isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
                  )}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                        {provider.id === 'quickbooks' && '📊'}
                        {provider.id === 'wave' && '🌊'}
                        {provider.id === 'xero' && '📈'}
                        {provider.id === 'freshbooks' && '📘'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                        {isConnected && connection?.companyName && (
                          <p className="text-sm text-green-600">{connection.companyName}</p>
                        )}
                      </div>
                    </div>
                    {isConnected && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Connected
                      </span>
                    )}
                  </div>

                  <p className="mb-4 text-sm text-gray-600">{provider.description}</p>

                  <ul className="mb-4 space-y-1">
                    {provider.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <button
                        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => handleConnect(provider.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Sync Now
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        onClick={() => handleDisconnect(connection.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                      onClick={() => handleConnect(provider.id)}
                    >
                      Connect {provider.name}
                    </button>
                  )}

                  {connection?.lastSyncAt && (
                    <p className="mt-3 text-xs text-gray-500">
                      Last synced: {new Date(connection.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Export Settings</h3>

              <div className="space-y-4">
                <fieldset>
                  <legend className="mb-2 block text-sm font-medium text-gray-700">
                    Export Format
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {exportFormats.map((format) => (
                      <div
                        key={format.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                          exportFormat === format.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        <input
                          checked={exportFormat === format.id}
                          className="mt-1 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          id={`export-format-${format.id}`}
                          name="exportFormat"
                          type="radio"
                          value={format.id}
                          onChange={(e) => setExportFormat(e.target.value)}
                        />
                        <label
                          className="flex-1 cursor-pointer"
                          htmlFor={`export-format-${format.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{format.icon}</span>
                            <span className="font-medium text-gray-900">{format.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">{format.description}</p>
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="export-start-date"
                    >
                      Start Date
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="export-start-date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="export-end-date"
                    >
                      End Date
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="export-end-date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </div>

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={isExporting}
                  onClick={() => void handleExport()}
                >
                  {isExporting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h4 className="font-medium text-blue-900">Export Tips</h4>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-700">
                <li>QuickBooks IIF format is best for QuickBooks Desktop</li>
                <li>QuickBooks CSV works with QuickBooks Online import</li>
                <li>Wave CSV can be imported directly into Wave Accounting</li>
                <li>Generic CSV works with most accounting software</li>
              </ul>
            </div>
          </>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Webhook Endpoints</h3>
                  <p className="text-sm text-gray-500">
                    Receive real-time notifications when financial events occur
                  </p>
                </div>
                <button
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                  onClick={() => setShowAddWebhook(true)}
                >
                  <Webhook className="h-4 w-4" />
                  Add Webhook
                </button>
              </div>

              {webhooks.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No webhooks configured. Add one to receive real-time updates.
                </div>
              ) : (
                <div className="space-y-4">
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-block h-2 w-2 rounded-full',
                                webhook.isActive ? 'bg-green-500' : 'bg-gray-400'
                              )}
                            />
                            <code className="text-sm text-gray-900">{webhook.url}</code>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {webhook.events.map((event) => (
                              <span
                                key={event}
                                className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
                              >
                                {event}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              Secret: {webhook.secret.substring(0, 12)}...
                              <button
                                className="text-indigo-600 hover:text-indigo-700"
                                onClick={() => copyToClipboard(webhook.secret)}
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </span>
                            {webhook.lastTriggeredAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Webhook Modal */}
            {showAddWebhook && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-lg rounded-xl bg-white p-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">Add Webhook</h3>

                  <div className="space-y-4">
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium text-gray-700"
                        htmlFor="webhook-url"
                      >
                        Endpoint URL
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        id="webhook-url"
                        placeholder="https://your-server.com/webhook"
                        type="url"
                        value={newWebhook.url}
                        onChange={(e) =>
                          setNewWebhook((prev) => ({ ...prev, url: e.target.value }))
                        }
                      />
                    </div>

                    <fieldset>
                      <legend className="mb-2 block text-sm font-medium text-gray-700">
                        Events
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {webhookEvents.map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors',
                              newWebhook.events.includes(event.id)
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            )}
                          >
                            <input
                              checked={newWebhook.events.includes(event.id)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              id={`webhook-event-${event.id}`}
                              type="checkbox"
                              onChange={() => toggleWebhookEvent(event.id)}
                            />
                            <label
                              className="flex-1 cursor-pointer"
                              htmlFor={`webhook-event-${event.id}`}
                            >
                              <div className="text-sm font-medium text-gray-900">{event.label}</div>
                              <div className="text-xs text-gray-500">{event.description}</div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowAddWebhook(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                      onClick={handleAddWebhook}
                    >
                      Add Webhook
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Webhook Documentation */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h4 className="font-semibold text-gray-900">Webhook Payload Example</h4>
              <pre className="mt-3 overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                {JSON.stringify(
                  {
                    event: 'invoice.paid',
                    timestamp: '2024-01-15T10:30:00Z',
                    data: {
                      invoiceId: 'inv_123456',
                      invoiceNumber: 'INV-2024-001',
                      clientId: 'client_789',
                      amount: 5000.0,
                      currency: 'USD',
                      paidAt: '2024-01-15T10:30:00Z',
                    },
                  },
                  null,
                  2
                )}
              </pre>
              <p className="mt-3 text-sm text-gray-600">
                All webhook payloads include a{' '}
                <code className="text-indigo-600">X-Webhook-Signature</code> header for
                verification. Use your webhook secret to validate the signature.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AccountingIntegrations;
