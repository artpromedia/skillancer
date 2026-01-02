'use client';

/**
 * DAU/WAU/MAU Widget for CPO Dashboard
 * Displays daily, weekly, and monthly active users with trends
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';

interface UserMetricsData {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: number;
  wauTrend: number;
  mauTrend: number;
  stickiness: number;
  sparklineData?: Array<{ date: string; dau: number; wau: number; mau: number }>;
}

interface DAUWAUMAUWidgetProps {
  engagementId: string;
  data?: UserMetricsData;
  className?: string;
}

// Demo data for development
const demoData: UserMetricsData = {
  dau: 12453,
  wau: 45782,
  mau: 156892,
  dauTrend: 8.3,
  wauTrend: 5.2,
  mauTrend: 12.1,
  stickiness: 7.9,
  sparklineData: [
    { date: '2025-12-25', dau: 11200, wau: 43000, mau: 152000 },
    { date: '2025-12-26', dau: 11800, wau: 44200, mau: 154000 },
    { date: '2025-12-27', dau: 12100, wau: 44800, mau: 155200 },
    { date: '2025-12-28', dau: 11900, wau: 45100, mau: 155800 },
    { date: '2025-12-29', dau: 12300, wau: 45400, mau: 156200 },
    { date: '2025-12-30', dau: 12200, wau: 45600, mau: 156500 },
    { date: '2025-12-31', dau: 12453, wau: 45782, mau: 156892 },
  ],
};

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function TrendIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-medium',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}
    >
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 80;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="h-8 w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  trend,
  sparklineData,
  color,
}: {
  label: string;
  value: number;
  trend: number;
  sparklineData?: number[];
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium uppercase">{label}</span>
        <TrendIndicator value={trend} />
      </div>
      <div className="text-2xl font-bold">{formatNumber(value)}</div>
      {sparklineData && <Sparkline color={color} data={sparklineData} />}
    </div>
  );
}

export function DAUWAUMAUWidget({
  engagementId,
  data = demoData,
  className,
}: DAUWAUMAUWidgetProps) {
  const dauSparkline = data.sparklineData?.map((d) => d.dau);
  const wauSparkline = data.sparklineData?.map((d) => d.wau);
  const mauSparkline = data.sparklineData?.map((d) => d.mau);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Users className="h-4 w-4" />
          User Metrics
        </CardTitle>
        <div className="bg-muted rounded-md px-2 py-1 text-xs">
          <span className="text-muted-foreground">Stickiness: </span>
          <span className="font-medium">{data.stickiness.toFixed(1)}%</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            color="#10b981"
            label="DAU"
            sparklineData={dauSparkline}
            trend={data.dauTrend}
            value={data.dau}
          />
          <MetricCard
            color="#3b82f6"
            label="WAU"
            sparklineData={wauSparkline}
            trend={data.wauTrend}
            value={data.wau}
          />
          <MetricCard
            color="#8b5cf6"
            label="MAU"
            sparklineData={mauSparkline}
            trend={data.mauTrend}
            value={data.mau}
          />
        </div>
      </CardContent>
    </Card>
  );
}
