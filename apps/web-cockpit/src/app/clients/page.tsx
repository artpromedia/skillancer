/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Clients List Page
 *
 * Main clients management page with search, filters, and card/list views.
 * Serves as a lightweight CRM for freelancers.
 *
 * @module app/clients/page
 */

import {
  Users,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown,
  Building2,
  DollarSign,
  TrendingUp,
  ChevronDown,
  X,
  Mail,
  Phone,
  MoreHorizontal,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

import { useClients } from '@/hooks/api/use-clients';
import type { Client as ApiClient } from '@/lib/api/services/clients';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'cards' | 'list';
type ClientStatus = 'active' | 'inactive' | 'prospect';
type SortOption = 'name' | 'revenue' | 'recent';

interface Client {
  id: string;
  companyName: string;
  contactName: string;
  contactTitle?: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: ClientStatus;
  platform: string;
  projectsCount: number;
  totalRevenue: number;
  lastContact: string;
  tags: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function mapApiClient(apiClient: ApiClient): Client {
  const primaryContact = apiClient.contacts?.find((c) => c.isPrimary) ?? apiClient.contacts?.[0];
  return {
    id: apiClient.id,
    companyName: apiClient.displayName || apiClient.name,
    contactName: primaryContact?.name || apiClient.name,
    contactTitle: primaryContact?.role,
    email: apiClient.email,
    phone: apiClient.phone,
    avatar: apiClient.logoUrl,
    status: (apiClient.status === 'archived' ? 'inactive' : apiClient.status) as ClientStatus,
    platform: (apiClient.metadata?.platform as string) || 'Direct',
    projectsCount: (apiClient.metadata?.projectsCount as number) || 0,
    totalRevenue: (apiClient.metadata?.totalRevenue as number) || 0,
    lastContact: apiClient.updatedAt,
    tags: apiClient.tags || [],
  };
}

const PLATFORMS = ['All', 'Skillancer', 'Upwork', 'Fiverr', 'Direct'];
const STATUSES: ClientStatus[] = ['active', 'inactive', 'prospect'];

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusColor(status: ClientStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'inactive':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    case 'prospect':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

function getPlatformColor(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'skillancer':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'upwork':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'fiverr':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
}

// ============================================================================
// Stats Cards Component
// ============================================================================

function ClientStats({ clients }: Readonly<{ clients: Client[] }>) {
  const stats = useMemo(() => {
    const activeThisMonth = clients.filter((c) => {
      const lastContact = new Date(c.lastContact);
      const now = new Date();
      return (
        c.status === 'active' &&
        lastContact.getMonth() === now.getMonth() &&
        lastContact.getFullYear() === now.getFullYear()
      );
    }).length;

    const totalRevenue = clients.reduce((sum, c) => sum + c.totalRevenue, 0);

    return {
      total: clients.length,
      activeThisMonth,
      totalRevenue,
    };
  }, [clients]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-900/30">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Clients</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-50 p-2.5 dark:bg-green-900/30">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active This Month</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.activeThisMonth}
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-50 p-2.5 dark:bg-purple-900/30">
            <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Client Card Component (inline for list page)
// ============================================================================

function ClientCard({ client }: Readonly<{ client: Client }>) {
  return (
    <Link
      className="group block rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      href={`/clients/${client.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-semibold text-white">
            {client.companyName.charAt(0)}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
              {client.companyName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {client.contactName}
              {client.contactTitle && ` · ${client.contactTitle}`}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(client.status)}`}
        >
          {client.status}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(client.platform)}`}
        >
          {client.platform}
        </span>
        {client.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Projects</p>
          <p className="font-medium text-gray-900 dark:text-white">{client.projectsCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(client.totalRevenue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Last Contact</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatDate(client.lastContact)}
          </p>
        </div>
      </div>

      {/* Quick Actions (show on hover) */}
      <div className="mt-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = `mailto:${client.email}`;
          }}
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </button>
        {client.phone && (
          <button
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `tel:${client.phone}`;
            }}
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </button>
        )}
        <button
          className="flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          onClick={(e) => {
            e.preventDefault();
            // Navigate to new project with client pre-selected
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      </div>
    </Link>
  );
}

// ============================================================================
// Client List Row Component
// ============================================================================

function ClientListRow({ client }: Readonly<{ client: Client }>) {
  return (
    <Link
      className="group flex items-center gap-4 border-b border-gray-100 px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
      href={`/clients/${client.id}`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
        {client.companyName.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 group-hover:text-blue-600 dark:text-white">
          {client.companyName}
        </p>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{client.contactName}</p>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(client.platform)}`}
      >
        {client.platform}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(client.status)}`}
      >
        {client.status}
      </span>
      <div className="w-20 text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{client.projectsCount}</p>
        <p className="text-xs text-gray-500">projects</p>
      </div>
      <div className="w-24 text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(client.totalRevenue)}
        </p>
        <p className="text-xs text-gray-500">revenue</p>
      </div>
      <div className="w-24 text-right">
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(client.lastContact)}</p>
      </div>
      <button className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-700">
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </Link>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ClientsPage() {
  const { data: clientsResponse, isLoading, error } = useClients();
  const clients = useMemo(
    () => (clientsResponse?.data ?? []).map(mapApiClient),
    [clientsResponse]
  );
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<ClientStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.companyName.toLowerCase().includes(query) ||
          c.contactName.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query)
      );
    }

    // Platform filter
    if (selectedPlatform !== 'All') {
      result = result.filter((c) => c.platform === selectedPlatform);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      result = result.filter((c) => c.status === selectedStatus);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.companyName.localeCompare(b.companyName));
        break;
      case 'revenue':
        result.sort((a, b) => b.totalRevenue - a.totalRevenue);
        break;
      case 'recent':
        result.sort(
          (a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
        );
        break;
    }

    return result;
  }, [clients, searchQuery, selectedPlatform, selectedStatus, sortBy]);

  const activeFiltersCount = [selectedPlatform !== 'All', selectedStatus !== 'all'].filter(
    Boolean
  ).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your client relationships
          </p>
        </div>
        <Link
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          href="/clients/new"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <ClientStats clients={clients} />
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="Search clients..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
              activeFiltersCount > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Platform
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          selectedPlatform === platform
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                        onClick={() => setSelectedPlatform(platform)}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        selectedStatus === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                      onClick={() => setSelectedStatus('all')}
                    >
                      All
                    </button>
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                          selectedStatus === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                        onClick={() => setSelectedStatus(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    className="w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                    onClick={() => {
                      setSelectedPlatform('All');
                      setSelectedStatus('all');
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sort */}
        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="name">Sort: Name</option>
          <option value="revenue">Sort: Revenue</option>
          <option value="recent">Sort: Recent</option>
        </select>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-gray-200 p-1 dark:border-gray-600">
          <button
            className={`rounded-md p-1.5 ${
              viewMode === 'cards'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            className={`rounded-md p-1.5 ${
              viewMode === 'list'
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading clients...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="font-medium text-red-800 dark:text-red-400">Failed to load clients</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error.message}</p>
        </div>
      )}

      {/* Results Count */}
      {!isLoading && !error && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Clients Grid/List */}
      {!isLoading && !error && viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      ) : !isLoading && !error ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* List Header */}
          <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <div className="w-10" />
            <div className="flex-1">Client</div>
            <div className="w-20">Platform</div>
            <div className="w-20">Status</div>
            <div className="w-20 text-right">Projects</div>
            <div className="w-24 text-right">Revenue</div>
            <div className="w-24 text-right">Last Contact</div>
            <div className="w-8" />
          </div>
          {filteredClients.map((client) => (
            <ClientListRow key={client.id} client={client} />
          ))}
        </div>
      ) : null}

      {/* Empty State */}
      {!isLoading && !error && filteredClients.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 font-medium text-gray-900 dark:text-white">No clients found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || activeFiltersCount > 0
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first client'}
          </p>
          {!searchQuery && activeFiltersCount === 0 && (
            <Link
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              href="/clients/new"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
