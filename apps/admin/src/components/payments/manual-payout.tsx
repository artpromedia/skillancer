'use client';

import { useState } from 'react';

interface ManualPayoutProps {
  onClose: () => void;
  onSubmit?: (data: PayoutData) => void;
}

interface PayoutData {
  freelancerId: string;
  amount: number;
  reason: string;
  notes: string;
  payoutMethod: string;
}

export function ManualPayout({ onClose, onSubmit }: ManualPayoutProps) {
  const [freelancerSearch, setFreelancerSearch] = useState('');
  const [selectedFreelancer, setSelectedFreelancer] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank');
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  const mockFreelancers = [
    { id: 'f1', name: 'Alex Developer', email: 'alex@example.com' },
    { id: 'f2', name: 'Sarah Designer', email: 'sarah@example.com' },
    { id: 'f3', name: 'Mike SEO', email: 'mike@example.com' },
  ];

  const filteredFreelancers = mockFreelancers.filter(
    (f) =>
      f.name.toLowerCase().includes(freelancerSearch.toLowerCase()) ||
      f.email.toLowerCase().includes(freelancerSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedFreelancer || !amount || !reason) return;
    onSubmit?.({
      freelancerId: selectedFreelancer.id,
      amount: parseFloat(amount),
      reason,
      notes,
      payoutMethod,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Manual Payout</h3>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </button>
      </div>

      {step === 'select' && (
        <>
          {/* Freelancer Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Select Freelancer
            </label>
            {selectedFreelancer ? (
              <div className="flex items-center justify-between rounded-lg border bg-indigo-50 p-3">
                <div>
                  <p className="font-medium text-gray-900">{selectedFreelancer.name}</p>
                  <p className="text-sm text-gray-500">{selectedFreelancer.email}</p>
                </div>
                <button
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  onClick={() => setSelectedFreelancer(null)}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Search by name or email..."
                  type="text"
                  value={freelancerSearch}
                  onChange={(e) => setFreelancerSearch(e.target.value)}
                />
                {freelancerSearch && (
                  <div className="mt-2 max-h-40 overflow-auto rounded-lg border">
                    {filteredFreelancers.map((f) => (
                      <button
                        key={f.id}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50"
                        onClick={() => {
                          setSelectedFreelancer(f);
                          setFreelancerSearch('');
                        }}
                      >
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <p className="text-sm text-gray-500">{f.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                className="w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="text-gray-500">USD</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Select reason...</option>
              <option value="bonus">Performance bonus</option>
              <option value="correction">Payment correction</option>
              <option value="refund_reversal">Refund reversal</option>
              <option value="dispute_resolution">Dispute resolution</option>
              <option value="promotional">Promotional payout</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Payout Method */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Payout Method</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
            >
              <option value="bank">Bank Transfer (Default)</option>
              <option value="paypal">PayPal</option>
              <option value="wise">Wise</option>
              <option value="crypto">Cryptocurrency</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (Internal)</label>
            <textarea
              className="h-20 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Add any internal notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={!selectedFreelancer || !amount || !reason}
              onClick={() => setStep('confirm')}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
            <h4 className="font-medium text-yellow-900">Confirm Manual Payout</h4>
            <p className="mt-1 text-sm text-yellow-800">
              This action will be logged and requires approval from a senior admin.
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Recipient</dt>
              <dd className="font-medium text-gray-900">{selectedFreelancer?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Amount</dt>
              <dd className="font-bold text-gray-900">${parseFloat(amount).toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Reason</dt>
              <dd className="font-medium capitalize text-gray-900">{reason.replace('_', ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Method</dt>
              <dd className="font-medium capitalize text-gray-900">{payoutMethod}</dd>
            </div>
          </dl>

          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setStep('select')}
            >
              Back
            </button>
            <button
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              onClick={handleSubmit}
            >
              Confirm Payout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
