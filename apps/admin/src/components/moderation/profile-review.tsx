'use client';

import { useState } from 'react';

interface ProfileReviewProps {
  profileId: string;
  onClose?: () => void;
  onAction?: (action: 'approve' | 'reject' | 'request_changes') => void;
}

interface ProfileData {
  id: string;
  name: string;
  email: string;
  title: string;
  bio: string;
  avatar: string;
  skills: string[];
  hourlyRate: number;
  location: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  documents: { type: string; url: string; uploadedAt: string }[];
  flaggedElements: { element: string; reason: string }[];
  previousActions: { action: string; by: string; at: string; reason?: string }[];
}

const mockProfile: ProfileData = {
  id: 'p1',
  name: 'Alex Developer',
  email: 'alex@example.com',
  title: 'Full Stack Developer & Blockchain Expert',
  bio: `Experienced developer with 10+ years in the industry. I specialize in React, Node.js, and blockchain development.

I have worked with Fortune 500 companies and startups alike. My notable achievements include:
- Built a trading platform handling $1B+ daily volume
- Led a team of 20 developers at TechCorp
- PhD in Computer Science from MIT (unverified claim)

Available for immediate start. Contact me at alex@personal.com for direct inquiries.`,
  avatar: '/avatars/alex.jpg',
  skills: ['React', 'Node.js', 'Solidity', 'AWS', 'Python'],
  hourlyRate: 150,
  location: 'San Francisco, CA',
  verificationStatus: 'pending',
  documents: [
    { type: 'id_document', url: '/docs/id.pdf', uploadedAt: '2024-01-10' },
    { type: 'degree', url: '/docs/degree.pdf', uploadedAt: '2024-01-10' },
  ],
  flaggedElements: [
    { element: 'bio', reason: 'Contains external contact information' },
    { element: 'bio', reason: 'Unverifiable credential claim (PhD from MIT)' },
  ],
  previousActions: [
    { action: 'Profile created', by: 'User', at: '2024-01-05T10:00:00Z' },
    { action: 'Verification requested', by: 'User', at: '2024-01-10T14:00:00Z' },
    {
      action: 'Auto-flagged',
      by: 'System',
      at: '2024-01-10T14:01:00Z',
      reason: 'Contact info in bio',
    },
  ],
};

export function ProfileReview({ onClose, onAction }: ProfileReviewProps) {
  const [profile] = useState<ProfileData>(mockProfile);
  const [actionReason, setActionReason] = useState('');
  const [selectedAction, setSelectedAction] = useState<'reject' | 'request_changes' | null>(null);
  const [requestedChanges, setRequestedChanges] = useState<string[]>([]);

  const changeOptions = [
    'Remove external contact information from bio',
    'Remove unverifiable credential claims',
    'Update profile photo to show face clearly',
    'Provide additional verification documents',
  ];

  const handleChangeToggle = (change: string) => {
    setRequestedChanges((prev) =>
      prev.includes(change) ? prev.filter((c) => c !== change) : [...prev, change]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-gray-600">{profile.title}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>
        {onClose && (
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Flagged Elements */}
          {profile.flaggedElements.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="font-medium text-yellow-900">Flagged Elements</h3>
              <ul className="mt-2 space-y-2">
                {profile.flaggedElements.map((flag, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-yellow-800">
                    <span className="font-medium capitalize">{flag.element}:</span>
                    <span>{flag.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bio */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Bio</h3>
            <div className="whitespace-pre-wrap text-sm text-gray-700">{profile.bio}</div>
          </div>

          {/* Skills */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Verification Documents */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Verification Documents</h3>
            <div className="space-y-2">
              {profile.documents.map((doc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    <div>
                      <p className="font-medium capitalize text-gray-900">
                        {doc.type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button className="rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200">
                    View Document
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Forms */}
          {selectedAction === 'reject' && (
            <div className="rounded-lg border border-red-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-red-900">Rejection Reason</h3>
              <select
                className="mb-2 w-full rounded-lg border p-2"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              >
                <option value="">Select reason...</option>
                <option value="fake_identity">Fake or stolen identity</option>
                <option value="fake_credentials">Fraudulent credentials</option>
                <option value="prohibited_content">Prohibited content</option>
                <option value="spam">Spam account</option>
                <option value="other">Other</option>
              </select>
              <textarea
                className="h-20 w-full rounded-lg border p-2 text-sm"
                placeholder="Additional notes..."
              />
            </div>
          )}

          {selectedAction === 'request_changes' && (
            <div className="rounded-lg border border-yellow-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-yellow-900">Request Changes</h3>
              <div className="space-y-2">
                {changeOptions.map((change) => (
                  <label key={change} className="flex items-center gap-2">
                    <input
                      checked={requestedChanges.includes(change)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      type="checkbox"
                      onChange={() => handleChangeToggle(change)}
                    />
                    <span className="text-sm text-gray-700">{change}</span>
                  </label>
                ))}
              </div>
              <textarea
                className="mt-3 h-20 w-full rounded-lg border p-2 text-sm"
                placeholder="Additional instructions..."
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Profile Details */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Profile Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Hourly Rate</dt>
                <dd className="font-medium text-gray-900">${profile.hourlyRate}/hr</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Location</dt>
                <dd className="font-medium text-gray-900">{profile.location}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Verification</dt>
                <dd>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      profile.verificationStatus === 'verified'
                        ? 'bg-green-100 text-green-700'
                        : profile.verificationStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {profile.verificationStatus}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Previous Actions */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Moderation History</h3>
            <ul className="space-y-3">
              {profile.previousActions.map((action, i) => (
                <li key={i} className="border-l-2 border-gray-200 pl-3 text-sm">
                  <p className="font-medium text-gray-900">{action.action}</p>
                  <p className="text-xs text-gray-500">
                    by {action.by} • {new Date(action.at).toLocaleString()}
                  </p>
                  {action.reason && <p className="text-gray-600">{action.reason}</p>}
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                View Full Profile
              </button>
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                View User Activity
              </button>
              <button className="w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
                Suspend Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {selectedAction ? (
          <>
            <button
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setSelectedAction(null)}
            >
              Cancel
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                selectedAction === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
              onClick={() => {
                onAction?.(selectedAction);
                setSelectedAction(null);
              }}
            >
              {selectedAction === 'reject' ? 'Confirm Rejection' : 'Send Change Request'}
            </button>
          </>
        ) : (
          <>
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => setSelectedAction('reject')}
            >
              Reject Verification
            </button>
            <button
              className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
              onClick={() => setSelectedAction('request_changes')}
            >
              Request Changes
            </button>
            <button
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              onClick={() => onAction?.('approve')}
            >
              Approve Verification
            </button>
          </>
        )}
      </div>
    </div>
  );
}
