'use client';

import { cn } from '@skillancer/ui';
import {
  Link2,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
  AlertTriangle,
  Zap,
  Globe,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Platform types
interface Platform {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: string;
  clientsImported?: number;
  projectsImported?: number;
  features: string[];
  category: 'marketplace' | 'crm' | 'invoicing' | 'communication';
}

// Mock platforms
const platforms: Platform[] = [
  {
    id: '1',
    name: 'Upwork',
    slug: 'upwork',
    icon: '🟢',
    color: '#14A800',
    status: 'connected',
    lastSync: '2024-12-26T10:30:00Z',
    clientsImported: 12,
    projectsImported: 28,
    features: ['Clients', 'Projects', 'Contracts', 'Earnings', 'Messages'],
    category: 'marketplace',
  },
  {
    id: '2',
    name: 'Fiverr',
    slug: 'fiverr',
    icon: '🟢',
    color: '#1DBF73',
    status: 'connected',
    lastSync: '2024-12-26T09:15:00Z',
    clientsImported: 8,
    projectsImported: 15,
    features: ['Clients', 'Orders', 'Gigs', 'Earnings'],
    category: 'marketplace',
  },
  {
    id: '3',
    name: 'Toptal',
    slug: 'toptal',
    icon: '🔵',
    color: '#204ECF',
    status: 'error',
    lastSync: '2024-12-25T18:00:00Z',
    clientsImported: 3,
    projectsImported: 5,
    features: ['Clients', 'Projects', 'Earnings'],
    category: 'marketplace',
  },
  {
    id: '4',
    name: 'Freelancer.com',
    slug: 'freelancer',
    icon: '🔷',
    color: '#0E74E8',
    status: 'disconnected',
    features: ['Clients', 'Projects', 'Bids', 'Earnings'],
    category: 'marketplace',
  },
  {
    id: '5',
    name: 'HubSpot',
    slug: 'hubspot',
    icon: '🟠',
    color: '#FF7A59',
    status: 'disconnected',
    features: ['Contacts', 'Companies', 'Deals', 'Activities'],
    category: 'crm',
  },
  {
    id: '6',
    name: 'Stripe',
    slug: 'stripe',
    icon: '💳',
    color: '#635BFF',
    status: 'connected',
    lastSync: '2024-12-26T11:00:00Z',
    features: ['Invoices', 'Payments', 'Customers', 'Subscriptions'],
    category: 'invoicing',
  },
  {
    id: '7',
    name: 'QuickBooks',
    slug: 'quickbooks',
    icon: '📗',
    color: '#2CA01C',
    status: 'disconnected',
    features: ['Invoices', 'Expenses', 'Customers', 'Reports'],
    category: 'invoicing',
  },
  {
    id: '8',
    name: 'Slack',
    slug: 'slack',
    icon: '💬',
    color: '#4A154B',
    status: 'connected',
    lastSync: '2024-12-26T10:45:00Z',
    features: ['Notifications', 'Channel Sync', 'Direct Messages'],
    category: 'communication',
  },
];

// Stats card
function IntegrationStats() {
  const connected = platforms.filter((p) => p.status === 'connected').length;
  const totalClients = platforms.reduce((sum, p) => sum + (p.clientsImported || 0), 0);
  const totalProjects = platforms.reduce((sum, p) => sum + (p.projectsImported || 0), 0);
  const hasErrors = platforms.some((p) => p.status === 'error');

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
          <Link2 className="h-4 w-4" />
          Connected
        </div>
        <div className="text-2xl font-bold text-gray-900">{connected}</div>
        <div className="text-xs text-gray-500">of {platforms.length} platforms</div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
          <Globe className="h-4 w-4" />
          Clients Imported
        </div>
        <div className="text-2xl font-bold text-gray-900">{totalClients}</div>
        <div className="text-xs text-gray-500">across all platforms</div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
          <Zap className="h-4 w-4" />
          Projects Synced
        </div>
        <div className="text-2xl font-bold text-gray-900">{totalProjects}</div>
        <div className="text-xs text-gray-500">from connected accounts</div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
          {hasErrors ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          Sync Status
        </div>
        <div className={cn('text-2xl font-bold', hasErrors ? 'text-amber-600' : 'text-green-600')}>
          {hasErrors ? 'Issues' : 'Healthy'}
        </div>
        <div className="text-xs text-gray-500">
          {hasErrors ? '1 platform needs attention' : 'All syncs up to date'}
        </div>
      </div>
    </div>
  );
}

// Helper function to render platform status buttons
function renderPlatformStatusButtons(platform: Platform): React.ReactNode {
  if (platform.status === 'connected' || platform.status === 'syncing') {
    return (
      <>
        <button className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200">
          <RefreshCw className="h-4 w-4" />
          Sync Now
        </button>
        <Link
          className="flex items-center justify-center rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          href={`/settings/integrations/${platform.slug}`}
        >
          <Settings className="h-4 w-4" />
        </Link>
      </>
    );
  }

  if (platform.status === 'error') {
    return (
      <button
        className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: platform.color }}
      >
        <RefreshCw className="h-4 w-4" />
        Reconnect
      </button>
    );
  }

  return (
    <button
      className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
      style={{ backgroundColor: platform.color }}
    >
      <Plus className="h-4 w-4" />
      Connect
    </button>
  );
}

// Platform Card
function PlatformCard({ platform }: Readonly<{ platform: Platform }>) {
  const statusConfig = {
    connected: {
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-50',
      label: 'Connected',
    },
    disconnected: {
      icon: XCircle,
      color: 'text-gray-400',
      bg: 'bg-gray-50',
      label: 'Not Connected',
    },
    error: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', label: 'Error' },
    syncing: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Syncing...' },
  };

  const status = statusConfig[platform.status];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${platform.color}15` }}
            >
              {platform.icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{platform.name}</h3>
              <span className="text-xs capitalize text-gray-500">{platform.category}</span>
            </div>
          </div>
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
              status.bg,
              status.color
            )}
          >
            <StatusIcon
              className={cn('h-3 w-3', platform.status === 'syncing' && 'animate-spin')}
            />
            {status.label}
          </div>
        </div>

        {/* Stats (if connected) */}
        {platform.status === 'connected' && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {platform.clientsImported !== undefined && (
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {platform.clientsImported}
                </div>
                <div className="text-xs text-gray-500">Clients</div>
              </div>
            )}
            {platform.projectsImported !== undefined && (
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {platform.projectsImported}
                </div>
                <div className="text-xs text-gray-500">Projects</div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {platform.status === 'error' && (
          <div className="mb-3 rounded-lg border border-red-100 bg-red-50 p-2">
            <p className="text-xs text-red-600">
              Authentication expired. Please reconnect to continue syncing.
            </p>
          </div>
        )}

        {/* Features */}
        <div className="mb-3 flex flex-wrap gap-1">
          {platform.features.slice(0, 4).map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {feature}
            </span>
          ))}
          {platform.features.length > 4 && (
            <span className="px-2 py-0.5 text-xs text-gray-400">
              +{platform.features.length - 4} more
            </span>
          )}
        </div>

        {/* Last sync */}
        {platform.lastSync && (
          <div className="mb-3 flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            Last sync: {new Date(platform.lastSync).toLocaleString()}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">{renderPlatformStatusButtons(platform)}</div>
      </div>
    </div>
  );
}

// Category Section
function CategorySection({
  title,
  description,
  platforms,
}: Readonly<{
  title: string;
  description: string;
  platforms: Platform[];
}>) {
  if (platforms.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => (
          <PlatformCard key={platform.id} platform={platform} />
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected'>('all');

  // Filter platforms
  const filteredPlatforms = platforms.filter((platform) => {
    const matchesSearch = platform.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'connected' &&
        (platform.status === 'connected' || platform.status === 'syncing')) ||
      (filterStatus === 'disconnected' &&
        (platform.status === 'disconnected' || platform.status === 'error'));
    return matchesSearch && matchesStatus;
  });

  // Group by category
  const marketplaces = filteredPlatforms.filter((p) => p.category === 'marketplace');
  const crm = filteredPlatforms.filter((p) => p.category === 'crm');
  const invoicing = filteredPlatforms.filter((p) => p.category === 'invoicing');
  const communication = filteredPlatforms.filter((p) => p.category === 'communication');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-500">
            Connect your freelance platforms and tools to sync clients and projects
          </p>
        </div>
        <Link
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          href="/settings/integrations"
        >
          <Settings className="h-4 w-4" />
          Integration Settings
        </Link>
      </div>

      {/* Stats */}
      <IntegrationStats />

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search integrations..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'connected', 'disconnected'] as const).map((status) => (
            <button
              key={status}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
              onClick={() => setFilterStatus(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Platform Categories */}
      <CategorySection
        description="Import clients and projects from major freelance platforms"
        platforms={marketplaces}
        title="Freelance Marketplaces"
      />

      <CategorySection
        description="Sync contacts and deals from your existing CRM"
        platforms={crm}
        title="CRM & Sales"
      />

      <CategorySection
        description="Connect payment processors and accounting tools"
        platforms={invoicing}
        title="Invoicing & Payments"
      />

      <CategorySection
        description="Stay notified and sync conversations"
        platforms={communication}
        title="Communication"
      />

      {filteredPlatforms.length === 0 && (
        <div className="py-12 text-center">
          <Link2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No integrations found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Request Integration */}
      <div className="mt-8 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex-1">
            <h3 className="mb-1 font-semibold text-gray-900">Don&apos;t see your platform?</h3>
            <p className="text-sm text-gray-600">
              We&apos;re constantly adding new integrations. Let us know which platforms you&apos;d
              like to connect.
            </p>
          </div>
          <button className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50">
            <ExternalLink className="h-4 w-4" />
            Request Integration
          </button>
        </div>
      </div>
    </div>
  );
}
