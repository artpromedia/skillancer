'use client';

import { useState } from 'react';

import { ManualPayout } from '@/components/payments/manual-payout';

interface TransactionDetail {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  fees: { platform: number; processing: number; total: number };
  payer: { id: string; name: string; email: string; type: string };
  payee: { id: string; name: string; email: string; type: string };
  contract?: { id: string; title: string };
  milestone?: { id: string; title: string };
  invoice?: { id: string; number: string };
  processorData: { provider: string; transactionId: string; status: string; createdAt: string };
  timeline: { event: string; at: string; details?: string }[];
}

const mockTransaction: TransactionDetail = {
  id: 't1',
  reference: 'PAY-001234',
  type: 'payment',
  status: 'completed',
  amount: 2500,
  currency: 'USD',
  fees: { platform: 125, processing: 50, total: 175 },
  payer: { id: 'u1', name: 'TechCorp Inc.', email: 'billing@techcorp.com', type: 'client' },
  payee: { id: 'u2', name: 'Alex Developer', email: 'alex@example.com', type: 'freelancer' },
  contract: { id: 'c1', title: 'E-commerce Website Development' },
  milestone: { id: 'm2', title: 'Frontend Development' },
  invoice: { id: 'inv1', number: 'INV-2024-001234' },
  processorData: {
    provider: 'Stripe',
    transactionId: 'pi_3OaBC123456789',
    status: 'succeeded',
    createdAt: '2024-01-15T10:00:00Z',
  },
  timeline: [
    { event: 'Payment initiated', at: '2024-01-15T09:58:00Z' },
    { event: 'Payment authorized', at: '2024-01-15T09:58:30Z' },
    { event: 'Payment captured', at: '2024-01-15T10:00:00Z' },
    { event: 'Funds added to escrow', at: '2024-01-15T10:00:05Z' },
  ],
};

export default function TransactionDetailPage({
  params: _params,
}: {
  params: { transactionId: string };
}) {
  const [transaction] = useState<TransactionDetail>(mockTransaction);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showManualPayout, setShowManualPayout] = useState(false);
  const [refundAmount, setRefundAmount] = useState(transaction.amount);
  const [refundReason, setRefundReason] = useState('');

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      succeeded: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleRefund = () => {
    console.log('Processing refund:', { amount: refundAmount, reason: refundReason });
    setShowRefundForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{transaction.reference}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(transaction.status)}`}
            >
              {transaction.status}
            </span>
          </div>
          <p className="capitalize text-gray-600">{transaction.type} Transaction</p>
        </div>
        <div className="flex gap-2">
          {transaction.status === 'completed' && (
            <button
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              onClick={() => setShowRefundForm(true)}
            >
              Issue Refund
            </button>
          )}
          {transaction.status === 'failed' && (
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Retry Transaction
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Amount */}
          <div className="rounded-lg border bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Transaction Amount</div>
                <div className="text-4xl font-bold text-gray-900">
                  ${transaction.amount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">{transaction.currency}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Net Amount</div>
                <div className="text-2xl font-bold text-green-600">
                  ${(transaction.amount - transaction.fees.total).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Fees Breakdown */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Fees Breakdown</h3>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-600">Platform Fee (5%)</dt>
                <dd className="font-medium text-gray-900">${transaction.fees.platform}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-600">Processing Fee</dt>
                <dd className="font-medium text-gray-900">${transaction.fees.processing}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm">
                <dt className="font-medium text-gray-900">Total Fees</dt>
                <dd className="font-bold text-gray-900">${transaction.fees.total}</dd>
              </div>
            </dl>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 text-xs font-medium uppercase text-gray-500">Payer</h3>
              <p className="font-medium text-gray-900">{transaction.payer.name}</p>
              <p className="text-sm text-gray-600">{transaction.payer.email}</p>
              <p className="mt-1 text-xs capitalize text-gray-500">{transaction.payer.type}</p>
              <button className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View Profile →
              </button>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-2 text-xs font-medium uppercase text-gray-500">Payee</h3>
              <p className="font-medium text-gray-900">{transaction.payee.name}</p>
              <p className="text-sm text-gray-600">{transaction.payee.email}</p>
              <p className="mt-1 text-xs capitalize text-gray-500">{transaction.payee.type}</p>
              <button className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View Profile →
              </button>
            </div>
          </div>

          {/* Related */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Related</h3>
            <div className="space-y-3">
              {transaction.contract && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">Contract:</span>{' '}
                    <span className="font-medium text-gray-900">{transaction.contract.title}</span>
                  </div>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    View
                  </button>
                </div>
              )}
              {transaction.milestone && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">Milestone:</span>{' '}
                    <span className="font-medium text-gray-900">{transaction.milestone.title}</span>
                  </div>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    View
                  </button>
                </div>
              )}
              {transaction.invoice && (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">Invoice:</span>{' '}
                    <span className="font-medium text-gray-900">{transaction.invoice.number}</span>
                  </div>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    View
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Transaction Timeline</h3>
            <div className="space-y-3">
              {transaction.timeline.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    {i < transaction.timeline.length - 1 && (
                      <div className="h-full w-0.5 bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{event.event}</p>
                      <span className="text-xs text-gray-500">
                        {new Date(event.at).toLocaleString()}
                      </span>
                    </div>
                    {event.details && <p className="text-sm text-gray-600">{event.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refund Form */}
          {showRefundForm && (
            <div className="rounded-lg border-2 border-red-200 bg-white p-4">
              <h3 className="mb-4 font-medium text-red-900">Issue Refund</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Refund Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">$</span>
                    <input
                      className="w-32 rounded-lg border px-3 py-2"
                      max={transaction.amount}
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(Number(e.target.value))}
                    />
                    <span className="text-sm text-gray-500">Max: ${transaction.amount}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                  >
                    <option value="">Select reason...</option>
                    <option value="dispute">Dispute resolution</option>
                    <option value="cancellation">Contract cancellation</option>
                    <option value="error">Processing error</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowRefundForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    onClick={handleRefund}
                  >
                    Process Refund
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Processor Data */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Payment Processor</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Provider</dt>
                <dd className="font-medium text-gray-900">{transaction.processorData.provider}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Transaction ID</dt>
                <dd className="font-mono text-xs text-gray-900">
                  {transaction.processorData.transactionId}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(transaction.processorData.status)}`}
                  >
                    {transaction.processorData.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">
                  {new Date(transaction.processorData.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Actions</h3>
            <div className="space-y-2">
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                Download Receipt
              </button>
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                View in Stripe Dashboard
              </button>
              <button
                className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowManualPayout(true)}
              >
                Manual Adjustment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Payout Modal */}
      {showManualPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <ManualPayout onClose={() => setShowManualPayout(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
