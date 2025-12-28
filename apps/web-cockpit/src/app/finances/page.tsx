'use client';

import { cn } from '@skillancer/ui';
import {
  FileText,
  Receipt,
  Building2,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Clock,
  PieChart,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// Types
type TrendDirection = 'up' | 'down' | 'neutral';

interface FinancialMetric {
  label: string;
  value: number;
  previousValue?: number;
  format: 'currency' | 'percentage';
  trend?: TrendDirection;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  status?: 'pending' | 'completed' | 'failed';
}

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'urgent';
  title: string;
  description: string;
  action?: { label: string; href: string };
}

// Mock data
const metrics: FinancialMetric[] = [
  { label: 'Revenue (MTD)', value: 12450, previousValue: 10200, format: 'currency', trend: 'up' },
  { label: 'Revenue (YTD)', value: 148500, previousValue: 132000, format: 'currency', trend: 'up' },
  { label: 'Outstanding', value: 8750, format: 'currency', trend: 'neutral' },
  { label: 'Expenses (MTD)', value: 2340, previousValue: 2100, format: 'currency', trend: 'up' },
  { label: 'Profit (MTD)', value: 10110, previousValue: 8100, format: 'currency', trend: 'up' },
  { label: 'Profit Margin', value: 81.2, previousValue: 79.4, format: 'percentage', trend: 'up' },
];

const recentTransactions: Transaction[] = [
  {
    id: '1',
    date: '2024-12-26',
    description: 'Payment from Acme Corp',
    amount: 4500,
    type: 'income',
    status: 'completed',
  },
  {
    id: '2',
    date: '2024-12-25',
    description: 'Figma Subscription',
    amount: -15,
    type: 'expense',
    category: 'Software',
  },
  {
    id: '3',
    date: '2024-12-24',
    description: 'Payment from TechStart',
    amount: 2800,
    type: 'income',
    status: 'completed',
  },
  {
    id: '4',
    date: '2024-12-23',
    description: 'AWS Hosting',
    amount: -89,
    type: 'expense',
    category: 'Infrastructure',
  },
  {
    id: '5',
    date: '2024-12-22',
    description: 'Payment from Design Co',
    amount: 1650,
    type: 'income',
    status: 'completed',
  },
  {
    id: '6',
    date: '2024-12-21',
    description: 'Adobe Creative Cloud',
    amount: -55,
    type: 'expense',
    category: 'Software',
  },
];

const alerts: Alert[] = [
  {
    id: '1',
    type: 'urgent',
    title: '2 Overdue Invoices',
    description: '$3,200 outstanding for more than 30 days',
    action: { label: 'View Invoices', href: '/invoices?status=overdue' },
  },
  {
    id: '2',
    type: 'warning',
    title: 'Q4 Estimated Taxes Due',
    description: 'Due January 15, 2025 - Estimated: $4,850',
    action: { label: 'View Details', href: '/finances/taxes' },
  },
];

const cashFlowData = [
  { month: 'Jul', income: 11200, expenses: 1800 },
  { month: 'Aug', income: 13500, expenses: 2100 },
  { month: 'Sep', income: 10800, expenses: 1950 },
  { month: 'Oct', income: 15200, expenses: 2400 },
  { month: 'Nov', income: 12800, expenses: 2200 },
  { month: 'Dec', income: 12450, expenses: 2340 },
];

// Helper functions
function getTrendColorClass(trend?: TrendDirection): string {
  if (trend === 'up') return 'text-green-600';
  if (trend === 'down') return 'text-red-600';
  return 'text-gray-500';
}

function getTrendIcon(trend?: TrendDirection): React.ReactNode {
  if (trend === 'up') return <ArrowUpRight className="h-4 w-4" />;
  if (trend === 'down') return <ArrowDownRight className="h-4 w-4" />;
  return null;
}

function getPeriodLabel(period: 'mtd' | 'ytd' | 'all'): string {
  if (period === 'mtd') return 'Month to Date';
  if (period === 'ytd') return 'Year to Date';
  return 'All Time';
}

// Components
function MetricCard({ metric }: Readonly<{ metric: FinancialMetric }>) {
  const percentChange = metric.previousValue
    ? ((metric.value - metric.previousValue) / metric.previousValue) * 100
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 text-sm text-gray-500">{metric.label}</div>
      <div className="text-2xl font-bold text-gray-900">
        {metric.format === 'currency'
          ? `$${metric.value.toLocaleString()}`
          : `${metric.value.toFixed(1)}%`}
      </div>
      {metric.previousValue && (
        <div
          className={cn('mt-1 flex items-center gap-1 text-sm', getTrendColorClass(metric.trend))}
        >
          {getTrendIcon(metric.trend)}
          <span>{Math.abs(percentChange).toFixed(1)}% vs last month</span>
        </div>
      )}
    </div>
  );
}

function CashFlowChart() {
  const maxValue = Math.max(...cashFlowData.flatMap((d) => [d.income, d.expenses]));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Cash Flow</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-gray-600">Income</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <span className="text-gray-600">Expenses</span>
          </div>
        </div>
      </div>
      <div className="flex h-48 items-end gap-4">
        {cashFlowData.map((data) => (
          <div key={data.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end gap-1" style={{ height: '180px' }}>
              <div
                className="flex-1 rounded-t bg-green-500 transition-all"
                style={{ height: `${(data.income / maxValue) * 100}%` }}
              />
              <div
                className="flex-1 rounded-t bg-red-400 transition-all"
                style={{ height: `${(data.expenses / maxValue) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{data.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomeBreakdown() {
  const sources = [
    { name: 'Skillancer', amount: 45000, color: '#3B82F6', percent: 30 },
    { name: 'Upwork', amount: 52000, color: '#14A800', percent: 35 },
    { name: 'Direct Clients', amount: 38000, color: '#8B5CF6', percent: 26 },
    { name: 'Fiverr', amount: 13500, color: '#1DBF73', percent: 9 },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Income by Source</h3>
        <Link className="text-sm text-blue-600 hover:text-blue-700" href="/finances/reports">
          View Report
        </Link>
      </div>
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{source.name}</span>
              <span className="font-medium text-gray-900">${source.amount.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${source.percent}%`, backgroundColor: source.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertCard({ alert }: Readonly<{ alert: Alert }>) {
  const iconConfig = {
    urgent: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
    },
    warning: { icon: Clock, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' },
    info: { icon: Calendar, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
  };
  const config = iconConfig[alert.type];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-3', config.bg, config.border)}>
      <Icon className={cn('mt-0.5 h-5 w-5', config.text)} />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', config.text)}>{alert.title}</p>
        <p className="text-sm text-gray-600">{alert.description}</p>
      </div>
      {alert.action && (
        <Link
          className={cn('whitespace-nowrap text-sm font-medium', config.text, 'hover:underline')}
          href={alert.action.href}
        >
          {alert.action.label}
        </Link>
      )}
    </div>
  );
}

function TransactionRow({ transaction }: Readonly<{ transaction: Transaction }>) {
  const isIncome = transaction.type === 'income';

  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-0">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          isIncome ? 'bg-green-100' : 'bg-red-50'
        )}
      >
        {isIncome ? (
          <ArrowDownRight className="h-5 w-5 text-green-600" />
        ) : (
          <ArrowUpRight className="h-5 w-5 text-red-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{transaction.description}</p>
        <p className="text-sm text-gray-500">
          {new Date(transaction.date).toLocaleDateString()}
          {transaction.category && ` • ${transaction.category}`}
        </p>
      </div>
      <div className={cn('font-semibold', isIncome ? 'text-green-600' : 'text-gray-900')}>
        {isIncome ? '+' : ''}${Math.abs(transaction.amount).toLocaleString()}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    {
      icon: FileText,
      label: 'Create Invoice',
      href: '/invoices/new',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      icon: Receipt,
      label: 'Log Expense',
      href: '/expenses/new',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      icon: Building2,
      label: 'Connect Bank',
      href: '/finances/accounts',
      color: 'bg-green-600 hover:bg-green-700',
    },
  ];

  return (
    <div className="flex gap-3">
      {actions.map((action) => (
        <Link
          key={action.label}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
            action.color
          )}
          href={action.href}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}

export default function FinancesPage() {
  const [period, setPeriod] = useState<'mtd' | 'ytd' | 'all'>('mtd');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finances</h1>
          <p className="text-gray-500">Track income, expenses, and financial health</p>
        </div>
        <QuickActions />
      </div>

      {/* Period Selector */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {(['mtd', 'ytd', 'all'] as const).map((p) => (
            <button
              key={p}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                period === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
              onClick={() => setPeriod(p)}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CashFlowChart />
        <IncomeBreakdown />
      </div>

      {/* Recent Transactions */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
          <Link
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            href="/finances/accounts"
          >
            View All
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="p-4">
          {recentTransactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          href="/invoices"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Invoices</p>
            <p className="text-sm text-gray-500">3 pending</p>
          </div>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          href="/expenses"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
            <Receipt className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Expenses</p>
            <p className="text-sm text-gray-500">$2,340 MTD</p>
          </div>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          href="/finances/taxes"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <PieChart className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Taxes</p>
            <p className="text-sm text-gray-500">Q4 due soon</p>
          </div>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          href="/finances/reports"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
            <BarChart3 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Reports</p>
            <p className="text-sm text-gray-500">P&L, Tax Summary</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
