/**
 * Earnings Chart Component
 * Displays earnings over time with trend visualization
 */

'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useEarnings } from '@/hooks/api/use-cockpit-finances';

interface EarningsChartProps {
  period?: 'week' | 'month' | 'quarter' | 'year';
  className?: string;
}

export function EarningsChart({ period = 'month', className = '' }: Readonly<EarningsChartProps>) {
  const { data: earningsData, isLoading } = useEarnings();

  // TODO: Get historical earnings data by period
  // For now, generate sample data based on current earnings
  const chartData = [
    { date: 'Week 1', amount: 2800 },
    { date: 'Week 2', amount: 3200 },
    { date: 'Week 3', amount: 2950 },
    { date: 'Week 4', amount: 3500 },
  ];

  const total = earningsData?.monthToDate ?? 0;
  const trend = 15.3; // TODO: Calculate from historical data

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Earnings Over Time</h3>
          <p className="text-sm text-gray-500">Monthly earnings breakdown</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">${total.toLocaleString()}</p>
          <div
            className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>
              {Math.abs(trend)}% vs last {period}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer height={250} width="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0]?.payload as { date: string; amount: number } | undefined;
                return (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="font-medium text-gray-900">${payload[0]?.value}</p>
                    <p className="text-sm text-gray-500">{data?.date}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            activeDot={{ r: 6 }}
            dataKey="amount"
            dot={{ r: 4 }}
            stroke="#3B82F6"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
