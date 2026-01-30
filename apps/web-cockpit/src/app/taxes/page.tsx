'use client';

import { cn } from '@skillancer/ui';
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
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type TaxStatus = 'pending' | 'paid' | 'overdue';

interface QuarterlyEstimate {
  quarter: Quarter;
  dueDate: string;
  estimatedTax: number;
  paidAmount: number;
  status: TaxStatus;
}

interface TaxCategory {
  name: string;
  amount: number;
  deductible: boolean;
  percentage?: number;
}

const statusConfig: Record<
  TaxStatus,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: 'Due Soon', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/taxes/:year
const taxYear = 2024;
const _estimatedAnnualIncome = 125000;
const selfEmploymentTaxRate = 0.153;
const federalTaxRate = 0.22;

const quarterlyEstimates: QuarterlyEstimate[] = [
  { quarter: 'Q1', dueDate: '2024-04-15', estimatedTax: 8750, paidAmount: 8750, status: 'paid' },
  { quarter: 'Q2', dueDate: '2024-06-17', estimatedTax: 8750, paidAmount: 8750, status: 'paid' },
  { quarter: 'Q3', dueDate: '2024-09-16', estimatedTax: 8750, paidAmount: 8750, status: 'paid' },
  { quarter: 'Q4', dueDate: '2025-01-15', estimatedTax: 8750, paidAmount: 0, status: 'pending' },
];

const incomeCategories: TaxCategory[] = [
  { name: 'Client Payments', amount: 98500, deductible: false },
  { name: 'Platform Income (Upwork, etc.)', amount: 18500, deductible: false },
  { name: 'Product Sales', amount: 5200, deductible: false },
  { name: 'Other Income', amount: 2800, deductible: false },
];

const deductionCategories: TaxCategory[] = [
  { name: 'Software & Subscriptions', amount: 2400, deductible: true, percentage: 100 },
  { name: 'Cloud & Hosting', amount: 1800, deductible: true, percentage: 100 },
  { name: 'Hardware & Equipment', amount: 3200, deductible: true, percentage: 100 },
  { name: 'Home Office', amount: 4800, deductible: true, percentage: 100 },
  { name: 'Professional Services', amount: 2500, deductible: true, percentage: 100 },
  { name: 'Travel', amount: 1200, deductible: true, percentage: 100 },
  { name: 'Meals & Entertainment', amount: 800, deductible: true, percentage: 50 },
  { name: 'Mileage', amount: 1650, deductible: true, percentage: 100 },
  { name: 'Education & Training', amount: 1500, deductible: true, percentage: 100 },
  { name: 'Marketing', amount: 600, deductible: true, percentage: 100 },
];

export default function TaxesPage() {
  const [selectedYear, setSelectedYear] = useState(taxYear);
  const [expandedSection, setExpandedSection] = useState<string | null>('deductions');

  const totalIncome = incomeCategories.reduce((sum, cat) => sum + cat.amount, 0);
  const totalDeductions = deductionCategories.reduce((sum, cat) => {
    const effectiveAmount = cat.percentage ? (cat.amount * cat.percentage) / 100 : cat.amount;
    return sum + effectiveAmount;
  }, 0);
  const taxableIncome = totalIncome - totalDeductions;
  const estimatedSelfEmploymentTax = taxableIncome * 0.9235 * selfEmploymentTaxRate;
  const estimatedFederalTax = taxableIncome * federalTaxRate;
  const totalEstimatedTax = estimatedSelfEmploymentTax + estimatedFederalTax;
  const paidSoFar = quarterlyEstimates.reduce((sum, q) => sum + q.paidAmount, 0);
  const remainingTax = totalEstimatedTax - paidSoFar;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

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
                <option value={2024}>Tax Year 2024</option>
                <option value={2023}>Tax Year 2023</option>
              </select>
              <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
                <Download className="h-4 w-4" />
                Export Tax Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Alert Banner */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Q4 Estimated Payment Due</p>
            <p className="text-sm text-yellow-700">
              Your Q4 estimated tax payment of {formatCurrency(8750)} is due by January 15, 2025.
            </p>
          </div>
          <button className="ml-auto rounded-lg bg-yellow-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-yellow-700">
            Pay Now
          </button>
        </div>

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
            <p className="text-2xl font-bold text-indigo-600">{formatCurrency(totalDeductions)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Calculator className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm text-gray-500">Est. Tax Liability</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalEstimatedTax)}</p>
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
                remainingTax > 0 ? 'text-yellow-600' : 'text-green-600'
              )}
            >
              {formatCurrency(remainingTax)}
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
                  {quarterlyEstimates.map((quarter) => {
                    const StatusIcon = statusConfig[quarter.status].icon;
                    const isPaid = quarter.status === 'paid';
                    return (
                      <div
                        key={quarter.quarter}
                        className={cn(
                          'rounded-xl border p-4',
                          quarter.status === 'overdue' && 'border-red-200 bg-red-50',
                          quarter.status === 'pending' && 'border-yellow-200 bg-yellow-50',
                          quarter.status === 'paid' && 'border-gray-200'
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-gray-900">{quarter.quarter}</span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                              statusConfig[quarter.status].color
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig[quarter.status].label}
                          </span>
                        </div>
                        <p className="mb-1 text-lg font-bold text-gray-900">
                          {formatCurrency(quarter.estimatedTax)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Due:{' '}
                          {new Date(quarter.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        {!isPaid && (
                          <button className="mt-3 w-full rounded-lg bg-indigo-600 py-1.5 text-sm text-white transition-colors hover:bg-indigo-700">
                            Mark as Paid
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
                  <span className="font-semibold text-gray-900">{formatCurrency(totalIncome)}</span>
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
                    <span className="font-bold text-gray-900">{formatCurrency(taxableIncome)}</span>
                  </div>
                </div>
                <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Self-Employment Tax</span>
                      <span className="text-xs text-gray-400">(15.3%)</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(estimatedSelfEmploymentTax)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Federal Income Tax</span>
                      <span className="text-xs text-gray-400">(est. 22%)</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(estimatedFederalTax)}
                    </span>
                  </div>
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
                  {deductionCategories.map((category) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{category.name}</span>
                        {category.percentage && category.percentage < 100 && (
                          <span className="text-xs text-gray-400">({category.percentage}%)</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(category.amount)}
                      </span>
                    </div>
                  ))}
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
                    Don&apos;t forget to deduct half of your self-employment tax when calculating
                    your adjusted gross income. This can save you hundreds of dollars!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
