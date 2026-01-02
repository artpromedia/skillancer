'use client';

import {
  Building2,
  Key,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Ban,
  CreditCard,
  RefreshCw,
  Download,
  Mail,
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Types
interface APICustomer {
  id: string;
  companyName: string;
  contactEmail: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'active' | 'suspended' | 'pending' | 'churned';
  monthlyUsage: number;
  monthlyLimit: number;
  currentBill: number;
  createdAt: string;
  lastActiveAt: string;
  apiKeyCount: number;
}

interface APIKey {
  id: string;
  customerId: string;
  companyName: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: 'active' | 'revoked';
  requestsToday: number;
  lastUsedAt: string | null;
}

interface UsageMetrics {
  totalRequests: number;
  requestsChange: number;
  activeCustomers: number;
  customersChange: number;
  monthlyRevenue: number;
  revenueChange: number;
  errorRate: number;
  errorRateChange: number;
  avgLatency: number;
  latencyChange: number;
}

interface BillingEvent {
  id: string;
  customerId: string;
  companyName: string;
  type: 'invoice' | 'payment' | 'refund' | 'failed';
  amount: number;
  status: string;
  createdAt: string;
}

// Mock data
const mockCustomers: APICustomer[] = [
  {
    id: 'cust_1',
    companyName: 'TechCorp Industries',
    contactEmail: 'api@techcorp.com',
    plan: 'ENTERPRISE',
    status: 'active',
    monthlyUsage: 45000,
    monthlyLimit: 100000,
    currentBill: 2500,
    createdAt: '2024-01-15',
    lastActiveAt: '2024-01-29T14:32:00Z',
    apiKeyCount: 5,
  },
  {
    id: 'cust_2',
    companyName: 'StartupXYZ',
    contactEmail: 'dev@startupxyz.io',
    plan: 'PROFESSIONAL',
    status: 'active',
    monthlyUsage: 8500,
    monthlyLimit: 10000,
    currentBill: 499,
    createdAt: '2024-01-20',
    lastActiveAt: '2024-01-29T12:15:00Z',
    apiKeyCount: 2,
  },
  {
    id: 'cust_3',
    companyName: 'DataDriven Co',
    contactEmail: 'tech@datadriven.co',
    plan: 'STARTER',
    status: 'active',
    monthlyUsage: 750,
    monthlyLimit: 1000,
    currentBill: 199,
    createdAt: '2024-01-25',
    lastActiveAt: '2024-01-28T18:45:00Z',
    apiKeyCount: 1,
  },
  {
    id: 'cust_4',
    companyName: 'Enterprise Solutions Ltd',
    contactEmail: 'api@enterprise-sol.com',
    plan: 'ENTERPRISE',
    status: 'suspended',
    monthlyUsage: 0,
    monthlyLimit: 50000,
    currentBill: 1500,
    createdAt: '2023-11-10',
    lastActiveAt: '2024-01-15T09:00:00Z',
    apiKeyCount: 3,
  },
  {
    id: 'cust_5',
    companyName: 'Freelance Platform Inc',
    contactEmail: 'developers@freelanceplatform.com',
    plan: 'PROFESSIONAL',
    status: 'pending',
    monthlyUsage: 0,
    monthlyLimit: 10000,
    currentBill: 0,
    createdAt: '2024-01-28',
    lastActiveAt: '',
    apiKeyCount: 0,
  },
];

const mockMetrics: UsageMetrics = {
  totalRequests: 2450000,
  requestsChange: 12.5,
  activeCustomers: 47,
  customersChange: 8.2,
  monthlyRevenue: 35400,
  revenueChange: 15.3,
  errorRate: 0.12,
  errorRateChange: -0.03,
  avgLatency: 145,
  latencyChange: -8,
};

const mockBillingEvents: BillingEvent[] = [
  {
    id: 'bill_1',
    customerId: 'cust_1',
    companyName: 'TechCorp Industries',
    type: 'payment',
    amount: 2500,
    status: 'completed',
    createdAt: '2024-01-29T10:00:00Z',
  },
  {
    id: 'bill_2',
    customerId: 'cust_2',
    companyName: 'StartupXYZ',
    type: 'invoice',
    amount: 499,
    status: 'pending',
    createdAt: '2024-01-28T09:00:00Z',
  },
  {
    id: 'bill_3',
    customerId: 'cust_4',
    companyName: 'Enterprise Solutions Ltd',
    type: 'failed',
    amount: 1500,
    status: 'failed',
    createdAt: '2024-01-27T14:30:00Z',
  },
];

// Components
function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  format = 'number',
}: {
  title: string;
  value: number;
  change: number;
  icon: React.ElementType;
  format?: 'number' | 'currency' | 'percent' | 'ms';
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString()}`;
      case 'percent':
        return `${val.toFixed(2)}%`;
      case 'ms':
        return `${val}ms`;
      default:
        return val.toLocaleString();
    }
  };

  const isPositiveGood = format !== 'percent' && format !== 'ms';
  const isPositive = change > 0;
  const isGood = isPositiveGood ? isPositive : !isPositive;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-lg bg-blue-50 p-2">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        <div className={`flex items-center text-sm ${isGood ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900">{formatValue(value)}</h3>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    suspended: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    churned: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
    revoked: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const config =
    {
      STARTER: 'bg-gray-100 text-gray-700',
      PROFESSIONAL: 'bg-blue-100 text-blue-700',
      ENTERPRISE: 'bg-purple-100 text-purple-700',
    }[plan] || 'bg-gray-100 text-gray-700';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${config}`}>{plan}</span>;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const percentage = Math.min((used / limit) * 100, 100);
  const color =
    percentage >= 90 ? 'bg-red-500' : percentage >= 75 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>{used.toLocaleString()}</span>
        <span>{limit.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function IntelligenceAPIAdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'keys' | 'billing'>(
    'overview'
  );
  const [customers, setCustomers] = useState<APICustomer[]>(mockCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contactEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    const matchesPlan = planFilter === 'all' || customer.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Intelligence API Admin</h1>
              <p className="mt-1 text-sm text-gray-500">Manage API customers, keys, and billing</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-600 hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Export
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                <RefreshCw className="h-4 w-4" />
                Sync Data
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="-mb-px mt-6 flex gap-1 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'customers', label: 'Customers', icon: Building2 },
              { id: 'keys', label: 'API Keys', icon: Key },
              { id: 'billing', label: 'Billing', icon: CreditCard },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                change={mockMetrics.requestsChange}
                icon={Zap}
                title="Total API Requests"
                value={mockMetrics.totalRequests}
              />
              <MetricCard
                change={mockMetrics.customersChange}
                icon={Building2}
                title="Active Customers"
                value={mockMetrics.activeCustomers}
              />
              <MetricCard
                change={mockMetrics.revenueChange}
                format="currency"
                icon={DollarSign}
                title="Monthly Revenue"
                value={mockMetrics.monthlyRevenue}
              />
              <MetricCard
                change={mockMetrics.errorRateChange}
                format="percent"
                icon={AlertTriangle}
                title="Error Rate"
                value={mockMetrics.errorRate}
              />
              <MetricCard
                change={mockMetrics.latencyChange}
                format="ms"
                icon={Clock}
                title="Avg Latency"
                value={mockMetrics.avgLatency}
              />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Top Customers by Usage */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Top Customers by Usage</h3>
                <div className="space-y-4">
                  {customers
                    .filter((c) => c.status === 'active')
                    .sort((a, b) => b.monthlyUsage - a.monthlyUsage)
                    .slice(0, 5)
                    .map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{customer.companyName}</p>
                          <p className="text-sm text-gray-500">{customer.plan}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            {customer.monthlyUsage.toLocaleString()} calls
                          </p>
                          <p className="text-sm text-gray-500">
                            {((customer.monthlyUsage / customer.monthlyLimit) * 100).toFixed(1)}% of
                            limit
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Recent Billing Events */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent Billing Events</h3>
                <div className="space-y-4">
                  {mockBillingEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded-lg p-2 ${
                            event.type === 'payment'
                              ? 'bg-green-100'
                              : event.type === 'failed'
                                ? 'bg-red-100'
                                : 'bg-blue-100'
                          }`}
                        >
                          {event.type === 'payment' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : event.type === 'failed' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{event.companyName}</p>
                          <p className="text-sm capitalize text-gray-500">{event.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          ${event.amount.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">System Alerts</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">StartupXYZ approaching rate limit</p>
                    <p className="text-sm text-yellow-700">
                      85% of monthly quota used with 3 days remaining
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-800">
                      Payment failed for Enterprise Solutions Ltd
                    </p>
                    <p className="text-sm text-red-700">Account suspended - action required</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Search customers..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
                <option value="churned">Churned</option>
              </select>
              <select
                className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <option value="all">All Plans</option>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>

            {/* Customers Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Current Bill
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      API Keys
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{customer.companyName}</p>
                          <p className="text-sm text-gray-500">{customer.contactEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <PlanBadge plan={customer.plan} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="w-48 px-6 py-4">
                        <UsageBar limit={customer.monthlyLimit} used={customer.monthlyUsage} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">
                          ${customer.currentBill.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600">{customer.apiKeyCount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">API Key Management</h3>
              <p className="text-gray-500">
                View and manage all API keys across customers. Keys can be revoked if compromised.
              </p>
              {/* Key management table would go here */}
              <div className="mt-6 py-12 text-center text-gray-500">
                <Key className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p>API key management interface coming soon</p>
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">This Month</h3>
                <p className="text-3xl font-bold text-gray-900">$35,400</p>
                <p className="mt-1 text-sm text-green-600">+15.3% from last month</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Outstanding</h3>
                <p className="text-3xl font-bold text-yellow-600">$2,998</p>
                <p className="mt-1 text-sm text-gray-500">2 invoices pending</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Failed Payments</h3>
                <p className="text-3xl font-bold text-red-600">$1,500</p>
                <p className="mt-1 text-sm text-gray-500">1 retry scheduled</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Billing Configuration</h3>
              <p className="mb-6 text-gray-500">
                Configure billing cycles, payment retries, and invoice generation settings.
              </p>
              <div className="flex gap-4">
                <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-600 hover:bg-gray-50">
                  <CreditCard className="h-4 w-4" />
                  Run Billing Job
                </button>
                <button className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-600 hover:bg-gray-50">
                  <Mail className="h-4 w-4" />
                  Send Invoices
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
