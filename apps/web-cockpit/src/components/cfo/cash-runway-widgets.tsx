/**
 * @module CFO Widget Components - Part 1
 * Cash Position and Runway Widgets for CFO Dashboard
 */

'use client';

import { cn } from '@skillancer/ui';
import { Badge } from '@skillancer/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useMemo } from 'react';

// ==================== Types ====================

export interface CashPositionData {
  totalCash: number;
  checking: { count: number; balance: number };
  savings: { count: number; balance: number };
  credit: { count: number; balance: number };
  previousPeriodCash?: number;
  currency?: string;
}

export interface RunwayData {
  months: number;
  zeroCashDate: string | null;
  burnRate: {
    grossBurn: number;
    netBurn: number;
    burnMultiple?: number;
  };
  isDefaultAlive?: boolean;
  monthsToBreakeven?: number | null;
}

export interface BurnRateData {
  grossBurn: number;
  netBurn: number;
  previousGrossBurn?: number;
  previousNetBurn?: number;
  burnMultiple?: number;
  trend: 'up' | 'down' | 'stable';
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
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function getRunwayStatus(months: number): {
  color: string;
  label: string;
  icon: typeof CheckCircle2;
} {
  if (months >= 18) {
    return { color: 'text-green-600 bg-green-100', label: 'Healthy', icon: CheckCircle2 };
  }
  if (months >= 12) {
    return { color: 'text-yellow-600 bg-yellow-100', label: 'Caution', icon: AlertTriangle };
  }
  if (months >= 6) {
    return { color: 'text-orange-600 bg-orange-100', label: 'Warning', icon: AlertTriangle };
  }
  return { color: 'text-red-600 bg-red-100', label: 'Critical', icon: AlertTriangle };
}

// ==================== Cash Position Widget ====================

export interface CashPositionWidgetProps {
  totalCash: number;
  change?: number;
  accounts?: { name: string; balance: number; type: string }[];
  loading?: boolean;
  className?: string;
}

export function CashPositionWidget({
  totalCash,
  change,
  accounts,
  loading,
  className,
}: CashPositionWidgetProps) {
  const changeInfo = useMemo(() => {
    if (change === undefined) return null;
    return { percentage: change, isPositive: change >= 0 };
  }, [change]);

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
          <CardTitle className="text-muted-foreground text-sm font-medium">Cash Position</CardTitle>
          <DollarSign className="text-muted-foreground h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatCurrency(totalCash)}</span>
          {changeInfo && (
            <Badge
              className={cn('text-xs', changeInfo.isPositive ? 'text-green-600' : 'text-red-600')}
              variant="outline"
            >
              {changeInfo.isPositive ? (
                <ArrowUpRight className="mr-1 h-3 w-3" />
              ) : (
                <ArrowDownRight className="mr-1 h-3 w-3" />
              )}
              {changeInfo.percentage.toFixed(1)}%
            </Badge>
          )}
        </div>

        {accounts && accounts.length > 0 && (
          <div className="mt-4 space-y-3">
            {accounts.map((account) => (
              <div key={account.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{account.name}</span>
                <span className="font-medium">{formatShortCurrency(account.balance)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Runway Widget ====================

export interface RunwayWidgetProps {
  months: number;
  burnRate: number | { grossBurn?: number; netBurn?: number; burnMultiple?: number };
  zeroCashDate?: Date | string | null;
  loading?: boolean;
  className?: string;
}

export function RunwayWidget({
  months,
  burnRate,
  zeroCashDate,
  loading,
  className,
}: RunwayWidgetProps) {
  const status = useMemo(() => getRunwayStatus(months), [months]);
  const StatusIcon = status.icon;

  // Normalize burnRate to a number
  const netBurn =
    typeof burnRate === 'number' ? burnRate : burnRate.netBurn || burnRate.grossBurn || 0;

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="pb-2">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-8 w-1/2 rounded bg-gray-200" />
          <div className="h-2 w-full rounded bg-gray-200" />
        </CardContent>
      </Card>
    );
  }

  const maxRunway = 24; // 2 years max for visual
  const runwayPercentage = Math.min((months / maxRunway) * 100, 100);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground text-sm font-medium">Runway</CardTitle>
          <Clock className="text-muted-foreground h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl font-bold">{months.toFixed(1)}</span>
          <span className="text-muted-foreground text-xl">months</span>
          <Badge className={cn('ml-auto', status.color)}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        <Progress className="mb-4 h-2" value={runwayPercentage} />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Burn Rate</p>
            <p className="font-medium">{formatShortCurrency(netBurn)}/mo</p>
          </div>
          {zeroCashDate && (
            <div>
              <p className="text-muted-foreground">Zero Cash</p>
              <p className="font-medium text-red-600">
                {new Date(zeroCashDate).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Burn Rate Widget ====================

export interface BurnRateWidgetProps {
  data: BurnRateData;
  loading?: boolean;
  className?: string;
}

export function BurnRateWidget({ data, loading, className }: BurnRateWidgetProps) {
  const netBurnChange = useMemo(() => {
    if (!data.previousNetBurn) return null;
    const diff = data.netBurn - data.previousNetBurn;
    const percentage = (diff / data.previousNetBurn) * 100;
    return { diff, percentage, isImproving: diff < 0 };
  }, [data.netBurn, data.previousNetBurn]);

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
          <CardTitle className="text-muted-foreground text-sm font-medium">Burn Rate</CardTitle>
          {data.trend === 'up' ? (
            <TrendingUp className="h-4 w-4 text-red-500" />
          ) : data.trend === 'down' ? (
            <TrendingDown className="h-4 w-4 text-green-500" />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{formatCurrency(data.netBurn)}</span>
          <span className="text-muted-foreground">/month</span>
          {netBurnChange && (
            <Badge
              className={cn(
                'ml-auto text-xs',
                netBurnChange.isImproving ? 'text-green-600' : 'text-red-600'
              )}
              variant="outline"
            >
              {netBurnChange.isImproving ? '↓' : '↑'}{' '}
              {Math.abs(netBurnChange.percentage).toFixed(1)}%
            </Badge>
          )}
        </div>

        <CardDescription className="mt-1">Net burn (expenses - revenue)</CardDescription>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gross Burn</span>
            <span className="font-medium">{formatShortCurrency(data.grossBurn)}/mo</span>
          </div>

          {data.burnMultiple !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Burn Multiple</span>
              <span
                className={cn(
                  'font-medium',
                  data.burnMultiple < 1
                    ? 'text-red-600'
                    : data.burnMultiple < 2
                      ? 'text-yellow-600'
                      : 'text-green-600'
                )}
              >
                {data.burnMultiple.toFixed(2)}x
              </span>
            </div>
          )}
        </div>

        {data.burnMultiple !== undefined && (
          <div className="text-muted-foreground mt-4 text-xs">
            <p>
              Burn Multiple = Net New ARR / Burn.
              {data.burnMultiple >= 2
                ? ' Excellent efficiency!'
                : data.burnMultiple >= 1
                  ? ' Good efficiency.'
                  : ' Consider reducing burn.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default {
  CashPositionWidget,
  RunwayWidget,
  BurnRateWidget,
};
