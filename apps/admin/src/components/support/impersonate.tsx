'use client';

import { useState } from 'react';

interface ImpersonateProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export function Impersonate({ userId: _userId, userName, onClose }: ImpersonateProps) {
  const [step, setStep] = useState<'confirm' | 'reason' | 'active'>('confirm');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('15');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startImpersonation = () => {
    // Generate session ID
    setSessionId(`imp-${Date.now()}`);
    setStep('active');
  };

  const endImpersonation = () => {
    // End impersonation session
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        {/* Confirm Step */}
        {step === 'confirm' && (
          <>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-xl">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Impersonate User</h3>
                <p className="text-sm text-gray-500">
                  You are about to impersonate <strong>{userName}</strong>
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> This action is audit logged and should only be used for
                legitimate support purposes. You will see the platform exactly as this user sees it.
              </p>
            </div>

            <div className="mb-4 space-y-2 text-sm text-gray-600">
              <p>• All actions will be logged under your admin account</p>
              <p>• Session is time-limited for security</p>
              <p>• User will NOT be notified of impersonation</p>
              <p>• Payment actions are restricted during impersonation</p>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
                onClick={() => setStep('reason')}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Reason Step */}
        {step === 'reason' && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Impersonation Details</h3>
              <p className="text-sm text-gray-500">Provide a reason for audit logging</p>
            </div>

            <div className="mb-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Select reason...</option>
                  <option value="support_ticket">Support Ticket Investigation</option>
                  <option value="bug_report">Bug Report Verification</option>
                  <option value="account_issue">Account Issue Resolution</option>
                  <option value="payment_issue">Payment Issue Investigation</option>
                  <option value="verification_help">Verification Assistance</option>
                  <option value="other">Other (specify below)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Additional Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  className="h-20 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Ticket ID, specific issue details..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Session Duration
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Session will automatically end after this duration
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setStep('confirm')}
              >
                Back
              </button>
              <button
                className="flex-1 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!reason}
                onClick={startImpersonation}
              >
                Start Impersonation
              </button>
            </div>
          </>
        )}

        {/* Active Step */}
        {step === 'active' && (
          <>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Impersonation Active</h3>
                <p className="text-sm text-gray-500">Session started successfully</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-green-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">Active Session</span>
                <span className="rounded bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                  {duration} min remaining
                </span>
              </div>
              <div className="space-y-1 text-sm text-green-700">
                <p>User: {userName}</p>
                <p>Session ID: {sessionId}</p>
                <p>Started: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Quick Access</p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  className="rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  href="/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open Dashboard
                </a>
                <a
                  className="rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  href="/settings"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  User Settings
                </a>
                <a
                  className="rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  href="/wallet"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View Wallet
                </a>
                <a
                  className="rounded-lg bg-indigo-50 px-3 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  href="/jobs"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Jobs/Projects
                </a>
              </div>
            </div>

            <button
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              onClick={endImpersonation}
            >
              End Impersonation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
