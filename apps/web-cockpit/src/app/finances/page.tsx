'use client';

import { cn } from '@skillancer/ui';
import {
  FileText,
  Receipt,
  Building2,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Loader2,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { EarningsChart, PayoutHistory, PendingPayments, TaxSummary } from '@/components/finances';
import { useFinancialSummary, useBalance, useTransactions } from '@/hooks/api/use-cockpit-finances';

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
  type: 'income' | 'expense' | 'payout';
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
      {Boolean(metric.previousValue) && (
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
  const isPayout = transaction.type === 'payout';

  let bgClass = 'bg-red-50';
  let iconElement = <ArrowUpRight className="h-5 w-5 text-red-500" />;

  if (isIncome) {
    bgClass = 'bg-green-100';
    iconElement = <ArrowDownRight className="h-5 w-5 text-green-600" />;
  } else if (isPayout) {
    bgClass = 'bg-blue-100';
    iconElement = <DollarSign className="h-5 w-5 text-blue-600" />;
  }

  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-0">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', bgClass)}>
        {iconElement}
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
      {transaction.status === 'pending' && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
          Pending
        </span>
      )}
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

  // Fetch real financial data
  const { data: financialSummary, isLoading: isLoadingSummary } = useFinancialSummary();
  const { data: balanceData, isLoading: isLoadingBalance } = useBalance();
  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({
    limit: 6,
  });

  const isLoading = isLoadingSummary || isLoadingBalance || isLoadingTransactions;

  // Build metrics from real data
  const metrics: FinancialMetric[] = financialSummary
    ? [
        {
          label: 'Revenue (MTD)',
          value: financialSummary.revenue.monthToDate,
          format: 'currency' as const,
          trend: financialSummary.revenue.growthRate > 0 ? ('up' as const) : ('down' as const),
        },
        {
          label: 'Revenue (YTD)',
          value: financialSummary.revenue.yearToDate,
          format: 'currency' as const,
          trend: 'up' as const,
        },
        {
          label: 'Available Balance',
          value: financialSummary.balance.available,
          format: 'currency' as const,
          trend: 'neutral' as const,
        },
        {
          label: 'Pending',
          value: financialSummary.balance.pending,
          format: 'currency' as const,
          trend: 'neutral' as const,
        },
        {
          label: 'Profit (MTD)',
          value: financialSummary.profit.monthToDate,
          format: 'currency' as const,
          trend: 'up' as const,
        },
        {
          label: 'Profit Margin',
          value: financialSummary.profit.margin,
          format: 'percentage' as const,
          trend: 'up' as const,
        },
      ]
    : [];

  // Map transactions from API
  const recentTransactions: Transaction[] =
    transactionsData?.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type as 'income' | 'expense' | 'payout',
      category: t.category,
      status: t.status,
    })) ?? [];

  // Generate alerts from real data
  const alerts: Alert[] = [];

  if (balanceData && balanceData.pending > 0) {
    alerts.push({
      id: 'pending-balance',
      type: 'info' as const,
      title: 'Pending Payments',
      description: `$${balanceData.pending.toLocaleString()} in pending escrow releases`,
      action: { label: 'View Details', href: '/finances/payout' },
    });
  }

  if (balanceData?.pendingReleases && balanceData.pendingReleases.length > 0) {
    const totalPending = balanceData.pendingReleases.reduce(
      (sum, release) => sum + release.amount,
      0
    );
    alerts.push({
      id: 'escrow-releases',
      type: 'info' as const,
      title: `${balanceData.pendingReleases.length} Pending Escrow Releases`,
      description: `$${totalPending.toLocaleString()} will be released upon milestone completion`,
      action: { label: 'View Contracts', href: '/projects' },
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

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

      {/* Charts and Widgets Grid */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EarningsChart period={period === 'mtd' ? 'month' : 'year'} />
        <PendingPayments />
      </div>

      {/* Payout History and Tax Summary */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PayoutHistory limit={5} />
        <TaxSummary />
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
            <p className="text-sm text-gray-500">Manage billing</p>
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
            <p className="text-sm text-gray-500">
              ${financialSummary?.expenses.monthToDate.toLocaleString() ?? '0'} MTD
            </p>
          </div>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          href="/finances/payout"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Payouts</p>
            <p className="text-sm text-gray-500">
              ${balanceData?.available.toLocaleString() ?? '0'} available
            </p>
          </div>
        </Link>
        <Link
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
          href="/finances/reports"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <BarChart3 className="h-5 w-5 text-amber-600" />
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
