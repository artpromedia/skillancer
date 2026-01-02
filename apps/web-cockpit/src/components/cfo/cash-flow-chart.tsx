'use client';

/**
 * Cash Flow Chart Widget for CFO Dashboard
 * Visualizes cash flow projections and actuals over time
 */

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/components/card';
import { cn } from '@skillancer/ui/lib/utils';

interface CashFlowDataPoint {
  period: string;
  inflows: number;
  outflows: number;
  net: number;
  balance: number;
}

interface CashFlowChartProps {
  data: CashFlowDataPoint[];
  title?: string;
  className?: string;
}

export function CashFlowChart({ data, title = 'Cash Flow', className }: CashFlowChartProps) {
  const maxValue = Math.max(...data.flatMap((d) => [d.inflows, d.outflows, Math.abs(d.balance)]));
  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const balanceRange = maxBalance - minBalance || 1;

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-green-500" />
              <span>Inflows</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-red-500" />
              <span>Outflows</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-blue-500" />
              <span>Balance</span>
            </div>
          </div>

          {/* Chart */}
          <div className="relative h-48">
            {/* Y-axis labels */}
            <div className="text-muted-foreground absolute bottom-6 left-0 top-0 flex w-12 flex-col justify-between text-xs">
              <span>{formatCurrency(maxValue)}</span>
              <span>{formatCurrency(maxValue / 2)}</span>
              <span>$0</span>
            </div>

            {/* Bars */}
            <div className="ml-14 flex h-full items-end gap-1 pb-6">
              {data.map((point, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1">
                  {/* Stacked bars */}
                  <div
                    className="flex w-full items-end gap-0.5"
                    style={{ height: 'calc(100% - 1.5rem)' }}
                  >
                    {/* Inflow bar */}
                    <div
                      className="flex-1 rounded-t bg-green-500 transition-all"
                      style={{ height: `${(point.inflows / maxValue) * 100}%` }}
                      title={`Inflows: ${formatCurrency(point.inflows)}`}
                    />
                    {/* Outflow bar */}
                    <div
                      className="flex-1 rounded-t bg-red-500 transition-all"
                      style={{ height: `${(point.outflows / maxValue) * 100}%` }}
                      title={`Outflows: ${formatCurrency(point.outflows)}`}
                    />
                  </div>
                  {/* X-axis label */}
                  <span className="text-muted-foreground w-full truncate text-center text-[10px]">
                    {point.period}
                  </span>
                </div>
              ))}
            </div>

            {/* Balance line overlay */}
            <svg
              className="pointer-events-none absolute left-14 right-0 top-0 h-[calc(100%-1.5rem)]"
              preserveAspectRatio="none"
            >
              <polyline
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="2"
                points={data
                  .map((point, index) => {
                    const x = ((index + 0.5) / data.length) * 100;
                    const y = 100 - ((point.balance - minBalance) / balanceRange) * 100;
                    return `${x}%,${y}%`;
                  })
                  .join(' ')}
              />
              {data.map((point, index) => {
                const x = ((index + 0.5) / data.length) * 100;
                const y = 100 - ((point.balance - minBalance) / balanceRange) * 100;
                return (
                  <circle
                    key={index}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="4"
                    fill="rgb(59, 130, 246)"
                    className="cursor-pointer"
                  >
                    <title>{`Balance: ${formatCurrency(point.balance)}`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2 border-t pt-2 text-xs">
            <div>
              <p className="text-muted-foreground">Total Inflows</p>
              <p className="font-medium text-green-600">
                {formatCurrency(data.reduce((sum, d) => sum + d.inflows, 0))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Outflows</p>
              <p className="font-medium text-red-600">
                {formatCurrency(data.reduce((sum, d) => sum + d.outflows, 0))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Net Cash Flow</p>
              <p
                className={cn(
                  'font-medium',
                  data.reduce((sum, d) => sum + d.net, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(data.reduce((sum, d) => sum + d.net, 0))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Ending Balance</p>
              <p className="font-medium">{formatCurrency(data[data.length - 1]?.balance || 0)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CashFlowChart;
