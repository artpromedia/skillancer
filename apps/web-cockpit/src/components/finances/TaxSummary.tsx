/**
 * Tax Summary Component
 * Displays year-to-date earnings and tax information
 */

'use client';

import { Download, Calendar, TrendingUp } from 'lucide-react';

import { useEarnings } from '@/hooks/api/use-cockpit-finances';

interface TaxSummaryProps {
  className?: string;
}

interface QuarterData {
  quarter: string;
  earnings: number;
  estimatedTax: number;
}

export function TaxSummary({ className = '' }: Readonly<TaxSummaryProps>) {
  const { data: earningsData, isLoading } = useEarnings();

  // TODO: Get actual quarterly breakdown from API
  const currentYear = new Date().getFullYear();
  const ytdEarnings = earningsData?.yearToDate ?? 0;

  // Estimate tax at 30% for freelancers (placeholder)
  const estimatedTax = ytdEarnings * 0.3;

  // TODO: Replace with actual quarterly data
  const quarters: QuarterData[] = [
    { quarter: 'Q1', earnings: ytdEarnings * 0.25, estimatedTax: ytdEarnings * 0.25 * 0.3 },
    { quarter: 'Q2', earnings: ytdEarnings * 0.28, estimatedTax: ytdEarnings * 0.28 * 0.3 },
    { quarter: 'Q3', earnings: ytdEarnings * 0.27, estimatedTax: ytdEarnings * 0.27 * 0.3 },
    { quarter: 'Q4', earnings: ytdEarnings * 0.2, estimatedTax: ytdEarnings * 0.2 * 0.3 },
  ];

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
        <div className="h-96 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tax Summary {currentYear}</h3>
            <p className="text-sm text-gray-500">Year-to-date earnings and estimates</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            type="button"
          >
            <Download className="h-4 w-4" />
            Export 1099
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 p-6">
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-blue-700">
            <TrendingUp className="h-4 w-4" />
            <span>Total Earnings</span>
          </div>
          <p className="text-2xl font-bold text-blue-900">${ytdEarnings.toLocaleString()}</p>
          <p className="mt-1 text-xs text-blue-600">Year to date</p>
        </div>

        <div className="rounded-lg bg-amber-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm text-amber-700">
            <Calendar className="h-4 w-4" />
            <span>Estimated Tax</span>
          </div>
          <p className="text-2xl font-bold text-amber-900">${estimatedTax.toLocaleString()}</p>
          <p className="mt-1 text-xs text-amber-600">~30% of earnings</p>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="border-t border-gray-200 p-6">
        <h4 className="mb-4 font-medium text-gray-900">Quarterly Breakdown</h4>
        <div className="space-y-3">
          {quarters.map((q) => (
            <div
              key={q.quarter}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <span className="font-semibold text-gray-700">{q.quarter}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">${q.earnings.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total earnings</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">${q.estimatedTax.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Est. tax</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Tips */}
      <div className="border-t border-gray-200 bg-amber-50 p-6">
        <h4 className="mb-2 font-medium text-amber-900">Tax Planning Tips</h4>
        <ul className="space-y-2 text-sm text-amber-800">
          <li className="flex items-start gap-2">
            <span className="text-amber-600">•</span>
            <span>Set aside 25-30% of your earnings for taxes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600">•</span>
            <span>Make quarterly estimated tax payments to avoid penalties</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600">•</span>
            <span>Track business expenses for deductions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600">•</span>
            <span>Consult a tax professional for personalized advice</span>
          </li>
        </ul>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-500">
          Tax estimates are approximate. Consult a tax professional for accurate calculations.
        </p>
      </div>
    </div>
  );
}
