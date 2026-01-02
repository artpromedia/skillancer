'use client';

/**
 * Advance Calculator Component
 * Multi-select invoices, calculate advance amount and fees
 * Sprint M6: Invoice Financing
 */

import {
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Info,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface EligibleInvoice {
  id: string;
  clientName: string;
  amount: number;
  ageDays: number;
  maxAdvancePercent: number;
  feeRate: number;
  dueDate: string;
}

interface AdvanceCalculation {
  selectedInvoices: string[];
  totalInvoiceAmount: number;
  advancePercent: number;
  advanceAmount: number;
  totalFee: number;
  youReceive: number;
  estimatedRepaymentDate: string;
}

interface AdvanceCalculatorProps {
  invoices: EligibleInvoice[];
  onRequestAdvance: (calculation: AdvanceCalculation) => Promise<void>;
  maxOutstandingAdvances?: number;
  currentOutstandingAmount?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AdvanceCalculator({
  invoices,
  onRequestAdvance,
  maxOutstandingAdvances = 10000,
  currentOutstandingAmount = 0,
}: AdvanceCalculatorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [advancePercent, setAdvancePercent] = useState(85);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Calculate totals
  const calculation = useMemo<AdvanceCalculation>(() => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    const totalInvoiceAmount = selected.reduce((sum, inv) => sum + inv.amount, 0);

    // Use the minimum max advance % among selected invoices
    const maxPercent =
      selected.length > 0 ? Math.min(...selected.map((inv) => inv.maxAdvancePercent)) : 90;

    const effectivePercent = Math.min(advancePercent, maxPercent);
    const advanceAmount = totalInvoiceAmount * (effectivePercent / 100);

    // Weighted average fee rate
    const weightedFeeRate =
      selected.length > 0
        ? selected.reduce((sum, inv) => sum + inv.feeRate * inv.amount, 0) / totalInvoiceAmount
        : 3;

    const totalFee = advanceAmount * (weightedFeeRate / 100);
    const youReceive = advanceAmount - totalFee;

    // Estimate repayment as latest due date
    const latestDue =
      selected.length > 0
        ? selected.reduce(
            (latest, inv) => (new Date(inv.dueDate) > new Date(latest) ? inv.dueDate : latest),
            selected[0].dueDate
          )
        : new Date().toISOString();

    return {
      selectedInvoices: Array.from(selectedIds),
      totalInvoiceAmount,
      advancePercent: effectivePercent,
      advanceAmount,
      totalFee,
      youReceive,
      estimatedRepaymentDate: latestDue,
    };
  }, [invoices, selectedIds, advancePercent]);

  const availableCredit = maxOutstandingAdvances - currentOutstandingAmount;
  const exceedsLimit = calculation.advanceAmount > availableCredit;

  const toggleInvoice = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  };

  const handleSubmit = async () => {
    if (!agreedToTerms || exceedsLimit || selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      await onRequestAdvance(calculation);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 p-4">
        <Calculator className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">Advance Calculator</h3>
      </div>

      {/* Invoice Selection */}
      <div className="border-b border-gray-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Select Invoices</span>
          <button className="text-sm text-indigo-600 hover:text-indigo-700" onClick={selectAll}>
            {selectedIds.size === invoices.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {invoices.map((invoice) => (
            <label
              key={invoice.id}
              className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                selectedIds.has(invoice.id)
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                checked={selectedIds.has(invoice.id)}
                className="sr-only"
                type="checkbox"
                onChange={() => toggleInvoice(invoice.id)}
              />
              <div
                className={`mr-3 flex h-5 w-5 items-center justify-center rounded border-2 ${
                  selectedIds.has(invoice.id)
                    ? 'border-indigo-600 bg-indigo-600'
                    : 'border-gray-300'
                }`}
              >
                {selectedIds.has(invoice.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{invoice.clientName}</div>
                <div className="text-sm text-gray-500">
                  {invoice.ageDays} days old • {invoice.feeRate}% fee
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${invoice.amount.toLocaleString()}</div>
                <div className="text-xs text-green-600">Up to {invoice.maxAdvancePercent}%</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Advance Slider */}
      {selectedIds.size > 0 && (
        <div className="border-b border-gray-100 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Advance Amount</span>
            <span className="text-sm font-bold text-indigo-600">{advancePercent}%</span>
          </div>
          <input
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-indigo-600"
            max={90}
            min={70}
            type="range"
            value={advancePercent}
            onChange={(e) => setAdvancePercent(Number(e.target.value))}
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>70%</span>
            <span>90%</span>
          </div>
        </div>
      )}

      {/* Calculation Summary */}
      {selectedIds.size > 0 && (
        <div className="bg-gray-50 p-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Invoice Total</span>
              <span className="font-medium">
                ${calculation.totalInvoiceAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Advance ({calculation.advancePercent}%)</span>
              <span className="font-medium">${calculation.advanceAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fee</span>
              <span className="font-medium text-red-600">
                -${calculation.totalFee.toLocaleString()}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">You Receive</span>
                <span className="text-xl font-bold text-green-600">
                  ${calculation.youReceive.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Repayment when client pays (est.{' '}
                {new Date(calculation.estimatedRepaymentDate).toLocaleDateString()})
              </div>
            </div>
          </div>

          {/* Limit Warning */}
          {exceedsLimit && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                This advance exceeds your available credit of ${availableCredit.toLocaleString()}.
                Select fewer invoices or reduce the advance percentage.
              </div>
            </div>
          )}

          {/* Terms */}
          <div className="mt-4">
            <button
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setShowTerms(!showTerms)}
            >
              <FileText className="h-4 w-4" />
              Terms and Conditions
              {showTerms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showTerms && (
              <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
                <p className="mb-2">
                  By requesting an advance, you agree to repay the advance amount plus fees when
                  your client pays the invoice. If the client does not pay within 60 days of the
                  invoice due date, you are responsible for repaying the advance.
                </p>
                <p>
                  The fee is calculated based on the risk assessment of the invoice and is
                  non-refundable once the advance is funded. Advances are typically funded within
                  minutes during business hours.
                </p>
              </div>
            )}
          </div>

          {/* Agreement */}
          <label className="mt-4 flex cursor-pointer items-start gap-2">
            <input
              checked={agreedToTerms}
              className="mt-1"
              type="checkbox"
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            />
            <span className="text-sm text-gray-600">
              I agree to the terms and conditions and understand that I am responsible for repayment
              if the client does not pay.
            </span>
          </label>

          {/* Submit */}
          <button
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-colors ${
              agreedToTerms && !exceedsLimit && !isSubmitting
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'cursor-not-allowed bg-gray-200 text-gray-500'
            }`}
            disabled={!agreedToTerms || exceedsLimit || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="h-5 w-5" />
                Request ${calculation.youReceive.toLocaleString()} Advance
              </>
            )}
          </button>
        </div>
      )}

      {/* Empty State */}
      {selectedIds.size === 0 && (
        <div className="p-6 text-center text-gray-500">
          <Info className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <p>Select invoices above to calculate your advance</p>
        </div>
      )}
    </div>
  );
}

export default AdvanceCalculator;
