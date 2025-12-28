/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Time Reports Page
 *
 * Comprehensive time tracking reports with visualizations,
 * filters, and export capabilities.
 *
 * @module app/time/reports/page
 */

import {
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Users,
  Briefcase,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

type DateRange = 'week' | 'month' | 'quarter' | 'year' | 'custom';
type ReportView = 'summary' | 'detailed' | 'comparison';

interface TimeReport {
  period: string;
  totalHours: number;
  billableHours: number;
  earnings: number;
  entries: number;
  byProject: { name: string; hours: number; color: string }[];
  byCategory: { name: string; hours: number; color: string }[];
  dailyBreakdown: { date: string; hours: number; billable: number }[];
}

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_REPORT: TimeReport = {
  period: 'January 2025',
  totalHours: 156.5,
  billableHours: 134.25,
  earnings: 18742.5,
  entries: 89,
  byProject: [
    { name: 'Skillancer Platform', hours: 68.5, color: '#3B82F6' },
    { name: 'Mobile App', hours: 45.25, color: '#8B5CF6' },
    { name: 'Client Website', hours: 28.5, color: '#10B981' },
    { name: 'Internal Tools', hours: 14.25, color: '#F59E0B' },
  ],
  byCategory: [
    { name: 'Development', hours: 85.5, color: '#3B82F6' },
    { name: 'Design', hours: 32.25, color: '#8B5CF6' },
    { name: 'Meetings', hours: 18.5, color: '#F59E0B' },
    { name: 'Research', hours: 12.25, color: '#10B981' },
    { name: 'Admin', hours: 8, color: '#6B7280' },
  ],
  dailyBreakdown: Array.from({ length: 31 }, (_, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    hours: Math.random() * 8 + 2,
    billable: Math.random() * 6 + 2,
  })),
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDecimal(hours: number): string {
  return hours.toFixed(1) + 'h';
}

// ============================================================================
// Summary Card Component
// ============================================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  subValue?: string;
  trend?: { value: number; label: string };
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subValue && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subValue}</p>
          )}
        </div>
        <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          {trend.value >= 0 ? (
            <ArrowUp className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-sm font-medium ${
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {Math.abs(trend.value)}%
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bar Chart Component
// ============================================================================

function SimpleBarChart({
  data,
  maxValue,
}: {
  data: { label: string; value: number; secondary?: number }[];
  maxValue: number;
}) {
  return (
    <div className="space-y-1">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-8 text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
          <div className="relative h-6 flex-1 rounded bg-gray-100 dark:bg-gray-700">
            {item.secondary !== undefined && (
              <div
                className="absolute left-0 top-0 h-full rounded bg-blue-200 dark:bg-blue-900/50"
                style={{ width: `${(item.secondary / maxValue) * 100}%` }}
              />
            )}
            <div
              className="absolute left-0 top-0 h-full rounded bg-blue-500"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="w-12 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
            {formatDecimal(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Pie Chart Component (CSS-based)
// ============================================================================

function SimplePieChart({ data }: { data: { name: string; hours: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.hours, 0);
  let cumulativePercent = 0;

  // Build conic gradient
  const gradientStops = data
    .map((item) => {
      const percent = (item.hours / total) * 100;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return `${item.color} ${start}% ${cumulativePercent}%`;
    })
    .join(', ');

  return (
    <div className="flex items-center gap-6">
      <div
        className="h-32 w-32 flex-shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${gradientStops})`,
        }}
      />
      <div className="flex-1 space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDecimal(item.hours)}
            </span>
            <span className="w-12 text-right text-xs text-gray-500">
              {((item.hours / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Weekly Bar Chart
// ============================================================================

function WeeklyBarChart({ data }: { data: { date: string; hours: number; billable: number }[] }) {
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxHours = Math.max(...data.map((d) => d.hours), 8);

  // Group by day of week (simplified - just use last 7 days)
  const last7Days = data.slice(-7);

  return (
    <div className="flex h-48 items-end justify-between gap-2">
      {last7Days.map((day, index) => {
        const heightPercent = (day.hours / maxHours) * 100;
        const billablePercent = (day.billable / day.hours) * 100 || 0;

        return (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative w-full" style={{ height: '160px' }}>
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-md bg-blue-500"
                style={{ height: `${heightPercent}%` }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md bg-blue-300 dark:bg-blue-700"
                  style={{ height: `${100 - billablePercent}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{weekDays[index]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Detailed Table Component
// ============================================================================

function DetailedTable({ data }: { data: { name: string; hours: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.hours, 0);

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700">
          <th className="py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
            Name
          </th>
          <th className="py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
            Hours
          </th>
          <th className="py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.name} className="border-b border-gray-100 dark:border-gray-700/50">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-gray-900 dark:text-white">{item.name}</span>
              </div>
            </td>
            <td className="py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
              {formatHours(item.hours)}
            </td>
            <td className="py-3 text-right text-sm text-gray-500 dark:text-gray-400">
              {((item.hours / total) * 100).toFixed(1)}%
            </td>
          </tr>
        ))}
        <tr className="font-medium">
          <td className="py-3 text-sm text-gray-900 dark:text-white">Total</td>
          <td className="py-3 text-right text-sm text-gray-900 dark:text-white">
            {formatHours(total)}
          </td>
          <td className="py-3 text-right text-sm text-gray-500 dark:text-gray-400">100%</td>
        </tr>
      </tbody>
    </table>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TimeReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [reportView, setReportView] = useState<ReportView>('summary');
  const report = SAMPLE_REPORT;

  const billableRate = (report.billableHours / report.totalHours) * 100;
  const avgHoursPerDay = report.totalHours / 22; // Assuming 22 work days

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Analyze your time tracking data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Date Range & View Toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            {(['week', 'month', 'quarter', 'year'] as DateRange[]).map((range) => (
              <button
                key={range}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-white text-gray-900 shadow dark:bg-gray-600 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                onClick={() => setDateRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
            {report.period}
          </span>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
          {(['summary', 'detailed', 'comparison'] as ReportView[]).map((view) => (
            <button
              key={view}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                reportView === view
                  ? 'bg-white text-gray-900 shadow dark:bg-gray-600 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              onClick={() => setReportView(view)}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          color="#3B82F6"
          icon={Clock}
          label="Total Hours"
          subValue={`${report.entries} entries`}
          trend={{ value: 12, label: 'vs last period' }}
          value={formatHours(report.totalHours)}
        />
        <SummaryCard
          color="#10B981"
          icon={DollarSign}
          label="Billable Hours"
          subValue={`${billableRate.toFixed(0)}% billable`}
          trend={{ value: 8, label: 'vs last period' }}
          value={formatHours(report.billableHours)}
        />
        <SummaryCard
          color="#8B5CF6"
          icon={TrendingUp}
          label="Earnings"
          subValue={`${formatCurrency(report.earnings / report.billableHours)}/hr avg`}
          trend={{ value: 15, label: 'vs last period' }}
          value={formatCurrency(report.earnings)}
        />
        <SummaryCard
          color="#F59E0B"
          icon={BarChart3}
          label="Daily Average"
          subValue="per work day"
          trend={{ value: -3, label: 'vs last period' }}
          value={formatHours(avgHoursPerDay)}
        />
      </div>

      {/* Charts Grid */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Overview */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Weekly Overview</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded bg-blue-500" />
                <span className="text-gray-500 dark:text-gray-400">Billable</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded bg-blue-300 dark:bg-blue-700" />
                <span className="text-gray-500 dark:text-gray-400">Non-billable</span>
              </div>
            </div>
          </div>
          <WeeklyBarChart data={report.dailyBreakdown} />
        </div>

        {/* Time by Project */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Time by Project</h3>
          <SimplePieChart data={report.byProject} />
        </div>

        {/* Time by Category */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Time by Category</h3>
          <SimplePieChart data={report.byCategory} />
        </div>

        {/* Daily Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Daily Distribution</h3>
          <SimpleBarChart
            data={report.dailyBreakdown.slice(0, 7).map((d, i) => ({
              label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
              value: d.hours,
              secondary: d.billable,
            }))}
            maxValue={10}
          />
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Projects Table */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Projects Breakdown</h3>
            <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              View all
            </button>
          </div>
          <DetailedTable data={report.byProject} />
        </div>

        {/* Categories Table */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Categories Breakdown</h3>
            <button className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              View all
            </button>
          </div>
          <DetailedTable data={report.byCategory} />
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 font-semibold text-gray-900 dark:text-white">Export Report</h3>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
            Export as PDF
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
            Export as CSV
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            <Download className="h-4 w-4" />
            Export as Excel
          </button>
        </div>
      </div>
    </div>
  );
}
