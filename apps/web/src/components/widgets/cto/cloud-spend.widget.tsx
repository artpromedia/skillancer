'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, TrendingDown, Loader2, AlertTriangle } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface CloudSpendWidgetProps {
  engagementId: string;
  integrationId?: string;
}

interface CloudSpendData {
  totalCost: number;
  currency: string;
  period: { start: string; end: string };
  topServices: Array<{ service: string; cost: number; percentage: number }>;
  trend: Array<{ period: string; cost: number }>;
  changePercent: number;
  isIncreasing: boolean;
  projectedMonthEnd: number;
  budget?: number;
  budgetUsedPercent?: number;
}

export function CloudSpendWidget({ engagementId, integrationId }: CloudSpendWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['widget', 'cloud-spend', engagementId, integrationId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: CloudSpendData }>(
        `/integrations/${integrationId}/widgets/cost-summary?engagementId=${engagementId}`
      );
      return response.data;
    },
    enabled: !!integrationId,
    refetchInterval: 3600000, // 1 hour
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cloud Spend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Cloud Spend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {integrationId ? 'Failed to load cost data' : 'Connect AWS/GCP/Azure to view'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cloud Spend
          </span>
          <div className="flex items-center gap-1">
            {data.isIncreasing ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-500" />
            )}
            <span
              className={`text-sm font-medium ${data.isIncreasing ? 'text-red-500' : 'text-green-500'}`}
            >
              {data.changePercent > 0 ? '+' : ''}
              {data.changePercent}%
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Month Total */}
        <div className="text-center">
          <p className="text-3xl font-bold">{formatCurrency(data.totalCost)}</p>
          <p className="text-muted-foreground text-sm">
            {data.period.start} - {data.period.end}
          </p>
        </div>

        {/* Budget Progress */}
        {data.budget && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">{formatCurrency(data.budget)}</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={`h-full transition-all ${
                  (data.budgetUsedPercent || 0) > 90
                    ? 'bg-red-500'
                    : (data.budgetUsedPercent || 0) > 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(data.budgetUsedPercent || 0, 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-right text-xs">
              {data.budgetUsedPercent}% used
            </p>
          </div>
        )}

        {/* Top Services */}
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">Top Services</h4>
          <div className="space-y-2">
            {data.topServices
              .slice(0, 5)
              .map(
                (service: { service: string; cost: number; percentage: number }, index: number) => (
                  <div key={service.service} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="max-w-[60%] truncate">{service.service}</span>
                      <span className="font-medium">{formatCurrency(service.cost)}</span>
                    </div>
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className={`h-full ${getServiceColor(index)}`}
                        style={{ width: `${service.percentage}%` }}
                      />
                    </div>
                  </div>
                )
              )}
          </div>
        </div>

        {/* Projected Month End */}
        {data.projectedMonthEnd > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Projected Month End</span>
              <span className="text-lg font-semibold">
                {formatCurrency(data.projectedMonthEnd)}
              </span>
            </div>
          </div>
        )}

        {/* Mini Trend Chart */}
        {data.trend && data.trend.length > 1 && (
          <div className="border-t pt-2">
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">6 Month Trend</h4>
            <div className="flex h-16 items-end justify-between gap-1">
              {data.trend.map((point: { period: string; cost: number }, i: number) => {
                const maxCost = Math.max(
                  ...data.trend.map((t: { period: string; cost: number }) => t.cost)
                );
                const height = maxCost > 0 ? (point.cost / maxCost) * 100 : 0;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="bg-primary/60 w-full rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(point.period).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getServiceColor(index: number): string {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
  return colors[index % colors.length] ?? 'bg-gray-500';
}

export default CloudSpendWidget;
