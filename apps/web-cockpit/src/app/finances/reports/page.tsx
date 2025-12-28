'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  FileText,
  PieChart,
  BarChart3,
  LineChart,
  Printer,
  Mail,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type ReportType =
  | 'profit-loss'
  | 'expense-summary'
  | 'income-summary'
  | 'tax-summary'
  | 'invoice-aging'
  | 'client-revenue';
type DateRange =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'this-year'
  | 'last-year'
  | 'custom';

interface Report {
  id: ReportType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const reports: Report[] = [
  {
    id: 'profit-loss',
    name: 'Profit & Loss',
    description: 'Income, expenses, and net profit over time',
    icon: TrendingUp,
  },
  {
    id: 'expense-summary',
    name: 'Expense Summary',
    description: 'Breakdown of expenses by category',
    icon: Receipt,
  },
  {
    id: 'income-summary',
    name: 'Income Summary',
    description: 'Revenue by client and income type',
    icon: DollarSign,
  },
  {
    id: 'tax-summary',
    name: 'Tax Summary',
    description: 'Deductions and estimated tax liability',
    icon: FileText,
  },
  {
    id: 'invoice-aging',
    name: 'Invoice Aging',
    description: 'Outstanding invoices by age',
    icon: Clock,
  },
  {
    id: 'client-revenue',
    name: 'Client Revenue',
    description: 'Revenue breakdown by client',
    icon: PieChart,
  },
];

// Mock data for P&L report
const plData = {
  income: {
    total: 125000,
    categories: [
      { name: 'Client Payments', amount: 98500 },
      { name: 'Platform Income', amount: 18500 },
      { name: 'Product Sales', amount: 5200 },
      { name: 'Other', amount: 2800 },
    ],
  },
  expenses: {
    total: 20450,
    categories: [
      { name: 'Software & Tools', amount: 2400, percentage: 11.7 },
      { name: 'Cloud & Hosting', amount: 1800, percentage: 8.8 },
      { name: 'Hardware', amount: 3200, percentage: 15.6 },
      { name: 'Home Office', amount: 4800, percentage: 23.5 },
      { name: 'Professional Services', amount: 2500, percentage: 12.2 },
      { name: 'Travel', amount: 1200, percentage: 5.9 },
      { name: 'Meals & Entertainment', amount: 800, percentage: 3.9 },
      { name: 'Mileage', amount: 1650, percentage: 8.1 },
      { name: 'Education', amount: 1500, percentage: 7.3 },
      { name: 'Marketing', amount: 600, percentage: 2.9 },
    ],
  },
  netProfit: 104550,
  profitMargin: 83.6,
};

// Mock data for invoice aging
const agingData = [
  { range: 'Current', amount: 8500, count: 3 },
  { range: '1-30 days', amount: 4200, count: 2 },
  { range: '31-60 days', amount: 1800, count: 1 },
  { range: '61-90 days', amount: 0, count: 0 },
  { range: '90+ days', amount: 2500, count: 1 },
];

// Mock data for client revenue
const clientRevenueData = [
  { name: 'Acme Corp', amount: 45000, percentage: 36 },
  { name: 'TechStart Inc', amount: 32000, percentage: 25.6 },
  { name: 'Design Studio', amount: 18500, percentage: 14.8 },
  { name: 'GlobalTech', amount: 15000, percentage: 12 },
  { name: 'StartupXYZ', amount: 8500, percentage: 6.8 },
  { name: 'Other Clients', amount: 6000, percentage: 4.8 },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('profit-loss');
  const [dateRange, setDateRange] = useState<DateRange>('this-year');
  const [isGenerating, setIsGenerating] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleExport = async (_format: 'pdf' | 'csv') => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsGenerating(false);
  };

  const currentReport = reports.find((r) => r.id === selectedReport);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link className="rounded-lg p-2 transition-colors hover:bg-gray-100" href="/finances">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
                <p className="text-sm text-gray-500">Generate and export financial reports</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
              >
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="this-quarter">This Quarter</option>
                <option value="last-quarter">Last Quarter</option>
                <option value="this-year">This Year</option>
                <option value="last-year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
              <button
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-50"
                disabled={isGenerating}
                onClick={() => void handleExport('csv')}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                disabled={isGenerating}
                onClick={() => void handleExport('pdf')}
              >
                {isGenerating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Report Selector */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-4 font-semibold text-gray-900">Report Type</h2>
              <div className="space-y-2">
                {reports.map((report) => {
                  const ReportIcon = report.icon;
                  return (
                    <button
                      key={report.id}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors',
                        selectedReport === report.id
                          ? 'border border-indigo-200 bg-indigo-50'
                          : 'border border-transparent hover:bg-gray-50'
                      )}
                      onClick={() => setSelectedReport(report.id)}
                    >
                      <ReportIcon
                        className={cn(
                          'mt-0.5 h-5 w-5',
                          selectedReport === report.id ? 'text-indigo-600' : 'text-gray-400'
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            'font-medium',
                            selectedReport === report.id ? 'text-indigo-600' : 'text-gray-900'
                          )}
                        >
                          {report.name}
                        </p>
                        <p className="text-xs text-gray-500">{report.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white">
              {/* Report Header */}
              <div className="border-b border-gray-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{currentReport?.name}</h2>
                    <p className="text-sm text-gray-500">
                      {dateRange === 'this-year'
                        ? 'January 1 - December 31, 2024'
                        : 'Custom date range'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg p-2 transition-colors hover:bg-gray-100">
                      <Printer className="h-5 w-5 text-gray-500" />
                    </button>
                    <button className="rounded-lg p-2 transition-colors hover:bg-gray-100">
                      <Mail className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Profit & Loss Report */}
              {selectedReport === 'profit-loss' && (
                <div className="p-6">
                  {/* Summary Cards */}
                  <div className="mb-8 grid grid-cols-3 gap-4">
                    <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                      <p className="text-sm text-green-700">Total Income</p>
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(plData.income.total)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                      <p className="text-sm text-red-700">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-900">
                        {formatCurrency(plData.expenses.total)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                      <p className="text-sm text-indigo-700">Net Profit</p>
                      <p className="text-2xl font-bold text-indigo-900">
                        {formatCurrency(plData.netProfit)}
                      </p>
                      <p className="text-xs text-indigo-600">{plData.profitMargin}% margin</p>
                    </div>
                  </div>

                  {/* Income Section */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Income
                    </h3>
                    <div className="overflow-hidden rounded-lg bg-gray-50">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          {plData.income.categories.map((category) => (
                            <tr key={category.name}>
                              <td className="px-4 py-3 text-gray-700">{category.name}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">
                                {formatCurrency(category.amount)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-green-50">
                            <td className="px-4 py-3 font-semibold text-green-900">Total Income</td>
                            <td className="px-4 py-3 text-right font-bold text-green-900">
                              {formatCurrency(plData.income.total)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  <div className="mb-8">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Expenses
                    </h3>
                    <div className="overflow-hidden rounded-lg bg-gray-50">
                      <table className="w-full">
                        <tbody className="divide-y divide-gray-200">
                          {plData.expenses.categories.map((category) => (
                            <tr key={category.name}>
                              <td className="px-4 py-3 text-gray-700">{category.name}</td>
                              <td className="px-4 py-3 text-right text-gray-500">
                                {category.percentage}%
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">
                                {formatCurrency(category.amount)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-red-50">
                            <td className="px-4 py-3 font-semibold text-red-900">Total Expenses</td>
                            <td className="px-4 py-3" />
                            <td className="px-4 py-3 text-right font-bold text-red-900">
                              {formatCurrency(plData.expenses.total)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Net Profit */}
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-900">Net Profit</span>
                      <span className="text-xl font-bold text-indigo-900">
                        {formatCurrency(plData.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Aging Report */}
              {selectedReport === 'invoice-aging' && (
                <div className="p-6">
                  <div className="mb-6">
                    <p className="text-sm text-gray-500">
                      Total Outstanding:{' '}
                      <span className="font-semibold text-gray-900">{formatCurrency(17000)}</span>
                    </p>
                  </div>
                  <div className="space-y-4">
                    {agingData.map((range) => (
                      <div key={range.range} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-gray-600">{range.range}</div>
                        <div className="flex-1">
                          <div className="h-8 overflow-hidden rounded-lg bg-gray-100">
                            <div
                              className={cn(
                                'h-full rounded-lg',
                                range.range === 'Current' && 'bg-green-500',
                                range.range === '1-30 days' && 'bg-yellow-500',
                                range.range === '31-60 days' && 'bg-orange-500',
                                range.range === '61-90 days' && 'bg-red-400',
                                range.range === '90+ days' && 'bg-red-600'
                              )}
                              style={{ width: `${(range.amount / 17000) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(range.amount)}
                          </p>
                          <p className="text-xs text-gray-500">{range.count} invoices</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Client Revenue Report */}
              {selectedReport === 'client-revenue' && (
                <div className="p-6">
                  <div className="space-y-4">
                    {clientRevenueData.map((client, index) => (
                      <div key={client.name} className="flex items-center gap-4">
                        <div className="w-4 text-sm text-gray-400">{index + 1}</div>
                        <div className="w-32 truncate text-sm font-medium text-gray-900">
                          {client.name}
                        </div>
                        <div className="flex-1">
                          <div className="h-6 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${client.percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(client.amount)}
                          </p>
                          <p className="text-xs text-gray-500">{client.percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense Summary Report */}
              {selectedReport === 'expense-summary' && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="mb-4 font-semibold text-gray-900">By Category</h3>
                      <div className="space-y-3">
                        {plData.expenses.categories.map((category) => (
                          <div key={category.name} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{category.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{category.percentage}%</span>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(category.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-4 font-semibold text-gray-900">Monthly Trend</h3>
                      <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50">
                        <BarChart3 className="h-12 w-12 text-gray-300" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Income Summary Report */}
              {selectedReport === 'income-summary' && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="mb-4 font-semibold text-gray-900">By Source</h3>
                      <div className="space-y-3">
                        {plData.income.categories.map((category) => (
                          <div key={category.name} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{category.name}</span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(category.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-4 font-semibold text-gray-900">Monthly Trend</h3>
                      <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50">
                        <LineChart className="h-12 w-12 text-gray-300" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tax Summary Report */}
              {selectedReport === 'tax-summary' && (
                <div className="p-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg bg-gray-50 p-4">
                        <p className="text-sm text-gray-600">Gross Income</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(125000)}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50 p-4">
                        <p className="text-sm text-indigo-600">Total Deductions</p>
                        <p className="text-xl font-bold text-indigo-900">{formatCurrency(20450)}</p>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-4">
                        <p className="text-sm text-purple-600">Est. Tax Liability</p>
                        <p className="text-xl font-bold text-purple-900">{formatCurrency(35000)}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-4 font-semibold text-gray-900">Deductions by Category</h3>
                      <div className="overflow-hidden rounded-lg bg-gray-50">
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-200">
                            {plData.expenses.categories.map((category) => (
                              <tr key={category.name}>
                                <td className="px-4 py-3 text-gray-700">{category.name}</td>
                                <td className="px-4 py-3 text-right text-green-600">100%</td>
                                <td className="px-4 py-3 text-right font-medium text-gray-900">
                                  {formatCurrency(category.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
