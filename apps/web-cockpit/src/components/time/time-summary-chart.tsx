/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Time Summary Chart Component
 *
 * Reusable chart component for displaying time tracking data
 * with multiple visualization options.
 *
 * @module components/time/time-summary-chart
 */

import { useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  secondary?: number;
}

export interface TimeSummaryChartProps {
  data: ChartDataPoint[];
  type: 'bar' | 'pie' | 'line' | 'donut';
  title?: string;
  height?: number;
  showLegend?: boolean;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

// ============================================================================
// Default Formatters
// ============================================================================

const defaultFormatValue = (value: number): string => {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ============================================================================
// Color Palette
// ============================================================================

const DEFAULT_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
];

// ============================================================================
// Bar Chart
// ============================================================================

function BarChart({
  data,
  height = 200,
  showValues,
  formatValue = defaultFormatValue,
}: {
  data: ChartDataPoint[];
  height?: number;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((item, index) => {
        const heightPercent = (item.value / maxValue) * 100;
        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

        return (
          <div key={index} className="group relative flex flex-1 flex-col items-center">
            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white dark:bg-gray-700">
                {formatValue(item.value)}
              </div>
            </div>

            {/* Bar */}
            <div
              className="w-full rounded-t transition-all group-hover:opacity-80"
              style={{
                height: `${heightPercent}%`,
                backgroundColor: color,
                minHeight: item.value > 0 ? '4px' : '0',
              }}
            />

            {/* Label */}
            <span className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.label}</span>

            {/* Value */}
            {showValues && (
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {formatValue(item.value)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Horizontal Bar Chart
// ============================================================================

function HorizontalBarChart({
  data,
  showValues,
  formatValue = defaultFormatValue,
}: {
  data: ChartDataPoint[];
  showValues?: boolean;
  formatValue?: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const widthPercent = (item.value / maxValue) * 100;
        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;

        return (
          <div key={index} className="group">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {showValues && (
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatValue(item.value)}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">({percentage}%)</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full rounded-full transition-all group-hover:opacity-80"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Pie/Donut Chart
// ============================================================================

function PieChart({
  data,
  type = 'pie',
  height = 200,
  showLegend,
  formatValue = defaultFormatValue,
}: {
  data: ChartDataPoint[];
  type: 'pie' | 'donut';
  height?: number;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Build conic gradient
  const gradientStops = useMemo(() => {
    let cumulativePercent = 0;
    return data
      .map((item, index) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0;
        const start = cumulativePercent;
        cumulativePercent += percent;
        const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
        return `${color} ${start}% ${cumulativePercent}%`;
      })
      .join(', ');
  }, [data, total]);

  const size = Math.min(height, 200);

  return (
    <div className="flex items-center gap-6">
      {/* Chart */}
      <div
        className="relative flex-shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: total > 0 ? `conic-gradient(${gradientStops})` : '#e5e7eb',
        }}
      >
        {type === 'donut' && (
          <div
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white dark:bg-gray-800"
            style={{ width: size * 0.6, height: size * 0.6 }}
          >
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatValue(total)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex-1 space-y-2">
          {data.map((item, index) => {
            const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;

            return (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatValue(item.value)}
                </span>
                <span className="w-10 text-right text-xs text-gray-500 dark:text-gray-400">
                  {percentage}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Line Chart (Simplified)
// ============================================================================

function LineChart({
  data,
  height = 200,
  showValues,
  formatValue = defaultFormatValue,
}: {
  data: ChartDataPoint[];
  height?: number;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;

  // Calculate points for the line
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((item.value - minValue) / range) * 100;
    return { x, y, item };
  });

  // Generate SVG path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area path (fill under line)
  const areaD = `${pathD} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

  return (
    <div className="relative" style={{ height }}>
      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {/* Area fill */}
        <path d={areaD} fill="url(#lineGradient)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Data points */}
      <div className="absolute inset-0">
        {points.map((p, index) => (
          <div
            key={index}
            className="group absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="h-3 w-3 rounded-full border-2 border-blue-500 bg-white dark:bg-gray-800" />

            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white dark:bg-gray-700">
                {p.item.label}: {formatValue(p.item.value)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* X-axis labels */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between">
        {data.map((item, index) => (
          <span
            key={index}
            className="text-xs text-gray-500 dark:text-gray-400"
            style={{
              position: 'absolute',
              left: `${(index / (data.length - 1)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TimeSummaryChart({
  data,
  type,
  title,
  height = 200,
  showLegend = true,
  showValues = true,
  formatValue = defaultFormatValue,
}: TimeSummaryChartProps) {
  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} formatValue={formatValue} height={height} showValues={showValues} />
        );
      case 'pie':
        return (
          <PieChart
            data={data}
            formatValue={formatValue}
            height={height}
            showLegend={showLegend}
            type="pie"
          />
        );
      case 'donut':
        return (
          <PieChart
            data={data}
            formatValue={formatValue}
            height={height}
            showLegend={showLegend}
            type="donut"
          />
        );
      case 'line':
        return (
          <LineChart
            data={data}
            formatValue={formatValue}
            height={height}
            showValues={showValues}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {title && <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">{title}</h3>}
      {renderChart()}
    </div>
  );
}

// ============================================================================
// Additional Exports
// ============================================================================

export { BarChart, HorizontalBarChart, PieChart, LineChart };
