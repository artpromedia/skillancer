'use client';

import { useState } from 'react';

interface JobReviewProps {
  jobId: string;
  onClose?: () => void;
  onAction?: (action: 'approve' | 'reject' | 'edit') => void;
}

interface JobData {
  id: string;
  title: string;
  description: string;
  budget: { min: number; max: number; type: 'fixed' | 'hourly' };
  skills: string[];
  poster: { id: string; name: string; email: string; joinedAt: string; jobsPosted: number };
  flags: { type: string; description: string; aiConfidence: number }[];
  similarJobs: { id: string; title: string; status: string }[];
  moderationHistory: { action: string; by: string; at: string; reason?: string }[];
}

const mockJob: JobData = {
  id: '1',
  title: 'Senior React Developer Needed',
  description: `We're looking for an experienced React developer to join our team.

Requirements:
- 5+ years of React experience
- TypeScript proficiency
- Experience with Next.js

Contact us at team@company.com or call 555-123-4567 for more details.

Budget is negotiable based on experience.`,
  budget: { min: 50, max: 100, type: 'hourly' },
  skills: ['React', 'TypeScript', 'Next.js', 'Node.js'],
  poster: {
    id: 'u1',
    name: 'John Client',
    email: 'john@company.com',
    joinedAt: '2023-06-15',
    jobsPosted: 12,
  },
  flags: [
    {
      type: 'contact_info',
      description: 'Email address detected in description',
      aiConfidence: 0.95,
    },
    {
      type: 'contact_info',
      description: 'Phone number detected in description',
      aiConfidence: 0.92,
    },
  ],
  similarJobs: [
    { id: 'j2', title: 'React Developer for Startup', status: 'approved' },
    { id: 'j3', title: 'Frontend Engineer (React)', status: 'rejected' },
  ],
  moderationHistory: [
    {
      action: 'auto_flagged',
      by: 'System',
      at: '2024-01-15T10:00:00Z',
      reason: 'Contact info detected',
    },
  ],
};

export function JobReview({ onClose, onAction }: JobReviewProps) {
  const [job] = useState<JobData>(mockJob);
  const [rejectReason, setRejectReason] = useState('');
  const [editedDescription, setEditedDescription] = useState(job.description);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const highlightContactInfo = (text: string) => {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const phoneRegex = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g;

    let highlighted = text.replace(emailRegex, '<mark class="bg-red-200 px-1 rounded">$&</mark>');
    highlighted = highlighted.replace(
      phoneRegex,
      '<mark class="bg-red-200 px-1 rounded">$&</mark>'
    );

    return highlighted;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
          <p className="text-sm text-gray-500">Job ID: {job.id}</p>
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
          {/* Flags */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="font-medium text-red-900">Policy Violations Detected</h3>
            <ul className="mt-2 space-y-2">
              {job.flags.map((flag, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-red-800">{flag.description}</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {Math.round(flag.aiConfidence * 100)}% confidence
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Job Description */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Job Description</h3>
            {showEditForm ? (
              <textarea
                className="h-48 w-full rounded-lg border p-3 font-mono text-sm"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
              />
            ) : (
              <div
                className="prose prose-sm max-w-none whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightContactInfo(job.description) }}
              />
            )}
          </div>

          {/* Job Details */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Job Details</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Budget</dt>
                <dd className="font-medium text-gray-900">
                  ${job.budget.min} - ${job.budget.max} / {job.budget.type}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Skills Required</dt>
                <dd className="flex flex-wrap gap-1">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {skill}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          {/* Reject Form */}
          {showRejectForm && (
            <div className="rounded-lg border border-red-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-red-900">Rejection Reason</h3>
              <select
                className="mb-2 w-full rounded-lg border p-2"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="">Select reason...</option>
                <option value="contact_info">Contains contact information</option>
                <option value="spam">Spam or duplicate</option>
                <option value="prohibited">Prohibited content</option>
                <option value="misleading">Misleading information</option>
                <option value="other">Other</option>
              </select>
              <textarea
                className="h-20 w-full rounded-lg border p-2 text-sm"
                placeholder="Additional notes..."
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Poster Info */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Posted By</h3>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">{job.poster.name}</p>
              <p className="text-gray-500">{job.poster.email}</p>
              <p className="text-gray-500">
                Joined: {new Date(job.poster.joinedAt).toLocaleDateString()}
              </p>
              <p className="text-gray-500">Jobs Posted: {job.poster.jobsPosted}</p>
              <button className="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                View User Profile
              </button>
            </div>
          </div>

          {/* Similar Jobs */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">Similar Flagged Jobs</h3>
            <ul className="space-y-2">
              {job.similarJobs.map((sj) => (
                <li key={sj.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-700">{sj.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sj.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {sj.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Moderation History */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium text-gray-900">History</h3>
            <ul className="space-y-2">
              {job.moderationHistory.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-gray-900">{h.action}</p>
                  <p className="text-gray-500">
                    by {h.by} • {new Date(h.at).toLocaleString()}
                  </p>
                  {h.reason && <p className="text-gray-600">{h.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <button
          className="text-sm font-medium text-red-600 hover:text-red-700"
          onClick={() => console.log('Suspend poster')}
        >
          Suspend Poster
        </button>
        <div className="flex gap-2">
          {showEditForm ? (
            <>
              <button
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowEditForm(false)}
              >
                Cancel Edit
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                onClick={() => {
                  onAction?.('edit');
                  setShowEditForm(false);
                }}
              >
                Save & Approve
              </button>
            </>
          ) : showRejectForm ? (
            <>
              <button
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => {
                  onAction?.('reject');
                  setShowRejectForm(false);
                }}
              >
                Confirm Rejection
              </button>
            </>
          ) : (
            <>
              <button
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => setShowEditForm(true)}
              >
                Edit & Approve
              </button>
              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => setShowRejectForm(true)}
              >
                Reject
              </button>
              <button
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                onClick={() => onAction?.('approve')}
              >
                Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
