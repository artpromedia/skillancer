'use client';

import { useState } from 'react';
import { useImplementResolution } from '../../hooks/api/use-disputes';

// =============================================================================
// Types
// =============================================================================

type ResolutionType = 'full_refund' | 'full_release' | 'split';

interface ResolveDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  disputeId: string;
  amount: number;
  clientName: string;
  freelancerName: string;
  onSuccess?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ResolveDisputeModal({
  isOpen,
  onClose,
  disputeId,
  amount,
  clientName,
  freelancerName,
  onSuccess,
}: Readonly<ResolveDisputeModalProps>) {
  const [resolutionType, setResolutionType] = useState<ResolutionType>('split');
  const [splitPercentage, setSplitPercentage] = useState(50);
  const [reasoning, setReasoning] = useState('');
  const [notifyParties, setNotifyParties] = useState(true);

  const resolveDispute = useImplementResolution();

  if (!isOpen) return null;

  // Calculate amounts based on resolution type
  let clientAmount = 0;
  let freelancerAmount = 0;

  switch (resolutionType) {
    case 'full_refund':
      clientAmount = amount;
      freelancerAmount = 0;
      break;
    case 'full_release':
      clientAmount = 0;
      freelancerAmount = amount;
      break;
    case 'split':
      clientAmount = Math.round(((amount * splitPercentage) / 100) * 100) / 100;
      freelancerAmount = Math.round((amount - clientAmount) * 100) / 100;
      break;
  }

  const canSubmit = reasoning.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    resolveDispute.mutate(
      {
        disputeId,
        resolution: {
          type: resolutionType,
          clientAmount,
          freelancerAmount,
          reasoning,
          notifyParties,
        } as never,
      },
      {
        onSuccess: () => {
          onSuccess?.();
          handleClose();
        },
      }
    );
  };

  const handleClose = () => {
    setResolutionType('split');
    setSplitPercentage(50);
    setReasoning('');
    setNotifyParties(true);
    onClose();
  };

  const resolutionOptions: { key: ResolutionType; label: string; description: string }[] = [
    {
      key: 'full_refund',
      label: 'Full Refund',
      description: `100% to ${clientName}`,
    },
    {
      key: 'full_release',
      label: 'Full Release',
      description: `100% to ${freelancerName}`,
    },
    {
      key: 'split',
      label: 'Split',
      description: 'Divide between parties',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        className="fixed inset-0 cursor-default border-0 bg-black/50"
        type="button"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resolve Dispute</h2>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            onClick={handleClose}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Resolve dispute <span className="font-mono font-medium">#{disputeId}</span> with a total
          value of <span className="font-bold">${amount.toLocaleString()}</span>.
        </p>

        {/* Form */}
        <div className="space-y-4">
          {/* Resolution Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Resolution Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {resolutionOptions.map((option) => (
                <button
                  key={option.key}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    resolutionType === option.key
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                  }`}
                  onClick={() => setResolutionType(option.key)}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Split Percentage (only shown for split type) */}
          {resolutionType === 'split' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Split Allocation
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                <div className="mb-3 flex justify-between text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{clientName}:</span>{' '}
                    <span className="font-bold text-blue-600">${clientAmount.toFixed(2)}</span>
                    <span className="ml-1 text-xs text-gray-400">({splitPercentage}%)</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">{freelancerName}:</span>{' '}
                    <span className="font-bold text-green-600">${freelancerAmount.toFixed(2)}</span>
                    <span className="ml-1 text-xs text-gray-400">({100 - splitPercentage}%)</span>
                  </div>
                </div>
                <input
                  className="w-full"
                  max={100}
                  min={0}
                  step={5}
                  type="range"
                  value={splitPercentage}
                  onChange={(e) => setSplitPercentage(Number(e.target.value))}
                />
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>Client: 0%</span>
                  <span>50/50</span>
                  <span>Client: 100%</span>
                </div>

                {/* Quick split buttons */}
                <div className="mt-3 flex gap-2">
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        splitPercentage === pct
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300'
                      }`}
                      onClick={() => setSplitPercentage(pct)}
                    >
                      {pct}/{100 - pct}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Resolution Summary */}
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
            <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
              Resolution Summary
            </h4>
            <ul className="mt-1 space-y-0.5 text-sm text-yellow-800 dark:text-yellow-400">
              <li>
                {clientName} receives: ${clientAmount.toFixed(2)}
              </li>
              <li>
                {freelancerName} receives: ${freelancerAmount.toFixed(2)}
              </li>
            </ul>
          </div>

          {/* Reasoning */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reasoning <span className="text-red-500">*</span>
            </label>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Explain the reasoning behind this decision..."
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
            />
          </div>

          {/* Notify option */}
          <label className="flex items-center gap-2">
            <input
              checked={notifyParties}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              type="checkbox"
              onChange={(e) => setNotifyParties(e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Notify both parties of the decision
            </span>
          </label>
        </div>

        {/* Error message */}
        {resolveDispute.isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Failed to resolve dispute. Please try again.
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || resolveDispute.isPending}
            onClick={handleSubmit}
          >
            {resolveDispute.isPending ? 'Resolving...' : 'Resolve Dispute'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResolveDisputeModal;
