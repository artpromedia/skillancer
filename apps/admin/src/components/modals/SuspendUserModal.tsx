'use client';

import { useState } from 'react';
import { useSuspendUser } from '../../hooks/api/use-users';

// =============================================================================
// Types
// =============================================================================

interface SuspendUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

// =============================================================================
// Duration options (mapped to hours)
// =============================================================================

const DURATION_OPTIONS = [
  { value: '24', label: '24 Hours' },
  { value: '168', label: '7 Days' },
  { value: '336', label: '14 Days' },
  { value: '720', label: '30 Days' },
  { value: '2160', label: '90 Days' },
  { value: '0', label: 'Indefinite (Until Manually Lifted)' },
];

const REASON_OPTIONS = [
  { value: '', label: 'Select a reason...' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'payment_issues', label: 'Payment Issues' },
  { value: 'user_request', label: 'User Request' },
  { value: 'investigation', label: 'Under Investigation' },
  { value: 'other', label: 'Other' },
];

// =============================================================================
// Component
// =============================================================================

export function SuspendUserModal({
  isOpen,
  onClose,
  userId,
  userName,
  onSuccess,
}: Readonly<SuspendUserModalProps>) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [duration, setDuration] = useState('168');
  const [notes, setNotes] = useState('');

  const suspendUser = useSuspendUser();

  if (!isOpen) return null;

  const effectiveReason = reason === 'other' ? customReason : reason;
  const canSubmit = effectiveReason.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const durationHours = Number(duration) || undefined;

    suspendUser.mutate(
      {
        id: userId,
        reason: notes ? `${effectiveReason}: ${notes}` : effectiveReason,
        duration: durationHours,
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
    setReason('');
    setCustomReason('');
    setDuration('168');
    setNotes('');
    onClose();
  };

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Suspend User</h2>
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
          Suspending <span className="font-medium">{userName}</span> will temporarily restrict their
          access to the platform.
        </p>

        {/* Form */}
        <div className="space-y-4">
          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Suspension Reason <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom reason for "Other" */}
          {reason === 'other' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Specify Reason <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Enter the suspension reason..."
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Duration
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Notes
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Add any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <svg
              className="h-5 w-5 flex-shrink-0 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              The user will be notified via email about the suspension and can appeal the decision.
            </p>
          </div>
        </div>

        {/* Error message */}
        {suspendUser.isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Failed to suspend user. Please try again.
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
            className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || suspendUser.isPending}
            onClick={handleSubmit}
          >
            {suspendUser.isPending ? 'Suspending...' : 'Suspend User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuspendUserModal;
