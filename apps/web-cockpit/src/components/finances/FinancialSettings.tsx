'use client';

/**
 * Financial Settings Component
 *
 * Manage default currency, tax information, and invoice defaults.
 */

import { cn } from '@skillancer/ui';
import {
  Save,
  Receipt,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  Globe,
  CreditCard,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { useInvoiceSettings, useUpdateInvoiceSettings } from '@/hooks/api/use-invoicing';

// =============================================================================
// Types
// =============================================================================

interface FinancialSettingsData {
  // Currency & Region
  defaultCurrency: string;
  locale: string;
  dateFormat: string;

  // Tax Information (for 1099)
  taxId: string;
  taxIdType: 'ssn' | 'ein';
  businessType: 'sole_proprietor' | 'llc' | 'corporation' | 's_corp' | 'partnership';

  // Business Info
  businessName: string;
  businessAddress: string;
  businessCity: string;
  businessState: string;
  businessZip: string;
  businessCountry: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;

  // Invoice Defaults
  defaultPaymentTermsDays: number;
  defaultTaxRate: number;
  defaultNotes: string;
  defaultTerms: string;
  invoiceNumberPrefix: string;
  autoInvoiceNumbering: boolean;

  // Payment Settings
  acceptedPaymentMethods: string[];
  lateFeeEnabled: boolean;
  lateFeeType: 'percentage' | 'fixed';
  lateFeeValue: number;
  lateFeeGraceDays: number;
}

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: 'â‚¬', name: 'Euro' },
  { code: 'GBP', symbol: 'Â£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: 'Â¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'INR', symbol: 'â‚¹', name: 'Indian Rupee' },
];

const usStates = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
];

const paymentMethods = [
  { id: 'bank_transfer', label: 'Bank Transfer (ACH)' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'check', label: 'Check' },
  { id: 'cash', label: 'Cash' },
  { id: 'crypto', label: 'Cryptocurrency' },
];

// =============================================================================
// Component
// =============================================================================

export function FinancialSettings() {
  const { data: settingsData, isLoading: isLoadingSettings } = useInvoiceSettings();
  const updateSettings = useUpdateInvoiceSettings();

  const [settings, setSettings] = useState<FinancialSettingsData>({
    defaultCurrency: 'USD',
    locale: 'en-US',
    dateFormat: 'MM/DD/YYYY',
    taxId: '',
    taxIdType: 'ssn',
    businessType: 'sole_proprietor',
    businessName: '',
    businessAddress: '',
    businessCity: '',
    businessState: '',
    businessZip: '',
    businessCountry: 'US',
    businessPhone: '',
    businessEmail: '',
    businessWebsite: '',
    defaultPaymentTermsDays: 30,
    defaultTaxRate: 0,
    defaultNotes: '',
    defaultTerms: '',
    invoiceNumberPrefix: 'INV-',
    autoInvoiceNumbering: true,
    acceptedPaymentMethods: ['bank_transfer', 'credit_card'],
    lateFeeEnabled: false,
    lateFeeType: 'percentage',
    lateFeeValue: 1.5,
    lateFeeGraceDays: 7,
  });

  const [activeTab, setActiveTab] = useState<'general' | 'tax' | 'invoicing' | 'payment'>(
    'general'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    if (settingsData?.data) {
      const data = settingsData.data;
      setSettings((prev) => ({
        ...prev,
        defaultCurrency: data.defaultCurrency ?? prev.defaultCurrency,
        defaultPaymentTermsDays: data.defaultPaymentTermsDays ?? prev.defaultPaymentTermsDays,
        defaultNotes: data.defaultNotes ?? prev.defaultNotes,
        defaultTerms: data.defaultTerms ?? prev.defaultTerms,
        invoiceNumberPrefix: data.invoiceNumberPrefix ?? prev.invoiceNumberPrefix,
        defaultTaxRate: data.taxRate ?? prev.defaultTaxRate,
        businessName: data.companyInfo?.name ?? prev.businessName,
        businessAddress: data.companyInfo?.address ?? prev.businessAddress,
        businessPhone: data.companyInfo?.phone ?? prev.businessPhone,
        businessEmail: data.companyInfo?.email ?? prev.businessEmail,
        businessWebsite: data.companyInfo?.website ?? prev.businessWebsite,
        taxId: data.companyInfo?.taxId ?? prev.taxId,
      }));
    }
  }, [settingsData]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await updateSettings.mutateAsync({
        defaultCurrency: settings.defaultCurrency,
        defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
        defaultNotes: settings.defaultNotes,
        defaultTerms: settings.defaultTerms,
        invoiceNumberPrefix: settings.invoiceNumberPrefix,
        taxRate: settings.defaultTaxRate,
        companyInfo: {
          name: settings.businessName,
          address: `${settings.businessAddress}\n${settings.businessCity}, ${settings.businessState} ${settings.businessZip}`,
          phone: settings.businessPhone,
          email: settings.businessEmail,
          website: settings.businessWebsite,
          taxId: settings.taxId,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof FinancialSettingsData>(
    field: K,
    value: FinancialSettingsData[K]
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const togglePaymentMethod = (methodId: string) => {
    setSettings((prev) => ({
      ...prev,
      acceptedPaymentMethods: prev.acceptedPaymentMethods.includes(methodId)
        ? prev.acceptedPaymentMethods.filter((m) => m !== methodId)
        : [...prev.acceptedPaymentMethods, methodId],
    }));
  };

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Globe },
    { id: 'tax' as const, label: 'Tax Information', icon: Receipt },
    { id: 'invoicing' as const, label: 'Invoice Defaults', icon: FileText },
    { id: 'payment' as const, label: 'Payment', icon: CreditCard },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Settings</h1>
          <p className="text-gray-500">Configure your financial preferences and tax information</p>
        </div>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors',
            saveSuccess ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700',
            isSaving && 'opacity-50'
          )}
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveSuccess ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

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
        {/* General Settings */}
        {activeTab === 'general' && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Currency & Region</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="default-currency"
                  >
                    Default Currency
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="default-currency"
                    value={settings.defaultCurrency}
                    onChange={(e) => updateField('defaultCurrency', e.target.value)}
                  >
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="date-format"
                  >
                    Date Format
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="date-format"
                    value={settings.dateFormat}
                    onChange={(e) => updateField('dateFormat', e.target.value)}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (UK/EU)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Business Information</h3>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="business-name"
                  >
                    Business Name
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="business-name"
                    placeholder="Your Business Name"
                    type="text"
                    value={settings.businessName}
                    onChange={(e) => updateField('businessName', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="business-address"
                  >
                    Street Address
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="business-address"
                    placeholder="123 Main Street"
                    type="text"
                    value={settings.businessAddress}
                    onChange={(e) => updateField('businessAddress', e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="business-city"
                    >
                      City
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="business-city"
                      placeholder="City"
                      type="text"
                      value={settings.businessCity}
                      onChange={(e) => updateField('businessCity', e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="business-state"
                    >
                      State
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="business-state"
                      value={settings.businessState}
                      onChange={(e) => updateField('businessState', e.target.value)}
                    >
                      <option value="">Select State</option>
                      {usStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="business-zip"
                    >
                      ZIP Code
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="business-zip"
                      placeholder="12345"
                      type="text"
                      value={settings.businessZip}
                      onChange={(e) => updateField('businessZip', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="business-phone"
                    >
                      Phone
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="business-phone"
                      placeholder="+1 (555) 123-4567"
                      type="tel"
                      value={settings.businessPhone}
                      onChange={(e) => updateField('businessPhone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="business-email"
                    >
                      Email
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="business-email"
                      placeholder="hello@business.com"
                      type="email"
                      value={settings.businessEmail}
                      onChange={(e) => updateField('businessEmail', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="business-website"
                  >
                    Website
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="business-website"
                    placeholder="www.business.com"
                    type="url"
                    value={settings.businessWebsite}
                    onChange={(e) => updateField('businessWebsite', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tax Information */}
        {activeTab === 'tax' && (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <h4 className="font-medium text-amber-900">Important Tax Information</h4>
                  <p className="text-sm text-amber-700">
                    This information is used for 1099 tax reporting. Ensure accuracy for proper tax
                    filing. Consult a tax professional for guidance.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Tax Identification</h3>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="tax-id-type"
                    >
                      Tax ID Type
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="tax-id-type"
                      value={settings.taxIdType}
                      onChange={(e) => updateField('taxIdType', e.target.value as 'ssn' | 'ein')}
                    >
                      <option value="ssn">SSN (Social Security Number)</option>
                      <option value="ein">EIN (Employer Identification Number)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="tax-id"
                    >
                      {settings.taxIdType === 'ssn' ? 'Social Security Number' : 'EIN'}
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="tax-id"
                      placeholder={settings.taxIdType === 'ssn' ? 'XXX-XX-XXXX' : 'XX-XXXXXXX'}
                      type="text"
                      value={settings.taxId}
                      onChange={(e) => updateField('taxId', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="business-type-tax"
                  >
                    Business Type
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="business-type-tax"
                    value={settings.businessType}
                    onChange={(e) =>
                      updateField(
                        'businessType',
                        e.target.value as FinancialSettingsData['businessType']
                      )
                    }
                  >
                    <option value="sole_proprietor">Sole Proprietor</option>
                    <option value="llc">LLC (Single Member)</option>
                    <option value="partnership">Partnership</option>
                    <option value="s_corp">S Corporation</option>
                    <option value="corporation">C Corporation</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Default Tax Rate</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="default-tax-rate"
                  >
                    Sales Tax Rate (%)
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="default-tax-rate"
                    max="100"
                    min="0"
                    step="0.1"
                    type="number"
                    value={settings.defaultTaxRate}
                    onChange={(e) => updateField('defaultTaxRate', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="text-sm text-gray-500">
                  Applied to taxable line items on invoices
                </div>
              </div>
            </div>
          </>
        )}

        {/* Invoice Defaults */}
        {activeTab === 'invoicing' && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Invoice Numbering</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="invoice-prefix"
                  >
                    Invoice Number Prefix
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="invoice-prefix"
                    placeholder="INV-"
                    type="text"
                    value={settings.invoiceNumberPrefix}
                    onChange={(e) => updateField('invoiceNumberPrefix', e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex cursor-pointer items-center gap-2">
                    <input
                      checked={settings.autoInvoiceNumbering}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      id="auto-invoice-numbering"
                      type="checkbox"
                      onChange={(e) => updateField('autoInvoiceNumbering', e.target.checked)}
                    />
                    <label
                      className="cursor-pointer text-sm text-gray-700"
                      htmlFor="auto-invoice-numbering"
                    >
                      Auto-increment invoice numbers
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Payment Terms</h3>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-gray-700"
                  htmlFor="payment-terms"
                >
                  Default Payment Terms (Days)
                </label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="payment-terms"
                  value={settings.defaultPaymentTermsDays}
                  onChange={(e) => updateField('defaultPaymentTermsDays', parseInt(e.target.value))}
                >
                  <option value={0}>Due on Receipt</option>
                  <option value={7}>Net 7 (7 days)</option>
                  <option value={14}>Net 14 (14 days)</option>
                  <option value={15}>Net 15 (15 days)</option>
                  <option value={30}>Net 30 (30 days)</option>
                  <option value={45}>Net 45 (45 days)</option>
                  <option value={60}>Net 60 (60 days)</option>
                  <option value={90}>Net 90 (90 days)</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Default Text</h3>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="default-notes"
                  >
                    Default Notes (visible to client)
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="default-notes"
                    placeholder="Thank you for your business!"
                    rows={3}
                    value={settings.defaultNotes}
                    onChange={(e) => updateField('defaultNotes', e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-gray-700"
                    htmlFor="default-terms"
                  >
                    Default Terms & Conditions
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="default-terms"
                    placeholder="Payment is due within the terms specified above."
                    rows={3}
                    value={settings.defaultTerms}
                    onChange={(e) => updateField('defaultTerms', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Payment Settings */}
        {activeTab === 'payment' && (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Accepted Payment Methods</h3>
              <fieldset className="grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                      settings.acceptedPaymentMethods.includes(method.id)
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <input
                      checked={settings.acceptedPaymentMethods.includes(method.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      id={`payment-method-${method.id}`}
                      type="checkbox"
                      onChange={() => togglePaymentMethod(method.id)}
                    />
                    <label
                      className="cursor-pointer text-gray-900"
                      htmlFor={`payment-method-${method.id}`}
                    >
                      {method.label}
                    </label>
                  </div>
                ))}
              </fieldset>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Late Fees</h3>
                  <p className="text-sm text-gray-500">
                    Automatically apply fees to overdue invoices
                  </p>
                </div>
                <div className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={settings.lateFeeEnabled}
                    className="peer sr-only"
                    id="late-fee-enabled"
                    type="checkbox"
                    onChange={(e) => updateField('lateFeeEnabled', e.target.checked)}
                  />
                  <label
                    className="peer h-6 w-11 cursor-pointer rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300"
                    htmlFor="late-fee-enabled"
                  >
                    <span className="sr-only">Enable late fees</span>
                  </label>
                </div>
              </div>

              {settings.lateFeeEnabled && (
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium text-gray-700"
                        htmlFor="late-fee-type"
                      >
                        Fee Type
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        id="late-fee-type"
                        value={settings.lateFeeType}
                        onChange={(e) =>
                          updateField('lateFeeType', e.target.value as 'percentage' | 'fixed')
                        }
                      >
                        <option value="percentage">Percentage of Invoice</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium text-gray-700"
                        htmlFor="late-fee-value"
                      >
                        {settings.lateFeeType === 'percentage' ? 'Fee Percentage' : 'Fee Amount'}
                      </label>
                      <div className="relative">
                        <input
                          className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-8 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          id="late-fee-value"
                          min="0"
                          step={settings.lateFeeType === 'percentage' ? '0.1' : '1'}
                          type="number"
                          value={settings.lateFeeValue}
                          onChange={(e) =>
                            updateField('lateFeeValue', parseFloat(e.target.value) || 0)
                          }
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                          {settings.lateFeeType === 'percentage' ? '%' : '$'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-gray-700"
                      htmlFor="late-fee-grace"
                    >
                      Grace Period (Days)
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="late-fee-grace"
                      min="0"
                      type="number"
                      value={settings.lateFeeGraceDays}
                      onChange={(e) =>
                        updateField('lateFeeGraceDays', parseInt(e.target.value) || 0)
                      }
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Days after due date before late fee is applied
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FinancialSettings;
