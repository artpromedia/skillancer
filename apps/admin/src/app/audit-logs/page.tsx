'use client';

import { useCallback, useState } from 'react';
import { useAuditLogs, useAuditLog } from '../../hooks/api/use-audit';

// =============================================================================
// Types
// =============================================================================

interface AuditLogEntry {
  id: string;
  action: string;
  actionType?: string;
  actor?: {
    id: string;
    name: string;
    email?: string;
  };
  actorId?: string;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: string;
  createdAt: string;
}

// =============================================================================
// Constants
// =============================================================================

const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'user.create', label: 'User Created' },
  { value: 'user.update', label: 'User Updated' },
  { value: 'user.suspend', label: 'User Suspended' },
  { value: 'user.ban', label: 'User Banned' },
  { value: 'user.delete', label: 'User Deleted' },
  { value: 'moderation.approve', label: 'Content Approved' },
  { value: 'moderation.reject', label: 'Content Rejected' },
  { value: 'dispute.resolve', label: 'Dispute Resolved' },
  { value: 'dispute.escalate', label: 'Dispute Escalated' },
  { value: 'payment.refund', label: 'Payment Refunded' },
  { value: 'payment.cancel', label: 'Payment Cancelled' },
  { value: 'settings.update', label: 'Settings Updated' },
  { value: 'admin.login', label: 'Admin Login' },
  { value: 'admin.impersonate', label: 'User Impersonated' },
];

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

// =============================================================================
// Helper: Export CSV
// =============================================================================

function exportToCSV(logs: AuditLogEntry[]) {
  const headers = ['Timestamp', 'Actor', 'Action', 'Target Type', 'Target', 'Details', 'IP Address', 'Severity'];
  const rows = logs.map((log) => [
    log.createdAt ? new Date(log.createdAt).toISOString() : '',
    log.actor?.name || log.actorName || '',
    log.action || log.actionType || '',
    log.targetType || '',
    log.targetName || log.targetId || '',
    log.details || '',
    log.ipAddress || '',
    log.severity || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// =============================================================================
// Detail Panel Component
// =============================================================================

function AuditLogDetailPanel({
  logId,
  onClose,
}: Readonly<{
  logId: string;
  onClose: () => void;
}>) {
  const { data: logData, isLoading } = useAuditLog(logId);
  const log = logData?.data as AuditLogEntry | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close detail panel"
        className="fixed inset-0 cursor-default border-0 bg-black/50"
        type="button"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Audit Log Details</h2>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        )}

        {!isLoading && log && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Timestamp</label>
                <p className="text-sm text-gray-900">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Action</label>
                <p className="text-sm text-gray-900">{log.action || log.actionType}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Actor</label>
                <p className="text-sm text-gray-900">
                  {log.actor?.name || log.actorName || 'System'}
                </p>
                {(log.actor?.email) && (
                  <p className="text-xs text-gray-500">{log.actor.email}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Target</label>
                <p className="text-sm text-gray-900">
                  {log.targetType ? `${log.targetType}: ` : ''}
                  {log.targetName || log.targetId || '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">IP Address</label>
                <p className="font-mono text-sm text-gray-900">{log.ipAddress || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Severity</label>
                <p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[log.severity || ''] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {log.severity || 'info'}
                  </span>
                </p>
              </div>
            </div>

            {log.details && (
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Details</label>
                <p className="mt-1 text-sm text-gray-900">{log.details}</p>
              </div>
            )}

            {log.userAgent && (
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">User Agent</label>
                <p className="mt-1 break-all font-mono text-xs text-gray-600">{log.userAgent}</p>
              </div>
            )}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <label className="text-xs font-medium uppercase text-gray-500">Metadata</label>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {!isLoading && !log && (
          <div className="py-8 text-center text-gray-500">
            Audit log entry not found
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function AuditLogsPage() {
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const filters: Record<string, unknown> = { page, limit: 25 };
  if (actionTypeFilter) filters.actionType = actionTypeFilter;
  if (actorFilter) filters.actorId = actorFilter;
  if (searchQuery) filters.search = searchQuery;
  if (dateFrom) filters.createdAfter = dateFrom;
  if (dateTo) filters.createdBefore = dateTo;

  const { data: logsData, isLoading, error } = useAuditLogs(filters as never);

  const logs: AuditLogEntry[] = (logsData?.data as AuditLogEntry[]) ?? [];
  const totalCount = logsData?.total ?? 0;
  const totalPages = logsData?.totalPages ?? 1;

  const handleExport = useCallback(() => {
    if (logs.length > 0) {
      exportToCSV(logs);
    }
  }, [logs]);

  const handleResetFilters = () => {
    setActionTypeFilter('');
    setActorFilter('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = actionTypeFilter || actorFilter || searchQuery || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600">Track all administrative actions and system events</p>
        </div>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={logs.length === 0}
          onClick={handleExport}
        >
          Export to CSV
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Search Entity
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Search by target name or ID..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Action Type Filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Action Type</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={actionTypeFilter}
              onChange={(e) => {
                setActionTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Actor</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Filter by admin name or ID..."
              type="text"
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Date From */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">From Date</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">To Date</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {totalCount} result{totalCount !== 1 ? 's' : ''} found
            </p>
            <button
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              onClick={handleResetFilters}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center rounded-lg border bg-white py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <span className="ml-3 text-gray-500">Loading audit logs...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-800">Failed to load audit logs</p>
          <p className="mt-1 text-sm text-red-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      )}

      {/* Audit Logs Table */}
      {!isLoading && !error && logs.length > 0 && (
        <div className="rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Affected Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Details
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {log.actor?.name || log.actorName || 'System'}
                      </div>
                      {log.actor?.email && (
                        <div className="text-xs text-gray-500">{log.actor.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                        {log.action || log.actionType || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {log.targetType && (
                        <span className="mr-1 text-xs text-gray-400">[{log.targetType}]</span>
                      )}
                      {log.targetName || log.targetId || '-'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-500">
                      {log.details || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[log.severity || ''] || 'bg-gray-100 text-gray-800'}`}
                      >
                        {log.severity || 'info'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        onClick={() => setSelectedLogId(log.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-gray-500">
              Showing page {page} of {totalPages} ({totalCount} total entries)
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && logs.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900">No audit logs found</p>
          <p className="mt-1 text-gray-500">
            {hasActiveFilters
              ? 'Try adjusting your filters to find what you are looking for'
              : 'Audit logs will appear here as admin actions are performed'}
          </p>
        </div>
      )}

      {/* Detail Panel */}
      {selectedLogId && (
        <AuditLogDetailPanel
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </div>
  );
}
