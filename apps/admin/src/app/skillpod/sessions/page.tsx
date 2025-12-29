'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Session {
  id: string;
  userId: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
  status: 'active' | 'ended' | 'terminated';
  startedAt: string;
  endedAt?: string;
  duration: string;
  violationCount: number;
  hasRecording: boolean;
}

const mockSessions: Session[] = [
  {
    id: 's1',
    userId: 'u1',
    userEmail: 'alex@example.com',
    tenantId: 't1',
    tenantName: 'TechCorp',
    status: 'active',
    startedAt: '2024-01-15T08:00:00Z',
    duration: '2h 15m',
    violationCount: 0,
    hasRecording: true,
  },
  {
    id: 's2',
    userId: 'u2',
    userEmail: 'sarah@example.com',
    tenantId: 't1',
    tenantName: 'TechCorp',
    status: 'active',
    startedAt: '2024-01-15T09:30:00Z',
    duration: '45m',
    violationCount: 1,
    hasRecording: true,
  },
  {
    id: 's3',
    userId: 'u3',
    userEmail: 'mike@example.com',
    tenantId: 't2',
    tenantName: 'StartupXYZ',
    status: 'ended',
    startedAt: '2024-01-15T06:00:00Z',
    endedAt: '2024-01-15T10:00:00Z',
    duration: '4h',
    violationCount: 0,
    hasRecording: true,
  },
  {
    id: 's4',
    userId: 'u4',
    userEmail: 'emma@example.com',
    tenantId: 't3',
    tenantName: 'DesignCo',
    status: 'terminated',
    startedAt: '2024-01-15T07:00:00Z',
    endedAt: '2024-01-15T07:45:00Z',
    duration: '45m',
    violationCount: 3,
    hasRecording: true,
  },
];

export default function SkillPodSessionsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended' | 'terminated'>(
    'all'
  );
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = mockSessions
    .filter((s) => statusFilter === 'all' || s.status === statusFilter)
    .filter((s) => !violationsOnly || s.violationCount > 0)
    .filter(
      (s) =>
        searchQuery === '' ||
        s.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tenantName.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
      terminated: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleKillSession = (sessionId: string) => {
    console.log('Killing session:', sessionId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SkillPod Sessions</h1>
          <p className="text-gray-600">Monitor all active and past workspace sessions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Active Sessions</div>
          <div className="text-2xl font-bold text-green-600">
            {mockSessions.filter((s) => s.status === 'active').length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Ended Today</div>
          <div className="text-2xl font-bold text-gray-900">
            {mockSessions.filter((s) => s.status === 'ended').length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Terminated</div>
          <div className="text-2xl font-bold text-red-600">
            {mockSessions.filter((s) => s.status === 'terminated').length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">With Violations</div>
          <div className="text-2xl font-bold text-orange-600">
            {mockSessions.filter((s) => s.violationCount > 0).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
        <div className="flex-1">
          <input
            className="w-full rounded-lg border px-4 py-2 text-sm"
            placeholder="Search by user email or tenant..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'active' | 'ended' | 'terminated')
          }
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
          <option value="terminated">Terminated</option>
        </select>
        <label className="flex items-center gap-2">
          <input
            checked={violationsOnly}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
            type="checkbox"
            onChange={(e) => setViolationsOnly(e.target.checked)}
          />
          <span className="text-sm text-gray-700">With violations only</span>
        </label>
      </div>

      {/* Sessions Table */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Session
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Tenant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Violations
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredSessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-gray-900">{session.id}</span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                    href={`/users/${session.userId}`}
                  >
                    {session.userEmail}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{session.tenantName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getStatusColor(session.status)}`}
                  >
                    {session.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{session.duration}</td>
                <td className="px-4 py-3">
                  {session.violationCount > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                      {session.violationCount} violations
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {session.hasRecording && (
                      <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        Recording
                      </button>
                    )}
                    {session.status === 'active' && (
                      <button
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                        onClick={() => handleKillSession(session.id)}
                      >
                        Kill
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSessions.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <p className="text-gray-500">No sessions found matching your filters</p>
        </div>
      )}
    </div>
  );
}
