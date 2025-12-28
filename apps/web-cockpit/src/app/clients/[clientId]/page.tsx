/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Client Detail Page
 *
 * Comprehensive client view with tabs for overview, projects,
 * financials, time, communications, and files.
 *
 * @module app/clients/[clientId]/page
 */

import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Edit3,
  MoreHorizontal,
  MessageSquare,
  FileText,
  Clock,
  DollarSign,
  Briefcase,
  Tag,
  ExternalLink,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

type TabId = 'overview' | 'projects' | 'financials' | 'time' | 'communications' | 'files';

interface ClientDetail {
  id: string;
  companyName: string;
  industry?: string;
  website?: string;
  logo?: string;
  contactName: string;
  contactTitle?: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'prospect';
  platform: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
  };
  billing?: {
    currency: string;
    paymentTerms: string;
    taxId?: string;
  };
  notes?: string;
  howWeMet?: string;
  tags: string[];
  customFields?: Record<string, string>;
  stats: {
    projectsCount: number;
    activeProjects: number;
    totalRevenue: number;
    outstandingAmount: number;
    totalHours: number;
    lastContact: string;
    clientSince: string;
  };
}

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_CLIENT: ClientDetail = {
  id: 'client-1',
  companyName: 'TechStart Inc',
  industry: 'Technology / SaaS',
  website: 'https://techstart.io',
  contactName: 'Sarah Chen',
  contactTitle: 'CTO',
  email: 'sarah@techstart.io',
  phone: '+1 555-0123',
  status: 'active',
  platform: 'Skillancer',
  address: {
    street: '123 Innovation Blvd',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
    timezone: 'America/Los_Angeles',
  },
  billing: {
    currency: 'USD',
    paymentTerms: 'Net 30',
    taxId: 'US-12345678',
  },
  notes:
    'Great client to work with. Very clear communication and quick to respond. Prefers Slack for day-to-day communication.',
  howWeMet:
    'Found through Skillancer marketplace. Initially hired for a small MVP project which led to ongoing work.',
  tags: ['Startup', 'SaaS', 'Priority', 'Long-term'],
  customFields: {
    'Account Manager': 'Direct',
    'Preferred Stack': 'React, Node.js, PostgreSQL',
  },
  stats: {
    projectsCount: 5,
    activeProjects: 2,
    totalRevenue: 45000,
    outstandingAmount: 3500,
    totalHours: 312,
    lastContact: '2025-01-05',
    clientSince: '2024-03-15',
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'inactive':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    case 'prospect':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getPlatformColor(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'skillancer':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'upwork':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ client }: Readonly<{ client: ClientDetail }>) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Contact Information */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Contact Information</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <a
                className="text-blue-600 hover:underline dark:text-blue-400"
                href={`mailto:${client.email}`}
              >
                {client.email}
              </a>
            </div>
          </div>
          {client.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                <a className="text-gray-900 dark:text-white" href={`tel:${client.phone}`}>
                  {client.phone}
                </a>
              </div>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Website</p>
                <a
                  className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                  href={client.website}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {client.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                <p className="text-gray-900 dark:text-white">
                  {[client.address.city, client.address.state, client.address.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {client.address.timezone && (
                  <p className="text-sm text-gray-500">{client.address.timezone}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Billing Information */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Billing Information</h3>
        {client.billing ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Currency</p>
              <p className="text-gray-900 dark:text-white">{client.billing.currency}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Payment Terms</p>
              <p className="text-gray-900 dark:text-white">{client.billing.paymentTerms}</p>
            </div>
            {client.billing.taxId && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tax ID</p>
                <p className="text-gray-900 dark:text-white">{client.billing.taxId}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No billing information set</p>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Notes</h3>
        {client.notes ? (
          <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{client.notes}</p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No notes added</p>
        )}
      </div>

      {/* How We Met */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">How We Met</h3>
        {client.howWeMet ? (
          <p className="text-gray-700 dark:text-gray-300">{client.howWeMet}</p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">Not recorded</p>
        )}
      </div>

      {/* Custom Fields */}
      {client.customFields && Object.keys(client.customFields).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Custom Fields</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Object.entries(client.customFields).map(([key, value]) => (
              <div key={key}>
                <p className="text-sm text-gray-500 dark:text-gray-400">{key}</p>
                <p className="text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsTab({ client }: Readonly<{ client: ClientDetail }>) {
  const projects = [
    { id: '1', name: 'Platform Redesign', status: 'active', value: 15000, progress: 65 },
    { id: '2', name: 'Mobile App Development', status: 'active', value: 25000, progress: 30 },
    { id: '3', name: 'API Integration', status: 'completed', value: 8000, progress: 100 },
    { id: '4', name: 'Initial MVP', status: 'completed', value: 5000, progress: 100 },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {client.stats.projectsCount} projects · {client.stats.activeProjects} active
        </p>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>
      <div className="space-y-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            href={`/projects/${project.id}`}
          >
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">{project.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatCurrency(project.value)}
              </p>
            </div>
            <div className="w-32">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-gray-500">{project.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full ${
                    project.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                project.status === 'active'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {project.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FinancialsTab({ client }: Readonly<{ client: ClientDetail }>) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(client.stats.totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(client.stats.outstandingAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Project Value</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(client.stats.totalRevenue / client.stats.projectsCount)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Lifetime Value</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(client.stats.totalRevenue)}
          </p>
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Recent Invoices</h3>
        <div className="space-y-3">
          {[
            { id: 'INV-001', amount: 5000, status: 'paid', date: '2025-01-01' },
            { id: 'INV-002', amount: 3500, status: 'pending', date: '2025-01-05' },
          ].map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{invoice.id}</p>
                <p className="text-sm text-gray-500">{formatDate(invoice.date)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(invoice.amount)}
                </p>
                <span
                  className={`text-xs font-medium capitalize ${
                    invoice.status === 'paid' ? 'text-green-600' : 'text-orange-600'
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeTab({ client }: Readonly<{ client: ClientDetail }>) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Time Logged</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: {client.stats.totalHours} hours
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Clock className="h-4 w-4" />
          Start Timer
        </button>
      </div>
      <p className="py-8 text-center text-gray-500 dark:text-gray-400">
        Time entries will appear here
      </p>
    </div>
  );
}

function CommunicationsTab({ client }: Readonly<{ client: ClientDetail }>) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Activity Log</h3>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Log Activity
        </button>
      </div>
      <p className="py-8 text-center text-gray-500 dark:text-gray-400">
        Communication history will appear here
      </p>
    </div>
  );
}

function FilesTab({ client }: Readonly<{ client: ClientDetail }>) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Shared Files</h3>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Upload File
        </button>
      </div>
      <p className="py-8 text-center text-gray-500 dark:text-gray-400">No files shared yet</p>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ClientDetailPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const client = SAMPLE_CLIENT;

  const tabs: { id: TabId; label: string; icon: typeof Building2 }[] = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'financials', label: 'Financials', icon: DollarSign },
    { id: 'time', label: 'Time', icon: Clock },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'files', label: 'Files', icon: FileText },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab client={client} />;
      case 'projects':
        return <ProjectsTab client={client} />;
      case 'financials':
        return <FinancialsTab client={client} />;
      case 'time':
        return <TimeTab client={client} />;
      case 'communications':
        return <CommunicationsTab client={client} />;
      case 'files':
        return <FilesTab client={client} />;
    }
  };

  return (
    <div className="p-6">
      {/* Back Link */}
      <Link
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        href="/clients"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Client Header */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
              {client.companyName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {client.companyName}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(client.status)}`}
                >
                  {client.status}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPlatformColor(client.platform)}`}
                >
                  {client.platform}
                </span>
              </div>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {client.contactName}
                {client.contactTitle && ` · ${client.contactTitle}`}
              </p>
              {client.industry && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{client.industry}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              href={`mailto:${client.email}`}
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
            {client.phone && (
              <a
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                href={`tel:${client.phone}`}
              >
                <Phone className="h-4 w-4" />
                Call
              </a>
            )}
            <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Edit3 className="h-4 w-4" />
              Edit
            </button>
            <button className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tags */}
        {client.tags.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400" />
            {client.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Content Area */}
        <div className="flex-1">
          {/* Tabs */}
          <div className="mb-6 flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>

        {/* Sidebar */}
        <div className="hidden w-80 flex-shrink-0 lg:block">
          {/* Key Metrics */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Key Metrics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Projects</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {client.stats.projectsCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(client.stats.totalRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Hours Logged</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {client.stats.totalHours}h
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Client Since</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDate(client.stats.clientSince)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Last Contact</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDate(client.stats.lastContact)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <Plus className="h-4 w-4" />
                New Project
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <FileText className="h-4 w-4" />
                Create Invoice
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <Clock className="h-4 w-4" />
                Log Time
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                <MessageSquare className="h-4 w-4" />
                Log Activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
