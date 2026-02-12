'use client';

import { useState } from 'react';
import { useBanUser } from '../../hooks/api/use-users';

// =============================================================================
// Types
// =============================================================================

interface BanUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

const REASON_OPTIONS = [
  { value: '', label: 'Select a reason...' },
  { value: 'fraud', label: 'Fraud / Scam' },
  { value: 'spam', label: 'Spam / Fake Account' },
  { value: 'harassment', label: 'Harassment / Abuse' },
  { value: 'illegal_content', label: 'Illegal Content' },
  { value: 'repeated_violations', label: 'Repeated Policy Violations' },
  { value: 'identity_theft', label: 'Identity Theft' },
  { value: 'money_laundering', label: 'Suspected Money Laundering' },
];

// =============================================================================
// Component
// =============================================================================

export function BanUserModal({
  isOpen,
  onClose,
  userId,
  userName,
  onSuccess,
}: Readonly<BanUserModalProps>) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const banUser = useBanUser();

  if (!isOpen) return null;

  const canSubmit = reason.trim().length > 0 && confirmText === 'BAN';

  const handleSubmit = () => {
    if (!canSubmit) return;

    const fullReason = additionalNotes ? `${reason}: ${additionalNotes}` : reason;

    banUser.mutate(
      { id: userId, reason: fullReason },
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
    setConfirmText('');
    setAdditionalNotes('');
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ban User Permanently
          </h2>
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
          This will permanently ban <span className="font-medium">{userName}</span> from the
          platform.
        </p>

        {/* Form */}
        <div className="space-y-4">
          {/* Danger Warning */}
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              This action is permanent and cannot be easily undone!
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-red-600 dark:text-red-400">
              <li>User will lose access immediately</li>
              <li>All active contracts will be flagged</li>
              <li>Pending payouts will be held for review</li>
              <li>Profile will be hidden from public</li>
            </ul>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Ban Reason <span className="text-red-500">*</span>
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

          {/* Additional Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Notes
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Add any additional context or evidence references..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
            />
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Type &quot;BAN&quot; to confirm <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Type BAN to confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {/* Error message */}
        {banUser.isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            Failed to ban user. Please try again.
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
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || banUser.isPending}
            onClick={handleSubmit}
          >
            {banUser.isPending ? 'Banning...' : 'Permanently Ban User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BanUserModal;
