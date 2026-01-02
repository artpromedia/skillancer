/**
 * @module CFO Widget Components - Part 2
 * AR/AP and P&L Summary Widgets for CFO Dashboard
 */

'use client';

import { cn } from '@skillancer/ui';
import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';
import {
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useMemo } from 'react';

// ==================== Types ====================

export interface AgingBucket {
  range: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ARAPData {
  totalAR: number;
  totalAP: number;
  arAgingBuckets: AgingBucket[];
  apAgingBuckets: AgingBucket[];
  overdueAR: number;
  overdueAP: number;
  averageDaysToCollect?: number;
  averageDaysToPay?: number;
  topCustomers?: { name: string; amount: number }[];
  topVendors?: { name: string; amount: number }[];
}

export interface PLSummaryData {
  revenue: number;
  previousRevenue?: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  operatingIncome: number;
  netIncome: number;
  netMargin: number;
  period: string;
  expenseBreakdown?: { category: string; amount: number; percentage: number }[];
}

// ==================== Helper Functions ====================

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function getAgingColor(range: string): string {
  if (range.includes('0-30') || range.includes('Current')) return 'bg-green-500';
  if (range.includes('31-60')) return 'bg-yellow-500';
  if (range.includes('61-90')) return 'bg-orange-500';
  return 'bg-red-500';
}

// ==================== AR/AP Widget ====================

export interface ARAPWidgetProps {
  data: ARAPData;
  loading?: boolean;
  className?: string;
  variant?: 'compact' | 'detailed';
}

export function ARAPWidget({ data, loading, className, variant = 'compact' }: ARAPWidgetProps) {
  const netPosition = useMemo(() => data.totalAR - data.totalAP, [data.totalAR, data.totalAP]);

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-2">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-8 w-1/2 rounded bg-gray-200" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">AR / AP</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Receivables</p>
              <p className="text-2xl font-bold text-green-600">
                {formatShortCurrency(data.totalAR)}
              </p>
              {data.overdueAR > 0 && (
                <p className="mt-1 text-xs text-red-500">
                  {formatShortCurrency(data.overdueAR)} overdue
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Payables</p>
              <p className="text-2xl font-bold text-red-600">{formatShortCurrency(data.totalAP)}</p>
              {data.overdueAP > 0 && (
                <p className="mt-1 text-xs text-orange-500">
                  {formatShortCurrency(data.overdueAP)} overdue
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Net Position</span>
              <span
                className={cn(
                  'text-lg font-bold',
                  netPosition >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {netPosition >= 0 ? '+' : ''}
                {formatShortCurrency(netPosition)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Detailed variant
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Accounts Receivable & Payable</CardTitle>
            <CardDescription>Aging analysis and cash flow impact</CardDescription>
          </div>
          <Badge variant={netPosition >= 0 ? 'default' : 'destructive'}>
            Net: {formatShortCurrency(netPosition)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* AR Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-medium">
                <ArrowDownRight className="h-4 w-4 text-green-600" />
                Accounts Receivable
              </h4>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(data.totalAR)}
              </span>
            </div>

            <div className="space-y-2">
              {data.arAgingBuckets.map((bucket, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{bucket.range}</span>
                    <span>
                      {formatShortCurrency(bucket.amount)} ({bucket.count})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={cn('h-2 rounded-full', getAgingColor(bucket.range))}
                      style={{ width: `${bucket.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {data.averageDaysToCollect !== undefined && (
              <p className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                Avg. {data.averageDaysToCollect} days to collect
              </p>
            )}

            {data.topCustomers && data.topCustomers.length > 0 && (
              <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium">Top Customers</p>
                {data.topCustomers.slice(0, 3).map((customer, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 text-sm">
                    <span className="truncate">{customer.name}</span>
                    <span className="font-medium">{formatShortCurrency(customer.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AP Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-medium">
                <ArrowUpRight className="h-4 w-4 text-red-600" />
                Accounts Payable
              </h4>
              <span className="text-lg font-bold text-red-600">{formatCurrency(data.totalAP)}</span>
            </div>

            <div className="space-y-2">
              {data.apAgingBuckets.map((bucket, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{bucket.range}</span>
                    <span>
                      {formatShortCurrency(bucket.amount)} ({bucket.count})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={cn('h-2 rounded-full', getAgingColor(bucket.range))}
                      style={{ width: `${bucket.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {data.averageDaysToPay !== undefined && (
              <p className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                Avg. {data.averageDaysToPay} days to pay
              </p>
            )}

            {data.topVendors && data.topVendors.length > 0 && (
              <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-xs font-medium">Top Vendors</p>
                {data.topVendors.slice(0, 3).map((vendor, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 text-sm">
                    <span className="truncate">{vendor.name}</span>
                    <span className="font-medium">{formatShortCurrency(vendor.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== P&L Summary Widget ====================

export interface PLSummaryWidgetProps {
  data: PLSummaryData;
  loading?: boolean;
  className?: string;
  showBreakdown?: boolean;
}

export function PLSummaryWidget({
  data,
  loading,
  className,
  showBreakdown = false,
}: PLSummaryWidgetProps) {
  const revenueChange = useMemo(() => {
    if (!data.previousRevenue) return null;
    const diff = data.revenue - data.previousRevenue;
    const percentage = (diff / data.previousRevenue) * 100;
    return { diff, percentage, isPositive: diff >= 0 };
  }, [data.revenue, data.previousRevenue]);

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-2">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-8 w-1/2 rounded bg-gray-200" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-muted-foreground text-sm font-medium">P&L Summary</CardTitle>
            <CardDescription>{data.period}</CardDescription>
          </div>
          {revenueChange &&
            (revenueChange.isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Revenue */}
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatCurrency(data.revenue)}</span>
          <span className="text-muted-foreground text-sm">revenue</span>
          {revenueChange && (
            <Badge
              className={cn(
                'ml-auto text-xs',
                revenueChange.isPositive ? 'text-green-600' : 'text-red-600'
              )}
              variant="outline"
            >
              {revenueChange.isPositive ? '+' : ''}
              {revenueChange.percentage.toFixed(1)}%
            </Badge>
          )}
        </div>

        {/* Key Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gross Profit</span>
            <div className="text-right">
              <span className="font-medium">{formatShortCurrency(data.grossProfit)}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                ({data.grossMargin.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Operating Expenses</span>
            <span className="font-medium text-red-600">
              -{formatShortCurrency(data.operatingExpenses)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Operating Income</span>
            <span
              className={cn(
                'font-medium',
                data.operatingIncome >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {data.operatingIncome >= 0 ? '+' : ''}
              {formatShortCurrency(data.operatingIncome)}
            </span>
          </div>

          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="font-medium">Net Income</span>
            <div className="text-right">
              <span
                className={cn(
                  'text-lg font-bold',
                  data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {data.netIncome >= 0 ? '+' : ''}
                {formatShortCurrency(data.netIncome)}
              </span>
              <span className="text-muted-foreground ml-2 text-xs">
                ({data.netMargin.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        {showBreakdown && data.expenseBreakdown && data.expenseBreakdown.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-muted-foreground mb-3 text-xs font-medium">Expense Breakdown</p>
            <div className="space-y-2">
              {data.expenseBreakdown.slice(0, 5).map((expense, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">{expense.category}</span>
                    <span>{formatShortCurrency(expense.amount)}</span>
                  </div>
                  <Progress className="h-1" value={expense.percentage} />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Individual AR/AP Widgets ====================

export interface AccountsReceivableWidgetProps {
  total: number;
  current: number;
  overdue30: number;
  overdue60: number;
  overdue90: number;
  change: number;
}

export function AccountsReceivableWidget({
  total,
  current,
  overdue30,
  overdue60,
  overdue90,
  change,
}: AccountsReceivableWidgetProps) {
  const totalOverdue = overdue30 + overdue60 + overdue90;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Accounts Receivable</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="text-foreground text-2xl font-bold">{formatShortCurrency(total)}</span>
          <Badge
            className={change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          >
            {change >= 0 ? (
              <ArrowUpRight className="mr-1 h-3 w-3" />
            ) : (
              <ArrowDownRight className="mr-1 h-3 w-3" />
            )}
            {Math.abs(change)}%
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current</span>
          <span className="font-medium">{formatShortCurrency(current)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overdue (30d)</span>
          <span className="font-medium text-yellow-600">{formatShortCurrency(overdue30)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overdue (60d)</span>
          <span className="font-medium text-orange-600">{formatShortCurrency(overdue60)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overdue (90d+)</span>
          <span className="font-medium text-red-600">{formatShortCurrency(overdue90)}</span>
        </div>
        <Progress className="h-2" value={(current / total) * 100} />
      </CardContent>
    </Card>
  );
}

export interface AccountsPayableWidgetProps {
  total: number;
  dueSoon: number;
  overdue: number;
  change: number;
}

export function AccountsPayableWidget({
  total,
  dueSoon,
  overdue,
  change,
}: AccountsPayableWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Accounts Payable</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="text-foreground text-2xl font-bold">{formatShortCurrency(total)}</span>
          <Badge
            className={change <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          >
            {change <= 0 ? (
              <ArrowDownRight className="mr-1 h-3 w-3" />
            ) : (
              <ArrowUpRight className="mr-1 h-3 w-3" />
            )}
            {Math.abs(change)}%
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Due Soon</span>
          <span className="font-medium text-yellow-600">{formatShortCurrency(dueSoon)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overdue</span>
          <span className="font-medium text-red-600">{formatShortCurrency(overdue)}</span>
        </div>
        <Progress className="h-2" value={((total - overdue) / total) * 100} />
      </CardContent>
    </Card>
  );
}

export default {
  ARAPWidget,
  PLSummaryWidget,
  AccountsReceivableWidget,
  AccountsPayableWidget,
};
