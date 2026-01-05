'use client';

import {
  PlusIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Reference {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  relationship: string;
  status: 'PENDING' | 'REQUESTED' | 'COMPLETED' | 'EXPIRED';
  requestSentAt?: string;
  completedAt?: string;
  rating?: number;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  REPORTED_TO: 'I reported to them',
  PEER: 'Peer / Colleague',
  DIRECT_REPORT: 'They reported to me',
  CLIENT: 'Client',
  BOARD_MEMBER: 'Board Member',
  INVESTOR: 'Investor',
};

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'text-slate-600 bg-slate-100',
    icon: ClockIcon,
  },
  REQUESTED: {
    label: 'Requested',
    color: 'text-amber-600 bg-amber-100',
    icon: EnvelopeIcon,
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-green-600 bg-green-100',
    icon: CheckCircleIcon,
  },
  EXPIRED: {
    label: 'Expired',
    color: 'text-red-600 bg-red-100',
    icon: ExclamationTriangleIcon,
  },
};

interface ReferenceFormData {
  name: string;
  title: string;
  company: string;
  email: string;
  relationship: string;
  yearsKnown: number;
  workedTogetherAt: string;
}

const initialFormData: ReferenceFormData = {
  name: '',
  title: '',
  company: '',
  email: '',
  relationship: '',
  yearsKnown: 2,
  workedTogetherAt: '',
};

export default function ReferencesPage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ReferenceFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiredCount, setRequiredCount] = useState(3);

  const fetchReferences = async () => {
    try {
      const response = await fetch('/api/vetting/references');
      if (!response.ok) throw new Error('Failed to fetch references');
      const data = await response.json();
      setReferences(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, []);

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/vetting/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add reference');
      }

      setFormData(initialFormData);
      setShowForm(false);
      fetchReferences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReference = async (referenceId: string) => {
    try {
      await fetch(`/api/vetting/references/${referenceId}/request`, {
        method: 'POST',
      });
      fetchReferences();
    } catch (err) {
      setError('Failed to send reference request');
    }
  };

  const handleDeleteReference = async (referenceId: string) => {
    if (!confirm('Are you sure you want to remove this reference?')) return;

    try {
      await fetch(`/api/vetting/references/${referenceId}`, {
        method: 'DELETE',
      });
      fetchReferences();
    } catch (err) {
      setError('Failed to delete reference');
    }
  };

  const completedCount = references.filter((r) => r.status === 'COMPLETED').length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

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
          <Link
            className="text-sm text-slate-600 hover:text-indigo-600"
            href="/executive/vetting/status"
          >
            ← Back to Status
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Professional References</h1>
          <p className="mt-1 text-slate-600">
            Add and manage your professional references. We require {requiredCount} verified
            references.
          </p>
        </div>

        {/* Progress Card */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Reference Progress</h2>
              <p className="text-slate-600">
                {completedCount} of {requiredCount} references verified
              </p>
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: requiredCount }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full ${
                    i < completedCount ? 'bg-green-500' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${(completedCount / requiredCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
            <button className="ml-4 underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* References List */}
        <div className="mb-6 space-y-4">
          {references.map((ref) => {
            const statusConfig = STATUS_CONFIG[ref.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={ref.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ref.name}</h3>
                    <p className="text-sm text-slate-600">
                      {ref.title} at {ref.company}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {RELATIONSHIP_LABELS[ref.relationship]} • {ref.email}
                    </p>
                  </div>

                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusConfig.color}`}
                  >
                    <StatusIcon className="h-4 w-4" />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-3 border-t border-slate-100 pt-4">
                  {ref.status === 'PENDING' && (
                    <>
                      <button
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                        onClick={() => handleRequestReference(ref.id)}
                      >
                        <EnvelopeIcon className="h-4 w-4" />
                        Send Request
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={() => handleDeleteReference(ref.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                        Remove
                      </button>
                    </>
                  )}

                  {ref.status === 'REQUESTED' && (
                    <p className="text-sm text-slate-500">
                      Request sent on {new Date(ref.requestSentAt!).toLocaleDateString()}
                    </p>
                  )}

                  {ref.status === 'COMPLETED' && (
                    <p className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircleIcon className="h-5 w-5" />
                      Reference verified • Rating: {ref.rating}/10
                    </p>
                  )}

                  {ref.status === 'EXPIRED' && (
                    <button
                      className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      onClick={() => handleRequestReference(ref.id)}
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Resend Request
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Reference Button/Form */}
        {!showForm ? (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
            onClick={() => setShowForm(true)}
          >
            <PlusIcon className="h-6 w-6" />
            Add Reference
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Reference</h3>

            <form className="space-y-4" onSubmit={handleAddReference}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Full Name *
                  </label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Work Email *
                  </label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="name@company.com"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Company *</label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Relationship *
                  </label>
                  <select
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  >
                    <option value="">Select relationship</option>
                    {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Years Known *
                  </label>
                  <input
                    required
                    className="w-32 rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    max={40}
                    min={1}
                    type="number"
                    value={formData.yearsKnown}
                    onChange={(e) =>
                      setFormData({ ...formData, yearsKnown: Number.parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Where did you work together?
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Company name (optional)"
                  type="text"
                  value={formData.workedTogetherAt}
                  onChange={(e) => setFormData({ ...formData, workedTogetherAt: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? 'Adding...' : 'Add Reference'}
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-6 py-2 text-slate-600 hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData(initialFormData);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 rounded-lg bg-blue-50 p-4">
          <h3 className="font-medium text-blue-800">Tips for Strong References</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-700">
            <li>Choose references who can speak to your leadership abilities</li>
            <li>Former supervisors and board members carry more weight</li>
            <li>Use professional email addresses (no Gmail, Yahoo, etc.)</li>
            <li>Give your references a heads-up before sending requests</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
