'use client';

import { cn } from '@skillancer/ui';
import { BarChart3, TrendingUp, TrendingDown, Download, ChevronDown } from 'lucide-react';
import { useState } from 'react';

// Types
interface RevenueData {
  month: string;
  invoiced: number;
  collected: number;
  gross: number;
  net: number;
}

// Helper Functions
function getValueByViewMode(
  item: RevenueData | null | undefined,
  viewMode: 'gross' | 'net'
): number {
  if (!item) return 0;
  return viewMode === 'gross' ? item.gross : item.net;
}

interface SourceBreakdown {
  source: string;
  amount: number;
  color: string;
}

interface RevenueChartProps {
  data?: RevenueData[];
  sourceBreakdown?: SourceBreakdown[];
  previousYearData?: RevenueData[];
  className?: string;
}

// Mock data
const mockData: RevenueData[] = [
  { month: 'Jan', invoiced: 11500, collected: 10200, gross: 10200, net: 8670 },
  { month: 'Feb', invoiced: 13200, collected: 12800, gross: 12800, net: 10880 },
  { month: 'Mar', invoiced: 10800, collected: 11500, gross: 11500, net: 9775 },
  { month: 'Apr', invoiced: 14500, collected: 13200, gross: 13200, net: 11220 },
  { month: 'May', invoiced: 12300, collected: 14500, gross: 14500, net: 12325 },
  { month: 'Jun', invoiced: 15800, collected: 12300, gross: 12300, net: 10455 },
  { month: 'Jul', invoiced: 11200, collected: 15800, gross: 15800, net: 13430 },
  { month: 'Aug', invoiced: 13500, collected: 11200, gross: 11200, net: 9520 },
  { month: 'Sep', invoiced: 10800, collected: 13500, gross: 13500, net: 11475 },
  { month: 'Oct', invoiced: 15200, collected: 10800, gross: 10800, net: 9180 },
  { month: 'Nov', invoiced: 12800, collected: 15200, gross: 15200, net: 12920 },
  { month: 'Dec', invoiced: 12450, collected: 12800, gross: 12800, net: 10880 },
];

const mockSourceBreakdown: SourceBreakdown[] = [
  { source: 'Skillancer', amount: 45000, color: '#3B82F6' },
  { source: 'Upwork', amount: 52000, color: '#14A800' },
  { source: 'Fiverr', amount: 13500, color: '#1DBF73' },
  { source: 'Direct Clients', amount: 38000, color: '#8B5CF6' },
];

const mockPreviousYearData: RevenueData[] = mockData.map((d) => ({
  ...d,
  invoiced: Math.floor(d.invoiced * 0.85),
  collected: Math.floor(d.collected * 0.85),
  gross: Math.floor(d.gross * 0.85),
  net: Math.floor(d.net * 0.85),
}));

export function RevenueChart({
  data = mockData,
  sourceBreakdown = mockSourceBreakdown,
  previousYearData = mockPreviousYearData,
  className,
}: Readonly<RevenueChartProps>) {
  const [viewMode, setViewMode] = useState<'gross' | 'net'>('gross');
  // Note: showOverlay state reserved for future overlay feature
  const [_showOverlay] = useState<'invoiced' | 'collected' | 'none'>('none');
  const [showComparison, setShowComparison] = useState(false);
  const [showSourceBreakdown, setShowSourceBreakdown] = useState(false);

  // Calculate totals
  const totalRevenue = data.reduce((sum, d) => sum + (viewMode === 'gross' ? d.gross : d.net), 0);
  const previousTotal = previousYearData.reduce(
    (sum, d) => sum + (viewMode === 'gross' ? d.gross : d.net),
    0
  );
  const percentChange = ((totalRevenue - previousTotal) / previousTotal) * 100;

  // Get max value for scaling
  const maxValue = Math.max(
    ...data.flatMap((d) => [d.invoiced, d.collected, d.gross, d.net]),
    ...(showComparison ? previousYearData.flatMap((d) => [d.gross, d.net]) : [])
  );

  const handleExport = () => {
    // Export data as CSV
    const headers = 'Month,Invoiced,Collected,Gross,Net\n';
    const rows = data
      .map((d) => `${d.month},${d.invoiced},${d.collected},${d.gross},${d.net}`)
      .join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revenue-data.csv';
    a.click();
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Revenue Overview
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">
              ${totalRevenue.toLocaleString()}
            </span>
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium',
                percentChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}
            >
              {percentChange >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {Math.abs(percentChange).toFixed(1)}% YoY
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Gross/Net Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            {(['gross', 'net'] as const).map((mode) => (
              <button
                key={mode}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
                onClick={() => setViewMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Overlay Selector */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              onClick={() => {}}
            >
              Overlay
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Comparison Toggle */}
          <button
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              showComparison
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
            onClick={() => setShowComparison(!showComparison)}
          >
            vs Last Year
          </button>

          {/* Export */}
          <button
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="flex h-64 items-end gap-2">
          {data.map((item, index) => {
            const prevItem = showComparison ? previousYearData[index] : null;
            const currentValue = getValueByViewMode(item, viewMode);
            const prevValue = getValueByViewMode(prevItem, viewMode);

            return (
              <div key={item.month} className="group flex flex-1 flex-col items-center gap-1">
                <div
                  className="flex w-full items-end justify-center gap-1"
                  style={{ height: '220px' }}
                >
                  {showComparison && (
                    <div
                      className="w-1/3 rounded-t bg-gray-300 opacity-50 transition-all group-hover:opacity-70"
                      style={{ height: `${(prevValue / maxValue) * 100}%` }}
                      title={`Last Year: $${prevValue.toLocaleString()}`}
                    />
                  )}
                  <div
                    className="w-1/2 rounded-t bg-blue-500 transition-all group-hover:bg-blue-600"
                    style={{ height: `${(currentValue / maxValue) * 100}%` }}
                    title={`${viewMode === 'gross' ? 'Gross' : 'Net'}: $${currentValue.toLocaleString()}`}
                  />
                </div>
                <span className="text-xs text-gray-500">{item.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source Breakdown Toggle */}
      <div className="border-t border-gray-100">
        <button
          className="flex w-full items-center justify-between p-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setShowSourceBreakdown(!showSourceBreakdown)}
        >
          <span>Revenue by Source</span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', showSourceBreakdown && 'rotate-180')}
          />
        </button>

        {showSourceBreakdown && (
          <div className="grid grid-cols-2 gap-4 px-4 pb-4 md:grid-cols-4">
            {sourceBreakdown.map((source) => {
              const percent = (source.amount / totalRevenue) * 100;
              return (
                <div key={source.source} className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-sm text-gray-600">{source.source}</span>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    ${source.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">{percent.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RevenueChart;
