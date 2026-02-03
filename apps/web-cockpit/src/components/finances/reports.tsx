'use client';

/**
 * Financial Reports Components
 *
 * Comprehensive reporting for earnings, taxes, and financial analysis.
 */

import { cn } from '@skillancer/ui';
import {
  Download,
  DollarSign,
  FileText,
  Loader2,
  AlertCircle,
  Users,
  Briefcase,
  Receipt,
  Building2,
} from 'lucide-react';
import { useState } from 'react';

import type { RevenueReport, TaxReport } from '@/lib/api/services/finances';

import { financesService } from '@/lib/api/services/finances';

// =============================================================================
// Types
// =============================================================================

type DateRange =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'this-year'
  | 'last-year'
  | 'custom';

interface EarningsReportProps {
  startDate: string;
  endDate: string;
  currency?: string;
}

interface TaxReportProps {
  year: number;
  quarter?: 1 | 2 | 3 | 4;
}

// =============================================================================
// Earnings by Client Report
// =============================================================================

export function EarningsByClientReport({
  startDate,
  endDate,
  currency = 'USD',
}: EarningsReportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RevenueReport | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await financesService.getRevenueReport({ startDate, endDate, currency });
      if (response.data) {
        setReport(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Load report on mount
  useState(() => {
    void loadReport();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-red-700">{error}</p>
        <button
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          onClick={() => void loadReport()}
        >
          Retry
        </button>
      </div>
    );
  }

  const clientData = report?.byClient || [];
  const totalEarnings = report?.total || 0;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-100">Total Earnings by Client</p>
            <p className="mt-1 text-3xl font-bold">{formatCurrency(totalEarnings)}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <Users className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Client Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Earnings by Client</h3>

        {clientData.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No earnings data for this period</div>
        ) : (
          <div className="space-y-4">
            {clientData.map((client) => (
              <div key={client.clientId} className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{client.clientName}</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(client.amount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-indigo-600"
                        style={{ width: `${client.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">{client.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Earnings by Project Report
// =============================================================================

export function EarningsByProjectReport({
  startDate,
  endDate,
  currency = 'USD',
}: EarningsReportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RevenueReport | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await financesService.getRevenueReport({ startDate, endDate, currency });
      if (response.data) {
        setReport(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  useState(() => {
    void loadReport();
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const projectData = report?.byProject || [];
  const totalEarnings = report?.total || 0;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100">Total Earnings by Project</p>
            <p className="mt-1 text-3xl font-bold">{formatCurrency(totalEarnings)}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <Briefcase className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Project Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Earnings by Project</h3>

        {projectData.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No project earnings data for this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Project</th>
                  <th className="pb-3 text-left text-sm font-medium text-gray-500">Client</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projectData.map((project) => (
                  <tr key={project.projectId}>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{project.projectName}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600">{project.clientName}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(project.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Tax Report (1099 Data)
// =============================================================================

export function TaxSummaryReport({ year, quarter }: TaxReportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TaxReport | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await financesService.getTaxReport({ year, quarter });
      if (response.data) {
        setReport(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tax report');
    } finally {
      setIsLoading(false);
    }
  };

  useState(() => {
    void loadReport();
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Tax Summary {quarter ? `Q${quarter} ` : ''}
              {year}
            </h2>
            <p className="text-gray-500">1099-NEC / 1099-MISC Data for US Tax Filing</p>
          </div>
          <div className="rounded-full bg-amber-100 p-3">
            <Receipt className="h-8 w-8 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Income Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            Gross Income
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(report?.income.gross || 0)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <Receipt className="h-4 w-4" />
            Total Deductions
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(report?.income.deductions || 0)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <FileText className="h-4 w-4" />
            Taxable Income
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {formatCurrency(report?.income.taxable || 0)}
          </div>
        </div>
      </div>

      {/* Deductions Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Deductions by Category</h3>

        {!report?.deductionsByCategory?.length ? (
          <div className="py-8 text-center text-gray-500">
            No deductions recorded for this period
          </div>
        ) : (
          <div className="space-y-3">
            {report.deductionsByCategory.map((deduction, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
              >
                <span className="text-gray-700">{deduction.category}</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(deduction.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estimated Tax Liability */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Estimated Tax Liability</h3>
            <p className="text-sm text-amber-700">
              Based on self-employment tax rates. Consult a tax professional for accurate filing.
            </p>
          </div>
          <div className="text-3xl font-bold text-amber-900">
            {formatCurrency(report?.estimatedTaxLiability || 0)}
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-3 font-semibold text-gray-900">Important Notes for 1099 Filing</h3>
        <ul className="list-inside list-disc space-y-2 text-sm text-gray-600">
          <li>
            You should receive a 1099-NEC from each client who paid you $600 or more during the tax
            year.
          </li>
          <li>
            Even if you don&apos;t receive a 1099, you must report all income on your tax return.
          </li>
          <li>
            Self-employment tax (Social Security and Medicare) is 15.3% of net self-employment
            income.
          </li>
          <li>You may need to make quarterly estimated tax payments to avoid penalties.</li>
          <li>Keep records of all business expenses for at least 3 years after filing.</li>
        </ul>
      </div>
    </div>
  );
}

// =============================================================================
// Export Controls
// =============================================================================

interface ExportControlsProps {
  onExport: (format: 'csv' | 'pdf') => void;
  isExporting?: boolean;
}

export function ExportControls({ onExport, isExporting }: ExportControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        disabled={isExporting}
        onClick={() => onExport('csv')}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export CSV
      </button>
      <button
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        disabled={isExporting}
        onClick={() => onExport('pdf')}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Export PDF
      </button>
    </div>
  );
}

// =============================================================================
// Date Range Selector
// =============================================================================

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
}

export function DateRangeSelector({
  value,
  onChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
}: DateRangeSelectorProps) {
  const ranges: { id: DateRange; label: string }[] = [
    { id: 'this-month', label: 'This Month' },
    { id: 'last-month', label: 'Last Month' },
    { id: 'this-quarter', label: 'This Quarter' },
    { id: 'this-year', label: 'This Year' },
    { id: 'last-year', label: 'Last Year' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 p-1">
        {ranges.map((range) => (
          <button
            key={range.id}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              value === range.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
            onClick={() => onChange(range.id)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {value === 'custom' && onCustomDateChange && (
        <div className="flex items-center gap-2">
          <input
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
          />
          <span className="text-gray-500">to</span>
          <input
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

const reportsExports = {
  EarningsByClientReport,
  EarningsByProjectReport,
  TaxSummaryReport,
  ExportControls,
  DateRangeSelector,
};

export default reportsExports;
