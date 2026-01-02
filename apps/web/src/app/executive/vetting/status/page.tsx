'use client';

import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  VideoCameraIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Vetting stages in order
const VETTING_STAGES = [
  {
    id: 'APPLICATION',
    name: 'Application Submitted',
    description: 'Your application is in the queue',
    icon: DocumentTextIcon,
  },
  {
    id: 'AUTOMATED_SCREENING',
    name: 'Automated Screening',
    description: 'AI analysis of your profile',
    icon: SparklesIcon,
  },
  {
    id: 'INTERVIEW_SCHEDULED',
    name: 'Interview Scheduled',
    description: 'Video interview with our team',
    icon: VideoCameraIcon,
  },
  {
    id: 'INTERVIEW_COMPLETED',
    name: 'Interview Complete',
    description: 'Interview evaluation in progress',
    icon: VideoCameraIcon,
  },
  {
    id: 'REFERENCE_CHECK',
    name: 'Reference Check',
    description: 'Verifying your professional references',
    icon: UserGroupIcon,
  },
  {
    id: 'BACKGROUND_CHECK',
    name: 'Background Check',
    description: 'Background verification via Checkr',
    icon: ShieldCheckIcon,
  },
  {
    id: 'FINAL_REVIEW',
    name: 'Final Review',
    description: 'Executive committee review',
    icon: CheckCircleIcon,
  },
  {
    id: 'COMPLETE',
    name: 'Approved!',
    description: 'Welcome to the network',
    icon: CheckCircleSolid,
  },
];

interface VettingDetails {
  vettingStatus: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  vettingStage: string;
  vettingScore: number | null;
  submittedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  reapplyAfter: string | null;
  referencesRequired: number;
  referencesVerified: number;
  backgroundCheckStatus: string;
  linkedinVerified: boolean;
  interviews: Array<{
    id: string;
    type: string;
    scheduledAt: string;
    status: string;
    meetingLink?: string;
  }>;
  references: Array<{
    id: string;
    name: string;
    company: string;
    status: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
  }>;
}

export default function VettingStatusPage() {
  const [details, setDetails] = useState<VettingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    try {
      const response = await fetch('/api/vetting/status');
      if (!response.ok) {
        if (response.status === 404) {
          setError('No executive profile found. Please apply first.');
          return;
        }
        throw new Error('Failed to fetch vetting status');
      }
      const data = await response.json();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // Poll every 30 seconds
    const interval = setInterval(fetchDetails, 30000);
    return () => clearInterval(interval);
  }, []);

  const getCurrentStageIndex = () => {
    if (!details) return -1;
    return VETTING_STAGES.findIndex((s) => s.id === details.vettingStage);
  };

  const getStatusBadge = () => {
    if (!details) return null;

    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'In Progress' },
      IN_REVIEW: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Under Review' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Not Approved' },
      WITHDRAWN: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Withdrawn' },
    };

    const badge = badges[details.vettingStatus] ?? {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: 'Unknown',
    };
    return (
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <ArrowPathIcon className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-2 text-slate-600">Loading your vetting status...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <XCircleIcon className="mx-auto h-16 w-16 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-slate-900">
            {error || 'Unable to load status'}
          </h2>
          <div className="mt-4 flex justify-center gap-4">
            <Link
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              href="/executive/apply"
            >
              Apply Now
            </Link>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <span className="text-xl font-semibold text-slate-900">Skillancer</span>
          </Link>
          <Link className="text-sm text-slate-600 hover:text-indigo-600" href="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Status Header */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Vetting Status</h1>
              <p className="mt-1 text-slate-600">
                Track your progress through our executive vetting process
              </p>
            </div>
            {getStatusBadge()}
          </div>

          {details.vettingStatus === 'APPROVED' && (
            <div className="mt-6 rounded-lg bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircleSolid className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">Congratulations!</h3>
                  <p className="text-sm text-green-700">
                    You&apos;ve been approved to join our elite executive network. Your profile is
                    now visible to clients.
                  </p>
                </div>
              </div>
              <Link
                className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                href="/executive/profile"
              >
                Complete Your Profile
              </Link>
            </div>
          )}

          {details.vettingStatus === 'REJECTED' && (
            <div className="mt-6 rounded-lg bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <XCircleIcon className="h-8 w-8 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800">Application Not Approved</h3>
                  <p className="text-sm text-red-700">
                    Unfortunately, we&apos;re unable to move forward with your application at this
                    time.
                    {details.reapplyAfter && (
                      <>
                        {' '}
                        You may reapply after {new Date(details.reapplyAfter).toLocaleDateString()}.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Timeline */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Vetting Progress</h2>

          <div className="relative">
            {VETTING_STAGES.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isPending = index > currentStageIndex;

              return (
                <div key={stage.id} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* Line */}
                  {index < VETTING_STAGES.length - 1 && (
                    <div
                      className={`absolute left-5 top-10 h-full w-0.5 ${
                        isComplete ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                      isComplete
                        ? 'bg-indigo-600 text-white'
                        : isCurrent
                          ? 'border-2 border-indigo-600 bg-white text-indigo-600'
                          : 'border-2 border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircleSolid className="h-6 w-6" />
                    ) : (
                      <stage.icon className="h-5 w-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <h3
                      className={`font-medium ${
                        isCurrent
                          ? 'text-indigo-600'
                          : isComplete
                            ? 'text-slate-900'
                            : 'text-slate-400'
                      }`}
                    >
                      {stage.name}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center gap-1 text-sm">
                          <ClockIcon className="h-4 w-4" />
                          In Progress
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">{stage.description}</p>

                    {/* Stage-specific content */}
                    {isCurrent && stage.id === 'INTERVIEW_SCHEDULED' && details.interviews[0] && (
                      <div className="mt-3 rounded-lg bg-indigo-50 p-3">
                        <p className="text-sm font-medium text-indigo-800">
                          Scheduled: {new Date(details.interviews[0].scheduledAt).toLocaleString()}
                        </p>
                        {details.interviews[0].meetingLink && (
                          <a
                            className="mt-2 inline-block rounded-lg bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700"
                            href={details.interviews[0].meetingLink}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    )}

                    {isCurrent && stage.id === 'REFERENCE_CHECK' && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <p className="text-sm text-slate-700">
                          {details.referencesVerified} of {details.referencesRequired} references
                          completed
                        </p>
                        <Link
                          className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
                          href="/executive/vetting/references"
                        >
                          Manage References →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent Activity</h2>

          {details.events.length === 0 ? (
            <p className="text-slate-500">No activity yet</p>
          ) : (
            <ul className="space-y-4">
              {details.events.slice(0, 10).map((event) => (
                <li
                  key={event.id}
                  className="flex gap-3 border-b border-slate-100 pb-4 last:border-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                    <ClockIcon className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{event.description}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        {details.vettingStatus === 'PENDING' && (
          <div className="mt-6 flex justify-end">
            <button
              className="text-sm text-red-600 hover:text-red-500"
              onClick={() => {
                if (confirm('Are you sure you want to withdraw your application?')) {
                  fetch('/api/vetting/withdraw', { method: 'POST' }).then(() =>
                    window.location.reload()
                  );
                }
              }}
            >
              Withdraw Application
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
