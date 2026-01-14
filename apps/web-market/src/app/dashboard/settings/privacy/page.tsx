/**
 * GDPR Privacy Settings Page
 *
 * Allows users to:
 * - Request data export
 * - Request account deletion
 * - Manage consent preferences
 * - View data request history
 */

'use client';

import {
  Download,
  Trash2,
  Shield,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  Lock,
  Eye,
  Mail,
  BarChart,
  Users,
} from 'lucide-react';
import { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

interface DataRequest {
  id: string;
  requestType: 'DATA_EXPORT' | 'DATA_DELETION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

interface ConsentPreference {
  type: string;
  name: string;
  description: string;
  granted: boolean;
  required: boolean;
}

// =============================================================================
// Mock Data (Replace with API calls)
// =============================================================================

const mockDataRequests: DataRequest[] = [
  {
    id: '1',
    requestType: 'DATA_EXPORT',
    status: 'COMPLETED',
    requestedAt: '2025-12-01T10:00:00Z',
    completedAt: '2025-12-02T14:30:00Z',
    downloadUrl: '/api/gdpr/download/1',
  },
];

const mockConsentPreferences: ConsentPreference[] = [
  {
    type: 'TERMS_OF_SERVICE',
    name: 'Terms of Service',
    description: 'Required to use the platform',
    granted: true,
    required: true,
  },
  {
    type: 'PRIVACY_POLICY',
    name: 'Privacy Policy',
    description: 'Required to use the platform',
    granted: true,
    required: true,
  },
  {
    type: 'MARKETING_EMAIL',
    name: 'Marketing Emails',
    description: 'Receive updates about new features, tips, and promotions',
    granted: false,
    required: false,
  },
  {
    type: 'ANALYTICS',
    name: 'Analytics',
    description: 'Help us improve by sharing anonymous usage data',
    granted: true,
    required: false,
  },
  {
    type: 'THIRD_PARTY_SHARING',
    name: 'Third-Party Sharing',
    description: 'Share data with trusted partners for enhanced services',
    granted: false,
    required: false,
  },
];

// =============================================================================
// Components
// =============================================================================

function DataExportSection() {
  const [isRequesting, setIsRequesting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRequestExport = async () => {
    setIsRequesting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRequesting(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Download Your Data
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Request a copy of all your personal data. This includes your profile, contracts,
            messages, reviews, and activity history.
          </p>

          {showSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">
                Your data export request has been submitted. You&apos;ll receive an email when it&apos;s
                ready (typically within 24-48 hours).
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleRequestExport}
              disabled={isRequesting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isRequesting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Requesting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Request Data Export
                </>
              )}
            </button>
            <span className="text-xs text-gray-500">Usually ready within 24-48 hours</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountDeletionSection() {
  const [showModal, setShowModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRequestDeletion = async () => {
    if (!confirmEmail || !reason) return;
    setIsDeleting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsDeleting(false);
    setShowModal(false);
    // Show success message
  };

  return (
    <>
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
              Delete Your Account
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            <div className="mt-4 rounded-lg bg-red-100 p-3 dark:bg-red-900/40">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium">Before you delete:</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    <li>Complete or cancel all active contracts</li>
                    <li>Withdraw any pending payouts</li>
                    <li>Download your data if you want to keep a copy</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Request Account Deletion
            </button>
          </div>
        </div>
      </div>

      {/* Deletion Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Confirm Account Deletion
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This action is permanent and cannot be undone. All your data will be permanently
              deleted after a 14-day grace period.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm your email
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Why are you leaving?
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                >
                  <option value="">Select a reason...</option>
                  <option value="not_using">Not using the platform anymore</option>
                  <option value="found_alternative">Found an alternative</option>
                  <option value="privacy_concerns">Privacy concerns</option>
                  <option value="too_complicated">Platform is too complicated</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestDeletion}
                disabled={!confirmEmail || !reason || isDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Processing...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConsentSection() {
  const [consents, setConsents] = useState(mockConsentPreferences);

  const handleToggleConsent = (type: string) => {
    setConsents((prev) =>
      prev.map((c) => (c.type === type && !c.required ? { ...c, granted: !c.granted } : c))
    );
    // Call API to update consent
  };

  const consentIcons: Record<string, React.ReactNode> = {
    TERMS_OF_SERVICE: <FileText className="h-5 w-5" />,
    PRIVACY_POLICY: <Lock className="h-5 w-5" />,
    MARKETING_EMAIL: <Mail className="h-5 w-5" />,
    ANALYTICS: <BarChart className="h-5 w-5" />,
    THIRD_PARTY_SHARING: <Users className="h-5 w-5" />,
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <Eye className="h-6 w-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Privacy Preferences
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage how we use your data and what communications you receive.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {consents.map((consent) => (
          <div
            key={consent.type}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="text-gray-400">{consentIcons[consent.type]}</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{consent.name}</p>
                <p className="text-sm text-gray-500">{consent.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {consent.required && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  Required
                </span>
              )}
              <button
                onClick={() => handleToggleConsent(consent.type)}
                disabled={consent.required}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  consent.granted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                } ${consent.required ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    consent.granted ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataRequestHistory() {
  const [requests] = useState(mockDataRequests);

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  if (requests.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Request History</h3>
      </div>

      <div className="mt-4 space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              {request.requestType === 'DATA_EXPORT' ? (
                <Download className="h-5 w-5 text-gray-400" />
              ) : (
                <Trash2 className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {request.requestType === 'DATA_EXPORT' ? 'Data Export' : 'Account Deletion'}
                </p>
                <p className="text-xs text-gray-500">
                  Requested on {new Date(request.requestedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2 py-1 text-xs ${statusColors[request.status]}`}>
                {request.status}
              </span>
              {request.status === 'COMPLETED' && request.downloadUrl && (
                <a
                  href={request.downloadUrl}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Download
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function PrivacySettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Privacy & Data</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your personal data and privacy preferences
            </p>
          </div>
        </div>
      </div>

      {/* GDPR Info Banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">Your Data Rights (GDPR)</p>
          <p className="mt-1">
            Under GDPR and other privacy regulations, you have the right to access, download, and
            delete your personal data. We are committed to protecting your privacy.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        <DataExportSection />
        <ConsentSection />
        <DataRequestHistory />
        <AccountDeletionSection />
      </div>
    </div>
  );
}
