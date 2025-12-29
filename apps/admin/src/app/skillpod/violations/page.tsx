'use client';

import Link from 'next/link';
import { useState } from 'react';

type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';
type ViolationType =
  | 'screen_capture'
  | 'file_access'
  | 'network'
  | 'clipboard'
  | 'suspicious_activity';

interface Violation {
  id: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  tenantId: string;
  tenantName: string;
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
  timestamp: string;
  resolved: boolean;
}

const mockViolations: Violation[] = [
  {
    id: 'v1',
    sessionId: 's2',
    userId: 'u2',
    userEmail: 'sarah@example.com',
    tenantId: 't1',
    tenantName: 'TechCorp',
    type: 'screen_capture',
    severity: 'high',
    description: 'Attempted screen recording detected',
    timestamp: '2024-01-15T09:45:00Z',
    resolved: false,
  },
  {
    id: 'v2',
    sessionId: 's4',
    userId: 'u4',
    userEmail: 'emma@example.com',
    tenantId: 't3',
    tenantName: 'DesignCo',
    type: 'file_access',
    severity: 'critical',
    description: 'Unauthorized file access attempt to /etc/passwd',
    timestamp: '2024-01-15T07:30:00Z',
    resolved: true,
  },
  {
    id: 'v3',
    sessionId: 's4',
    userId: 'u4',
    userEmail: 'emma@example.com',
    tenantId: 't3',
    tenantName: 'DesignCo',
    type: 'network',
    severity: 'medium',
    description: 'Connection attempt to blocked domain',
    timestamp: '2024-01-15T07:35:00Z',
    resolved: true,
  },
  {
    id: 'v4',
    sessionId: 's4',
    userId: 'u4',
    userEmail: 'emma@example.com',
    tenantId: 't3',
    tenantName: 'DesignCo',
    type: 'clipboard',
    severity: 'low',
    description: 'Large clipboard data transfer',
    timestamp: '2024-01-15T07:40:00Z',
    resolved: true,
  },
  {
    id: 'v5',
    sessionId: 's5',
    userId: 'u5',
    userEmail: 'john@example.com',
    tenantId: 't2',
    tenantName: 'StartupXYZ',
    type: 'suspicious_activity',
    severity: 'medium',
    description: 'Unusual file access pattern detected',
    timestamp: '2024-01-14T16:00:00Z',
    resolved: false,
  },
];

const severityColors: Record<ViolationSeverity, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const typeLabels: Record<ViolationType, string> = {
  screen_capture: 'Screen Capture',
  file_access: 'File Access',
  network: 'Network',
  clipboard: 'Clipboard',
  suspicious_activity: 'Suspicious Activity',
};

export default function SkillPodViolationsPage() {
  const [severityFilter, setSeverityFilter] = useState<ViolationSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ViolationType | 'all'>('all');
  const [showResolved, setShowResolved] = useState(false);

  const filteredViolations = mockViolations
    .filter((v) => severityFilter === 'all' || v.severity === severityFilter)
    .filter((v) => typeFilter === 'all' || v.type === typeFilter)
    .filter((v) => showResolved || !v.resolved);

  // Calculate repeat offenders
  const userViolationCounts = mockViolations.reduce(
    (acc, v) => {
      acc[v.userEmail] = (acc[v.userEmail] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const repeatOffenders = Object.entries(userViolationCounts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  // Tenant violation rates
  const tenantStats = mockViolations.reduce(
    (acc, v) => {
      const tenantEntry = acc[v.tenantName] ?? { total: 0, critical: 0 };
      tenantEntry.total++;
      if (v.severity === 'critical') tenantEntry.critical++;
      acc[v.tenantName] = tenantEntry;
      return acc;
    },
    {} as Record<string, { total: number; critical: number }>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Violations</h1>
          <p className="text-gray-600">Platform-wide SkillPod security violations</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Export Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Total Violations</div>
          <div className="text-2xl font-bold text-gray-900">{mockViolations.length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Unresolved</div>
          <div className="text-2xl font-bold text-red-600">
            {mockViolations.filter((v) => !v.resolved).length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Critical</div>
          <div className="text-2xl font-bold text-red-600">
            {mockViolations.filter((v) => v.severity === 'critical').length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Repeat Offenders</div>
          <div className="text-2xl font-bold text-orange-600">{repeatOffenders.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as ViolationSeverity | 'all')}
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ViolationType | 'all')}
            >
              <option value="all">All Types</option>
              <option value="screen_capture">Screen Capture</option>
              <option value="file_access">File Access</option>
              <option value="network">Network</option>
              <option value="clipboard">Clipboard</option>
              <option value="suspicious_activity">Suspicious Activity</option>
            </select>
            <label className="flex items-center gap-2">
              <input
                checked={showResolved}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                type="checkbox"
                onChange={(e) => setShowResolved(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Show resolved</span>
            </label>
          </div>

          {/* Violations List */}
          <div className="space-y-3">
            {filteredViolations.map((violation) => (
              <div
                key={violation.id}
                className={`rounded-lg border bg-white p-4 ${violation.resolved ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[violation.severity]}`}
                      >
                        {violation.severity}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {typeLabels[violation.type]}
                      </span>
                      {violation.resolved && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-gray-900">{violation.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <Link
                        className="text-indigo-600 hover:text-indigo-700"
                        href={`/users/${violation.userId}`}
                      >
                        {violation.userEmail}
                      </Link>
                      <span>•</span>
                      <span>{violation.tenantName}</span>
                      <span>•</span>
                      <span>{new Date(violation.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      View Session
                    </button>
                    {!violation.resolved && (
                      <>
                        <button className="rounded-lg bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-200">
                          Contact Tenant
                        </button>
                        <button className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200">
                          Suspend User
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredViolations.length === 0 && (
            <div className="rounded-lg border bg-white py-12 text-center">
              <p className="text-gray-500">No violations found matching your filters</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Repeat Offenders */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Repeat Offenders</h3>
            {repeatOffenders.length > 0 ? (
              <div className="space-y-2">
                {repeatOffenders.map(([email, count]) => (
                  <div
                    key={email}
                    className="flex items-center justify-between rounded-lg bg-red-50 p-2"
                  >
                    <span className="text-sm text-gray-900">{email}</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {count} violations
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No repeat offenders</p>
            )}
          </div>

          {/* Tenant Stats */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Violations by Tenant</h3>
            <div className="space-y-2">
              {Object.entries(tenantStats).map(([tenant, stats]) => (
                <div key={tenant} className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">{tenant}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{stats.total} total</span>
                    {stats.critical > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {stats.critical} critical
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pattern Detection */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Pattern Detection</h3>
            <div className="space-y-2 text-sm">
              <div className="rounded-lg bg-yellow-50 p-2">
                <p className="font-medium text-yellow-900">Screen capture attempts up 25%</p>
                <p className="text-yellow-700">Last 7 days vs previous period</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <p className="font-medium text-blue-900">Most violations: 2-4 PM UTC</p>
                <p className="text-blue-700">Consider additional monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
