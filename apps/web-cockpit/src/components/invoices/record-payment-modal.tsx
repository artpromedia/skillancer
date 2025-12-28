'use client';

import { cn } from '@skillancer/ui';
import {
  DollarSign,
  Calendar,
  CreditCard,
  Banknote,
  Building2,
  Wallet,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import { useState } from 'react';

// Types
interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecord: (payment: PaymentRecord) => void;
  invoiceNumber: string;
  clientName: string;
  totalDue: number;
  amountPaid?: number;
}

interface PaymentRecord {
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  isPartial: boolean;
}

type PaymentMethod =
  | 'bank_transfer'
  | 'credit_card'
  | 'paypal'
  | 'stripe'
  | 'check'
  | 'cash'
  | 'other';

const paymentMethods: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { id: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { id: 'paypal', label: 'PayPal', icon: Wallet },
  { id: 'stripe', label: 'Stripe', icon: CreditCard },
  { id: 'check', label: 'Check', icon: Banknote },
  { id: 'cash', label: 'Cash', icon: DollarSign },
  { id: 'other', label: 'Other', icon: Wallet },
];

export function RecordPaymentModal({
  isOpen,
  onClose,
  onRecord,
  invoiceNumber,
  clientName,
  totalDue,
  amountPaid = 0,
}: Readonly<RecordPaymentModalProps>) {
  const remainingBalance = totalDue - amountPaid;
  const [amount, setAmount] = useState(remainingBalance);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  if (!isOpen) return null;

  const isPartialPayment = amount < remainingBalance;
  const isOverpayment = amount > remainingBalance;

  const handleRecord = async () => {
    setIsRecording(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    onRecord({
      amount,
      date,
      method,
      reference: reference || undefined,
      notes: notes || undefined,
      isPartial: isPartialPayment,
    });
    setIsRecording(false);
    onClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
            <p className="mt-1 text-sm text-gray-500">
              {invoiceNumber} • {clientName}
            </p>
          </div>
          <button className="rounded-lg p-2 transition-colors hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Amount Summary */}
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
            <div>
              <div className="mb-1 text-xs text-gray-500">Invoice Total</div>
              <div className="font-semibold text-gray-900">{formatCurrency(totalDue)}</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-gray-500">Paid</div>
              <div className="font-semibold text-green-600">{formatCurrency(amountPaid)}</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-gray-500">Balance Due</div>
              <div className="font-semibold text-gray-900">{formatCurrency(remainingBalance)}</div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="payment-amount"
            >
              Payment Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                id="payment-amount"
                min="0"
                step="0.01"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number.parseFloat(e.target.value) || 0)}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-green-50 px-3 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-100"
                onClick={() => setAmount(remainingBalance)}
              >
                Full Amount
              </button>
            </div>

            {/* Payment Status Indicator */}
            {amount > 0 && (
              <div className="mt-2">
                {isPartialPayment && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Partial payment - {formatCurrency(remainingBalance - amount)} will remain
                    </span>
                  </div>
                )}
                {amount === remainingBalance && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Full payment - Invoice will be marked as paid</span>
                  </div>
                )}
                {isOverpayment && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Overpayment - {formatCurrency(amount - remainingBalance)} credit will be
                      applied
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="payment-date">
              Payment Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Payment Method */}
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700">Payment Method</legend>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map((pm) => {
                const Icon = pm.icon;
                return (
                  <button
                    key={pm.id}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors',
                      method === pm.id
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                    onClick={() => setMethod(pm.id)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Reference Number */}
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700"
              htmlFor="payment-reference"
            >
              Reference / Transaction ID{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              id="payment-reference"
              placeholder={method === 'check' ? 'Check number' : 'Transaction ID'}
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="payment-notes">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              id="payment-notes"
              placeholder="Add any additional notes..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
          <button
            className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-6 py-2 transition-colors',
              amount > 0 && !isRecording
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            )}
            disabled={amount <= 0 || isRecording}
            onClick={() => void handleRecord()}
          >
            {isRecording ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordPaymentModal;
