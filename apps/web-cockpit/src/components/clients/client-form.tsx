/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Client Form Component
 *
 * Add/Edit client form with sections for basic info,
 * contact person, address, billing, notes, and tags.
 *
 * @module components/clients/client-form
 */

import {
  Building2,
  User,
  MapPin,
  DollarSign,
  FileText,
  Tag,
  Upload,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ClientFormData {
  // Basic Info
  companyName: string;
  industry?: string | undefined;
  website?: string | undefined;
  logo?: File | string | undefined;

  // Contact Person
  contactName: string;
  contactTitle?: string | undefined;
  email: string;
  phone?: string | undefined;

  // Address
  street?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
  postalCode?: string | undefined;
  timezone?: string | undefined;

  // Billing
  currency: string;
  paymentTerms: string;
  taxId?: string | undefined;

  // Notes
  notes?: string | undefined;
  howWeMet?: string | undefined;

  // Tags
  tags: string[];

  // Custom Fields
  customFields: Record<string, string>;

  // Platform
  platform: string;
  platformId?: string | undefined;
}

export interface ClientFormProps {
  initialData?: Partial<ClientFormData>;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'E-commerce',
  'Education',
  'Marketing',
  'Media',
  'Manufacturing',
  'Real Estate',
  'Other',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY'];

const PAYMENT_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

const PLATFORMS = [
  'Skillancer',
  'Upwork',
  'Fiverr',
  'Toptal',
  'Freelancer',
  'Direct',
  'Referral',
  'Other',
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

// ============================================================================
// Form Section Component
// ============================================================================

function FormSection({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
}: Readonly<{
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        className={`flex w-full items-center justify-between p-4 ${
          collapsible ? 'cursor-pointer' : 'cursor-default'
        }`}
        type="button"
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        {collapsible &&
          (isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ))}
      </button>
      {isOpen && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">{children}</div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ClientForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: Readonly<ClientFormProps>) {
  const [formData, setFormData] = useState<ClientFormData>({
    companyName: initialData?.companyName || '',
    industry: initialData?.industry || '',
    website: initialData?.website || '',
    logo: initialData?.logo,
    contactName: initialData?.contactName || '',
    contactTitle: initialData?.contactTitle || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    street: initialData?.street || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    country: initialData?.country || '',
    postalCode: initialData?.postalCode || '',
    timezone: initialData?.timezone || '',
    currency: initialData?.currency || 'USD',
    paymentTerms: initialData?.paymentTerms || 'Net 30',
    taxId: initialData?.taxId || '',
    notes: initialData?.notes || '',
    howWeMet: initialData?.howWeMet || '',
    tags: initialData?.tags || [],
    customFields: initialData?.customFields || {},
    platform: initialData?.platform || 'Direct',
    platformId: initialData?.platformId || '',
  });

  const [newTag, setNewTag] = useState('');

  const updateField = <K extends keyof ClientFormData>(field: K, value: ClientFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateField('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateField(
      'tags',
      formData.tags.filter((t) => t !== tag)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getSubmitButtonText = () => {
    if (isLoading) return 'Saving...';
    if (initialData?.companyName) return 'Save Changes';
    return 'Create Client';
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Basic Info */}
      <FormSection icon={Building2} title="Basic Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-company-name"
            >
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-company-name"
              placeholder="Acme Inc"
              type="text"
              value={formData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-industry"
            >
              Industry
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-industry"
              value={formData.industry}
              onChange={(e) => updateField('industry', e.target.value)}
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-website"
            >
              Website
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-website"
              placeholder="https://example.com"
              type="url"
              value={formData.website}
              onChange={(e) => updateField('website', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-platform"
            >
              Source Platform
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-platform"
              value={formData.platform}
              onChange={(e) => updateField('platform', e.target.value)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Logo
            </span>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400"
                type="button"
              >
                <Upload className="h-4 w-4" />
                Upload Logo
              </button>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Contact Person */}
      <FormSection icon={User} title="Contact Person">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-contact-name"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-contact-name"
              placeholder="John Doe"
              type="text"
              value={formData.contactName}
              onChange={(e) => updateField('contactName', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-contact-title"
            >
              Title
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-contact-title"
              placeholder="CTO, Product Manager, etc."
              type="text"
              value={formData.contactTitle}
              onChange={(e) => updateField('contactTitle', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-email"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-email"
              placeholder="john@example.com"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-phone"
            >
              Phone
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-phone"
              placeholder="+1 555-0123"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Address */}
      <FormSection collapsible defaultOpen={false} icon={MapPin} title="Address">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-street"
            >
              Street Address
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-street"
              placeholder="123 Main St"
              type="text"
              value={formData.street}
              onChange={(e) => updateField('street', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-city"
            >
              City
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-city"
              placeholder="San Francisco"
              type="text"
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-state"
            >
              State/Province
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-state"
              placeholder="CA"
              type="text"
              value={formData.state}
              onChange={(e) => updateField('state', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-country"
            >
              Country
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-country"
              placeholder="United States"
              type="text"
              value={formData.country}
              onChange={(e) => updateField('country', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-timezone"
            >
              Timezone
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-timezone"
              value={formData.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
            >
              <option value="">Select timezone...</option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      {/* Billing */}
      <FormSection collapsible defaultOpen={false} icon={DollarSign} title="Billing">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-currency"
            >
              Currency
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-currency"
              value={formData.currency}
              onChange={(e) => updateField('currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-payment-terms"
            >
              Payment Terms
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-payment-terms"
              value={formData.paymentTerms}
              onChange={(e) => updateField('paymentTerms', e.target.value)}
            >
              {PAYMENT_TERMS.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-tax-id"
            >
              Tax ID
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-tax-id"
              placeholder="VAT/EIN number"
              type="text"
              value={formData.taxId}
              onChange={(e) => updateField('taxId', e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Notes */}
      <FormSection collapsible defaultOpen={false} icon={FileText} title="Notes">
        <div className="space-y-4">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-notes"
            >
              Notes
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-notes"
              placeholder="Any additional notes about this client..."
              rows={4}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="client-how-we-met"
            >
              How You Met
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="client-how-we-met"
              placeholder="How did you connect with this client?"
              rows={2}
              value={formData.howWeMet}
              onChange={(e) => updateField('howWeMet', e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Tags */}
      <FormSection collapsible defaultOpen={false} icon={Tag} title="Tags">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {tag}
                <button
                  className="rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Add a tag..."
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <button
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              type="button"
              onClick={handleAddTag}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </FormSection>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          disabled={isLoading}
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isLoading || !formData.companyName || !formData.contactName || !formData.email}
          type="submit"
        >
          {getSubmitButtonText()}
        </button>
      </div>
    </form>
  );
}

export default ClientForm;
