'use client';

import { useState } from 'react';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  segments: string[];
  createdAt: string;
  updatedAt: string;
}

const mockFlags: FeatureFlag[] = [
  {
    id: 'f1',
    name: 'new_onboarding_flow',
    description: 'Enable the redesigned onboarding experience',
    enabled: true,
    rolloutPercentage: 100,
    segments: ['all'],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-10',
  },
  {
    id: 'f2',
    name: 'ai_job_matching',
    description: 'Use AI for job-freelancer matching',
    enabled: true,
    rolloutPercentage: 50,
    segments: ['verified_freelancers'],
    createdAt: '2023-12-15',
    updatedAt: '2024-01-12',
  },
  {
    id: 'f3',
    name: 'skillpod_v2',
    description: 'New SkillPod session experience',
    enabled: false,
    rolloutPercentage: 0,
    segments: [],
    createdAt: '2024-01-08',
    updatedAt: '2024-01-08',
  },
  {
    id: 'f4',
    name: 'instant_payouts',
    description: 'Allow instant payouts for verified freelancers',
    enabled: true,
    rolloutPercentage: 25,
    segments: ['verified_freelancers', 'premium'],
    createdAt: '2023-11-20',
    updatedAt: '2024-01-14',
  },
  {
    id: 'f5',
    name: 'dark_mode',
    description: 'Enable dark mode theme option',
    enabled: true,
    rolloutPercentage: 100,
    segments: ['all'],
    createdAt: '2023-10-01',
    updatedAt: '2023-10-01',
  },
];

const segmentOptions = [
  'all',
  'verified_freelancers',
  'verified_clients',
  'premium',
  'enterprise',
  'beta_testers',
];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(mockFlags);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const toggleFlag = (flagId: string) => {
    setFlags((prev) =>
      prev.map((f) =>
        f.id === flagId
          ? { ...f, enabled: !f.enabled, updatedAt: new Date().toISOString().split('T')[0] ?? '' }
          : f
      )
    );
  };

  const updateRollout = (flagId: string, percentage: number) => {
    setFlags((prev) =>
      prev.map((f) =>
        f.id === flagId
          ? {
              ...f,
              rolloutPercentage: percentage,
              updatedAt: new Date().toISOString().split('T')[0] ?? '',
            }
          : f
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-gray-600">Manage feature rollouts and experiments</p>
        </div>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={() => setShowCreateForm(true)}
        >
          Create Flag
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Total Flags</div>
          <div className="text-2xl font-bold text-gray-900">{flags.length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Enabled</div>
          <div className="text-2xl font-bold text-green-600">
            {flags.filter((f) => f.enabled).length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Partial Rollout</div>
          <div className="text-2xl font-bold text-yellow-600">
            {flags.filter((f) => f.enabled && f.rolloutPercentage < 100).length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Disabled</div>
          <div className="text-2xl font-bold text-gray-600">
            {flags.filter((f) => !f.enabled).length}
          </div>
        </div>
      </div>

      {/* Flags List */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Flag
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Rollout
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Segments
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Updated
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {flags.map((flag) => (
              <tr key={flag.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-900">{flag.name}</p>
                    <p className="text-sm text-gray-500">{flag.description}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      flag.enabled ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                    onClick={() => toggleFlag(flag.id)}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        flag.enabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="w-24"
                      disabled={!flag.enabled}
                      max={100}
                      min={0}
                      type="range"
                      value={flag.rolloutPercentage}
                      onChange={(e) => updateRollout(flag.id, Number(e.target.value))}
                    />
                    <span className="text-sm text-gray-700">{flag.rolloutPercentage}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {flag.segments.map((segment) => (
                      <span
                        key={segment}
                        className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
                      >
                        {segment}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{flag.updatedAt}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    onClick={() => setEditingFlag(flag)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Edit Feature Flag</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setEditingFlag(null)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  readOnly
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 font-mono text-sm"
                  type="text"
                  value={editingFlag.name}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="h-20 w-full rounded-lg border px-3 py-2 text-sm"
                  value={editingFlag.description}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  User Segments
                </label>
                <div className="flex flex-wrap gap-2">
                  {segmentOptions.map((segment) => (
                    <button
                      key={segment}
                      className={`rounded-full px-3 py-1 text-sm ${
                        editingFlag.segments.includes(segment)
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {segment}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setEditingFlag(null)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  onClick={() => setEditingFlag(null)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Create Feature Flag</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowCreateForm(false)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
                  placeholder="e.g., new_feature_v2"
                  type="text"
                />
                <p className="mt-1 text-xs text-gray-500">Use snake_case naming convention</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="h-20 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Describe what this flag controls..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  onClick={() => setShowCreateForm(false)}
                >
                  Create Flag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
