'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Save,
  Eye,
  Palette,
  Image as ImageIcon,
  Layout,
  DollarSign,
  Percent,
  FileText,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface InvoiceSettings {
  // Business Info
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  businessWebsite: string;
  taxId: string;
  logoUrl?: string;

  // Default Settings
  defaultDueDays: number;
  defaultCurrency: string;
  defaultTaxRate: number;
  defaultPaymentTerms: string;

  // Appearance
  accentColor: string;
  fontFamily: string;
  showLogo: boolean;
  showPaymentLink: boolean;

  // Numbering
  invoicePrefix: string;
  nextInvoiceNumber: number;

  // Payment
  paymentMethods: string[];
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
  };

  // Notes
  defaultNotes: string;
  defaultTerms: string;
}

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const fontOptions = [
  { value: 'inter', label: 'Inter (Modern)' },
  { value: 'georgia', label: 'Georgia (Traditional)' },
  { value: 'roboto', label: 'Roboto (Clean)' },
  { value: 'lato', label: 'Lato (Friendly)' },
];

const accentColors = [
  { value: '#4F46E5', label: 'Indigo' },
  { value: '#0EA5E9', label: 'Sky Blue' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#1F2937', label: 'Dark Gray' },
];

const defaultSettings: InvoiceSettings = {
  businessName: 'John Smith Consulting',
  businessEmail: 'john@smithconsulting.com',
  businessPhone: '+1 (555) 123-4567',
  businessAddress: '123 Main Street, Suite 100\nSan Francisco, CA 94105',
  businessWebsite: 'www.smithconsulting.com',
  taxId: '12-3456789',
  defaultDueDays: 30,
  defaultCurrency: 'USD',
  defaultTaxRate: 0,
  defaultPaymentTerms: 'Net 30',
  accentColor: '#4F46E5',
  fontFamily: 'inter',
  showLogo: true,
  showPaymentLink: true,
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1047,
  paymentMethods: ['Bank Transfer', 'Credit Card', 'PayPal'],
  bankDetails: {
    bankName: 'Chase Bank',
    accountName: 'John Smith Consulting LLC',
    accountNumber: '****4521',
    routingNumber: '****0001',
  },
  defaultNotes: 'Thank you for your business!',
  defaultTerms:
    'Payment is due within 30 days of invoice date. Late payments may be subject to a 1.5% monthly interest charge.',
};

export default function InvoiceSettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<'business' | 'defaults' | 'appearance' | 'payment'>(
    'business'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = (updates: Partial<InvoiceSettings>) => {
    setSettings({ ...settings, ...updates });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setHasChanges(false);
  };

  const tabs = [
    { id: 'business', label: 'Business Info', icon: FileText },
    { id: 'defaults', label: 'Defaults', icon: Layout },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'payment', label: 'Payment', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link className="rounded-lg p-2 transition-colors hover:bg-gray-100" href="/invoices">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoice Settings</h1>
                <p className="text-sm text-gray-500">
                  Customize your invoice appearance and defaults
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50"
                href="/invoices/new"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Link>
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
                  hasChanges
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                )}
                disabled={!hasChanges || isSaving}
                onClick={() => void handleSave()}
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors',
                      activeTab === tab.id
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  >
                    <TabIcon className="h-5 w-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white">
              {/* Business Info Tab */}
              {activeTab === 'business' && (
                <div className="space-y-6 p-6">
                  <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>

                  {/* Logo Upload */}
                  <div>
                    <span className="mb-2 block text-sm font-medium text-gray-700">Logo</span>
                    <div className="flex items-center gap-4">
                      <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-100">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50">
                          <Upload className="h-4 w-4" />
                          Upload Logo
                        </button>
                        <p className="mt-1 text-xs text-gray-500">
                          PNG, JPG up to 2MB. Recommended: 400x100px
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Business Name */}
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="businessName"
                    >
                      Business Name
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="businessName"
                      type="text"
                      value={settings.businessName}
                      onChange={(e) => updateSettings({ businessName: e.target.value })}
                    />
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="businessEmail"
                      >
                        Email
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="businessEmail"
                        type="email"
                        value={settings.businessEmail}
                        onChange={(e) => updateSettings({ businessEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="businessPhone"
                      >
                        Phone
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="businessPhone"
                        type="tel"
                        value={settings.businessPhone}
                        onChange={(e) => updateSettings({ businessPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="businessAddress"
                    >
                      Address
                    </label>
                    <textarea
                      className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="businessAddress"
                      rows={3}
                      value={settings.businessAddress}
                      onChange={(e) => updateSettings({ businessAddress: e.target.value })}
                    />
                  </div>

                  {/* Website & Tax ID */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="businessWebsite"
                      >
                        Website
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="businessWebsite"
                        type="url"
                        value={settings.businessWebsite}
                        onChange={(e) => updateSettings({ businessWebsite: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="taxId"
                      >
                        Tax ID / EIN
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="taxId"
                        type="text"
                        value={settings.taxId}
                        onChange={(e) => updateSettings({ taxId: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Defaults Tab */}
              {activeTab === 'defaults' && (
                <div className="space-y-6 p-6">
                  <h2 className="text-lg font-semibold text-gray-900">Default Settings</h2>

                  {/* Invoice Numbering */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="invoicePrefix"
                      >
                        Invoice Prefix
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="invoicePrefix"
                        type="text"
                        value={settings.invoicePrefix}
                        onChange={(e) => updateSettings({ invoicePrefix: e.target.value })}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="nextInvoiceNumber"
                      >
                        Next Invoice Number
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="nextInvoiceNumber"
                        min="1"
                        type="number"
                        value={settings.nextInvoiceNumber}
                        onChange={(e) =>
                          updateSettings({
                            nextInvoiceNumber: Number.parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="defaultDueDays"
                      >
                        Default Due Days
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="defaultDueDays"
                        value={settings.defaultDueDays}
                        onChange={(e) =>
                          updateSettings({ defaultDueDays: Number.parseInt(e.target.value) })
                        }
                      >
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={15}>15 days</option>
                        <option value={30}>30 days</option>
                        <option value={45}>45 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-sm font-medium text-gray-700"
                        htmlFor="defaultCurrency"
                      >
                        Default Currency
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="defaultCurrency"
                        value={settings.defaultCurrency}
                        onChange={(e) => updateSettings({ defaultCurrency: e.target.value })}
                      >
                        {currencies.map((currency) => (
                          <option key={currency.code} value={currency.code}>
                            {currency.symbol} {currency.name} ({currency.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Default Tax Rate */}
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="defaultTaxRate"
                    >
                      Default Tax Rate (%)
                    </label>
                    <div className="relative w-48">
                      <input
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        id="defaultTaxRate"
                        max="100"
                        min="0"
                        step="0.1"
                        type="number"
                        value={settings.defaultTaxRate}
                        onChange={(e) =>
                          updateSettings({ defaultTaxRate: Number.parseFloat(e.target.value) || 0 })
                        }
                      />
                      <Percent className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Default Notes & Terms */}
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="defaultNotes"
                    >
                      Default Notes
                    </label>
                    <textarea
                      className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="defaultNotes"
                      placeholder="Appears at the bottom of every invoice"
                      rows={2}
                      value={settings.defaultNotes}
                      onChange={(e) => updateSettings({ defaultNotes: e.target.value })}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="defaultTerms"
                    >
                      Default Terms & Conditions
                    </label>
                    <textarea
                      className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="defaultTerms"
                      placeholder="Payment terms, late fees, etc."
                      rows={3}
                      value={settings.defaultTerms}
                      onChange={(e) => updateSettings({ defaultTerms: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-6 p-6">
                  <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>

                  {/* Accent Color */}
                  <div>
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Accent Color
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {accentColors.map((color) => (
                        <button
                          key={color.value}
                          className={cn(
                            'h-10 w-10 rounded-lg border-2 transition-all',
                            settings.accentColor === color.value
                              ? 'scale-110 border-gray-900'
                              : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.label}
                          onClick={() => updateSettings({ accentColor: color.value })}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Font Family */}
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="fontFamily"
                    >
                      Font Style
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      id="fontFamily"
                      value={settings.fontFamily}
                      onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                    >
                      {fontOptions.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Display Options */}
                  <div className="space-y-3">
                    <span className="block text-sm font-medium text-gray-700">Display Options</span>
                    <div className="flex items-center gap-3">
                      <input
                        checked={settings.showLogo}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        id="showLogo"
                        type="checkbox"
                        onChange={(e) => updateSettings({ showLogo: e.target.checked })}
                      />
                      <label className="text-sm text-gray-700" htmlFor="showLogo">
                        Show logo on invoices
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        checked={settings.showPaymentLink}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        id="showPaymentLink"
                        type="checkbox"
                        onChange={(e) => updateSettings({ showPaymentLink: e.target.checked })}
                      />
                      <label className="text-sm text-gray-700" htmlFor="showPaymentLink">
                        Include &ldquo;Pay Now&rdquo; link on invoices
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Tab */}
              {activeTab === 'payment' && (
                <div className="space-y-6 p-6">
                  <h2 className="text-lg font-semibold text-gray-900">Payment Settings</h2>

                  {/* Payment Methods */}
                  <div>
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Accepted Payment Methods
                    </span>
                    <div className="space-y-2">
                      {[
                        'Bank Transfer',
                        'Credit Card',
                        'PayPal',
                        'Venmo',
                        'Zelle',
                        'Check',
                        'Cash',
                      ].map((method) => (
                        <div key={method} className="flex items-center gap-3">
                          <input
                            checked={settings.paymentMethods.includes(method)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            id={method}
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateSettings({
                                  paymentMethods: [...settings.paymentMethods, method],
                                });
                              } else {
                                updateSettings({
                                  paymentMethods: settings.paymentMethods.filter(
                                    (m) => m !== method
                                  ),
                                });
                              }
                            }}
                          />
                          <label className="text-sm text-gray-700" htmlFor={method}>
                            {method}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="mb-4 text-sm font-medium text-gray-900">Bank Account Details</h3>
                    <p className="mb-4 text-sm text-gray-500">
                      These details will be shown on invoices when bank transfer is selected.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          className="mb-1 block text-sm font-medium text-gray-700"
                          htmlFor="bankName"
                        >
                          Bank Name
                        </label>
                        <input
                          className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          id="bankName"
                          type="text"
                          value={settings.bankDetails?.bankName || ''}
                          onChange={(e) =>
                            updateSettings({
                              bankDetails: {
                                bankName: e.target.value,
                                accountName: settings.bankDetails?.accountName ?? '',
                                accountNumber: settings.bankDetails?.accountNumber ?? '',
                                routingNumber: settings.bankDetails?.routingNumber ?? '',
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-sm font-medium text-gray-700"
                          htmlFor="accountName"
                        >
                          Account Name
                        </label>
                        <input
                          className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          id="accountName"
                          type="text"
                          value={settings.bankDetails?.accountName || ''}
                          onChange={(e) =>
                            updateSettings({
                              bankDetails: {
                                bankName: settings.bankDetails?.bankName ?? '',
                                accountName: e.target.value,
                                accountNumber: settings.bankDetails?.accountNumber ?? '',
                                routingNumber: settings.bankDetails?.routingNumber ?? '',
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-sm font-medium text-gray-700"
                          htmlFor="accountNumber"
                        >
                          Account Number
                        </label>
                        <input
                          className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          id="accountNumber"
                          type="text"
                          value={settings.bankDetails?.accountNumber || ''}
                          onChange={(e) =>
                            updateSettings({
                              bankDetails: {
                                bankName: settings.bankDetails?.bankName ?? '',
                                accountName: settings.bankDetails?.accountName ?? '',
                                accountNumber: e.target.value,
                                routingNumber: settings.bankDetails?.routingNumber ?? '',
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-sm font-medium text-gray-700"
                          htmlFor="routingNumber"
                        >
                          Routing Number
                        </label>
                        <input
                          className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          id="routingNumber"
                          type="text"
                          value={settings.bankDetails?.routingNumber || ''}
                          onChange={(e) =>
                            updateSettings({
                              bankDetails: {
                                bankName: settings.bankDetails?.bankName ?? '',
                                accountName: settings.bankDetails?.accountName ?? '',
                                accountNumber: settings.bankDetails?.accountNumber ?? '',
                                routingNumber: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
