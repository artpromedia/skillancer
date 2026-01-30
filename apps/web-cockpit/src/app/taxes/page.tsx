'use client';

import { cn } from '@skillancer/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  FileText,
  Download,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Receipt,
  Car,
  Building2,
  ExternalLink,
  HelpCircle,
  ChevronDown,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback } from 'react';

import { taxesApi, type QuarterlyPayment, type TaxCategory } from '../../lib/api/taxes';

// =============================================================================
// TYPES
// =============================================================================

type TaxStatus = 'pending' | 'paid' | 'overdue' | 'partial' | 'due' | 'upcoming';

const statusConfig: Record<
  TaxStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: 'Due Soon', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  partial: { label: 'Partial', color: 'bg-orange-100 text-orange-700', icon: Clock },
  due: { label: 'Due', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  upcoming: { label: 'Upcoming', color: 'bg-gray-100 text-gray-700', icon: Clock },
};

// Map API status to display status
const mapQuarterlyStatus = (status: QuarterlyPayment['status']): TaxStatus => {
  const statusMap: Record<QuarterlyPayment['status'], TaxStatus> = {
    paid: 'paid',
    partial: 'partial',
    due: 'pending',
    overdue: 'overdue',
    upcoming: 'upcoming',
  };
  return statusMap[status] || 'pending';
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatCurrency = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// =============================================================================
// LOADING SKELETONS
// =============================================================================

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gray-200" />
        <div className="h-4 w-24 rounded bg-gray-200" />
      </div>
      <div className="h-8 w-32 rounded bg-gray-200" />
    </div>
  );
}

function QuarterCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="h-5 w-8 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="mb-1 h-7 w-20 rounded bg-gray-200" />
      <div className="h-4 w-24 rounded bg-gray-200" />
    </div>
  );
}

function DeductionRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center justify-between py-2">
      <div className="h-4 w-32 rounded bg-gray-200" />
      <div className="h-4 w-16 rounded bg-gray-200" />
    </div>
  );
}

// =============================================================================
// ERROR DISPLAY
// =============================================================================

interface ErrorDisplayProps {
  error: Error;
  onRetry: () => void;
}

function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8">
      <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
      <h3 className="mb-2 text-lg font-medium text-red-900">Failed to load tax data</h3>
      <p className="mb-4 text-center text-sm text-red-600">{error.message}</p>
      <button
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

function EmptyTaxState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <Calculator className="mx-auto h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">No tax data available</h3>
      <p className="mt-1 text-gray-500">
        Start tracking your income and expenses to see tax estimates
      </p>
      <Link
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        href="/expenses"
      >
        <Receipt className="h-4 w-4" />
        Track Expenses
      </Link>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TaxesPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedSection, setExpandedSection] = useState<string | null>('deductions');
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch tax summary for selected year
  const {
    data: taxSummary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['taxSummary', selectedYear],
    queryFn: () => taxesApi.getTaxSummary(selectedYear),
  });

  // Mark quarterly payment as paid
  const markPaidMutation = useMutation({
    mutationFn: ({ quarter, amount }: { quarter: number; amount: number }) =>
      taxesApi.markQuarterlyPaid(selectedYear, quarter, amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taxSummary', selectedYear] });
    },
  });

  // Handle export
  const handleExportReport = useCallback(async () => {
    if (isExporting) return;

    const confirmExport = window.confirm(
      `Export tax report for ${selectedYear}? This will download a PDF summary of your tax data.`
    );
    if (!confirmExport) return;

    setIsExporting(true);
    try {
      const blob = await taxesApi.exportTaxReport(selectedYear);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tax-report-${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export tax report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [selectedYear, isExporting]);

  // Handle mark as paid
  const handleMarkPaid = useCallback(
    (quarter: number, amount: number) => {
      const confirmPay = window.confirm(
        `Mark Q${quarter} payment of ${formatCurrency(amount)} as paid? This action will be recorded.`
      );
      if (confirmPay) {
        markPaidMutation.mutate({ quarter, amount });
      }
    },
    [markPaidMutation]
  );

  // Calculate derived values from API data
  const totalIncome = taxSummary?.grossIncome ?? 0;
  const totalDeductions = taxSummary?.totalDeductions ?? 0;
  const taxableIncome = taxSummary?.taxableIncome ?? 0;
  const totalEstimatedTax = taxSummary?.totalEstimatedTax ?? 0;
  const paidSoFar = taxSummary?.paidSoFar ?? 0;
  const remainingBalance = taxSummary?.remainingBalance ?? totalEstimatedTax - paidSoFar;
  const selfEmploymentTax = taxSummary?.selfEmploymentTax ?? 0;
  const federalTax = taxSummary?.federalTax ?? 0;

  // Get next unpaid quarter for alert banner
  const nextUnpaidQuarter = taxSummary?.quarterlyEstimates?.find(
    (q) => q.status === 'due' || q.status === 'partial' || q.status === 'overdue'
  );

  // Years for dropdown (current year and previous 2 years)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Preparation</h1>
              <p className="text-sm text-gray-500">Track deductions and estimated taxes</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    Tax Year {year}
                  </option>
                ))}
              </select>
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                disabled={isExporting || isLoading}
                onClick={() => void handleExportReport()}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Tax Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Error State */}
        {error ? (
          <ErrorDisplay error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <>
            {/* Loading Skeleton */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <StatCardSkeleton key={`stat-skeleton-${i}`} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200" />
                  <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <QuarterCardSkeleton key={`quarter-skeleton-${i}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-4 h-6 w-32 animate-pulse rounded bg-gray-200" />
                {Array.from({ length: 5 }, (_, i) => (
                  <DeductionRowSkeleton key={`deduction-skeleton-${i}`} />
                ))}
              </div>
            </div>
          </>
        ) : !taxSummary || taxSummary.grossIncome === 0 ? (
          <EmptyTaxState />
        ) : (
          <>
            {/* Alert Banner for upcoming payment */}
            {nextUnpaidQuarter && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">
                    Q{nextUnpaidQuarter.quarter} Estimated Payment{' '}
                    {nextUnpaidQuarter.status === 'overdue' ? 'Overdue' : 'Due'}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Your Q{nextUnpaidQuarter.quarter} estimated tax payment of{' '}
                    {formatCurrency(nextUnpaidQuarter.estimatedAmount)} is due by{' '}
                    {formatDate(nextUnpaidQuarter.dueDate)}.
                  </p>
                </div>
                <button
                  className="ml-auto rounded-lg bg-yellow-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-yellow-700"
                  onClick={() =>
                    handleMarkPaid(nextUnpaidQuarter.quarter, nextUnpaidQuarter.estimatedAmount)
                  }
                >
                  Mark as Paid
                </button>
              </div>
            )}

            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-500">Gross Income (YTD)</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-100 p-2">
                    <Receipt className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className="text-sm text-gray-500">Total Deductions</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(totalDeductions)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-2">
                    <Calculator className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-500">Est. Tax Liability</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalEstimatedTax)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="rounded-lg bg-yellow-100 p-2">
                    <DollarSign className="h-5 w-5 text-yellow-600" />
                  </div>
                  <span className="text-sm text-gray-500">Remaining Balance</span>
                </div>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    remainingBalance > 0 ? 'text-yellow-600' : 'text-green-600'
                  )}
                >
                  {formatCurrency(remainingBalance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Quarterly Payments */}
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 p-4">
                    <h2 className="font-semibold text-gray-900">Quarterly Estimated Taxes</h2>
                    <p className="text-sm text-gray-500">Track your estimated tax payments</p>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-4">
                      {taxSummary.quarterlyEstimates?.map((quarter) => {
                        const displayStatus = mapQuarterlyStatus(quarter.status);
                        const StatusIcon = statusConfig[displayStatus].icon;
                        const isPaid = quarter.status === 'paid';
                        return (
                          <div
                            key={quarter.quarter}
                            className={cn(
                              'rounded-xl border p-4',
                              quarter.status === 'overdue' && 'border-red-200 bg-red-50',
                              (quarter.status === 'due' || quarter.status === 'partial') &&
                                'border-yellow-200 bg-yellow-50',
                              quarter.status === 'paid' && 'border-gray-200',
                              quarter.status === 'upcoming' && 'border-gray-200 bg-gray-50'
                            )}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-semibold text-gray-900">
                                Q{quarter.quarter}
                              </span>
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                  statusConfig[displayStatus].color
                                )}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig[displayStatus].label}
                              </span>
                            </div>
                            <p className="mb-1 text-lg font-bold text-gray-900">
                              {formatCurrency(quarter.estimatedAmount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Due: {formatDate(quarter.dueDate)}
                            </p>
                            {!isPaid && quarter.status !== 'upcoming' && (
                              <button
                                className="mt-3 w-full rounded-lg bg-indigo-600 py-1.5 text-sm text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                disabled={markPaidMutation.isPending}
                                onClick={() =>
                                  handleMarkPaid(quarter.quarter, quarter.estimatedAmount)
                                }
                              >
                                {markPaidMutation.isPending ? 'Processing...' : 'Mark as Paid'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Tax Breakdown */}
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 p-4">
                    <h2 className="font-semibold text-gray-900">Tax Breakdown</h2>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">Gross Income</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(totalIncome)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600">Total Deductions</span>
                      <span className="font-semibold text-indigo-600">
                        - {formatCurrency(totalDeductions)}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between py-2">
                        <span className="font-medium text-gray-900">Taxable Income</span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(taxableIncome)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Self-Employment Tax</span>
                          <span className="text-xs text-gray-400">(15.3%)</span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(selfEmploymentTax)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Federal Income Tax</span>
                          <span className="text-xs text-gray-400">
                            ({taxSummary?.effectiveRate?.toFixed(1) ?? '22'}%)
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(federalTax)}
                        </span>
                      </div>
                      {taxSummary?.stateTax !== undefined && taxSummary.stateTax > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">State Tax</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(taxSummary.stateTax)}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900">Total Estimated Tax</span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(totalEstimatedTax)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-xs text-gray-400">
                      * This is an estimate. Consult a tax professional for accurate calculations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Deductions Summary */}
                <div className="rounded-xl border border-gray-200 bg-white">
                  <button
                    className="flex w-full items-center justify-between border-b border-gray-100 p-4"
                    onClick={() =>
                      setExpandedSection(expandedSection === 'deductions' ? null : 'deductions')
                    }
                  >
                    <h2 className="font-semibold text-gray-900">Deductions</h2>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-gray-400 transition-transform',
                        expandedSection === 'deductions' && 'rotate-180'
                      )}
                    />
                  </button>
                  {expandedSection === 'deductions' && (
                    <div className="space-y-3 p-4">
                      {taxSummary?.deductionCategories?.length > 0 ? (
                        taxSummary.deductionCategories.map((category: TaxCategory) => (
                          <div key={category.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">{category.name}</span>
                              {category.percentage !== undefined && category.percentage < 100 && (
                                <span className="text-xs text-gray-400">
                                  ({category.percentage}%)
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(category.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-sm text-gray-500">
                          No deductions tracked yet
                        </p>
                      )}
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Total</span>
                          <span className="font-bold text-indigo-600">
                            {formatCurrency(totalDeductions)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Links */}
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 p-4">
                    <h2 className="font-semibold text-gray-900">Quick Links</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    <Link
                      className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                      href="/expenses"
                    >
                      <div className="flex items-center gap-3">
                        <Receipt className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Expense Tracker</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </Link>
                    <Link
                      className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                      href="/expenses/mileage"
                    >
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Mileage Log</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </Link>
                    <Link
                      className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                      href="/expenses/receipts"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-700">Receipt Scanner</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </Link>
                    <a
                      className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                      href="https://www.irs.gov/payments"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-700">IRS Direct Pay</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>
                  </div>
                </div>

                {/* Tax Tips */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
                    <div>
                      <h3 className="mb-1 font-medium text-blue-900">Tax Tip</h3>
                      <p className="text-sm text-blue-700">
                        Don&apos;t forget to deduct half of your self-employment tax when
                        calculating your adjusted gross income. This can save you hundreds of
                        dollars!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
