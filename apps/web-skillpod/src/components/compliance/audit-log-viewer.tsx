/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Audit Log Viewer Component
 *
 * Real-time audit log viewer with filtering, search,
 * and export capabilities for compliance monitoring.
 *
 * @module components/compliance/audit-log-viewer
 */

import {
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Globe,
  Terminal,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Play,
  Pause,
  X,
} from 'lucide-react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  category:
    | 'authentication'
    | 'authorization'
    | 'data_access'
    | 'configuration'
    | 'security'
    | 'user_action';
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: {
    id: string;
    name: string;
    email: string;
    type: 'user' | 'system' | 'api';
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  details: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'partial';
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  correlationId?: string;
}

interface AuditLogFilters {
  categories: string[];
  severities: string[];
  actors: string[];
  outcomes: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface AuditLogViewerProps {
  logs?: AuditLogEntry[];
  onExport?: (format: 'csv' | 'json' | 'siem') => void;
  realtime?: boolean;
  maxEntries?: number;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG = {
  authentication: { label: 'Authentication', color: 'bg-blue-100 text-blue-700' },
  authorization: { label: 'Authorization', color: 'bg-purple-100 text-purple-700' },
  data_access: { label: 'Data Access', color: 'bg-green-100 text-green-700' },
  configuration: { label: 'Configuration', color: 'bg-yellow-100 text-yellow-700' },
  security: { label: 'Security', color: 'bg-red-100 text-red-700' },
  user_action: { label: 'User Action', color: 'bg-gray-100 text-gray-700' },
};

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500' },
  error: { icon: XCircle, color: 'text-red-500' },
  critical: { icon: AlertTriangle, color: 'text-red-600' },
};

const OUTCOME_CONFIG = {
  success: { icon: CheckCircle, label: 'Success', color: 'text-green-500' },
  failure: { icon: XCircle, label: 'Failure', color: 'text-red-500' },
  partial: { icon: AlertTriangle, label: 'Partial', color: 'text-yellow-500' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatFullTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(date);
}

function generateMockLogs(count: number): AuditLogEntry[] {
  const actions = [
    'user.login',
    'user.logout',
    'user.password_change',
    'data.view',
    'data.export',
    'data.delete',
    'config.update',
    'config.backup',
    'security.alert',
    'security.violation',
    'api.call',
    'session.start',
    'session.end',
  ];

  const categories: AuditLogEntry['category'][] = [
    'authentication',
    'authorization',
    'data_access',
    'configuration',
    'security',
    'user_action',
  ];

  const severities: AuditLogEntry['severity'][] = ['info', 'warning', 'error', 'critical'];
  const outcomes: AuditLogEntry['outcome'][] = ['success', 'failure', 'partial'];

  return Array.from({ length: count }, (_, i) => ({
    id: `log-${Date.now()}-${i}`,
    timestamp: new Date(Date.now() - i * 60000 * Math.random() * 10),
    action: actions[Math.floor(Math.random() * actions.length)],
    category: categories[Math.floor(Math.random() * categories.length)],
    severity:
      Math.random() > 0.8 ? severities[Math.floor(Math.random() * severities.length)] : 'info',
    actor: {
      id: `user-${Math.floor(Math.random() * 100)}`,
      name: ['John Doe', 'Jane Smith', 'Admin User', 'System'][Math.floor(Math.random() * 4)],
      email: `user${Math.floor(Math.random() * 100)}@company.com`,
      type: Math.random() > 0.7 ? 'system' : 'user',
    },
    resource: {
      type: ['pod', 'session', 'user', 'contract', 'recording'][Math.floor(Math.random() * 5)],
      id: `resource-${Math.floor(Math.random() * 1000)}`,
    },
    details: { action: 'performed', timestamp: Date.now() },
    outcome: Math.random() > 0.9 ? 'failure' : 'success',
    ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    sessionId: `session-${Math.floor(Math.random() * 10000)}`,
  }));
}

// ============================================================================
// Sub-Components
// ============================================================================

function LogEntryRow({
  entry,
  isExpanded,
  onToggle,
  onCopy,
}: {
  entry: AuditLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const categoryConfig = CATEGORY_CONFIG[entry.category];
  const severityConfig = SEVERITY_CONFIG[entry.severity];
  const outcomeConfig = OUTCOME_CONFIG[entry.outcome];
  const SeverityIcon = severityConfig.icon;
  const OutcomeIcon = outcomeConfig.icon;

  return (
    <div
      className={`border-b border-gray-100 dark:border-gray-700 ${
        entry.severity === 'critical'
          ? 'bg-red-50 dark:bg-red-900/10'
          : entry.severity === 'error'
            ? 'bg-red-50/50 dark:bg-red-900/5'
            : entry.severity === 'warning'
              ? 'bg-yellow-50/50 dark:bg-yellow-900/5'
              : ''
      }`}
    >
      <button
        className="flex w-full items-center gap-4 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onToggle}
      >
        {/* Severity Icon */}
        <SeverityIcon className={`h-4 w-4 shrink-0 ${severityConfig.color}`} />

        {/* Timestamp */}
        <span className="w-32 shrink-0 font-mono text-xs text-gray-500">
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Category */}
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${categoryConfig.color} w-28 shrink-0 text-center`}
        >
          {categoryConfig.label}
        </span>

        {/* Action */}
        <span className="flex-1 truncate font-mono text-sm text-gray-900 dark:text-white">
          {entry.action}
        </span>

        {/* Actor */}
        <span className="w-32 shrink-0 truncate text-sm text-gray-500">{entry.actor.name}</span>

        {/* Outcome */}
        <OutcomeIcon className={`h-4 w-4 shrink-0 ${outcomeConfig.color}`} />

        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <span className="block text-xs text-gray-500">Full Timestamp</span>
              <span className="font-mono text-sm text-gray-900 dark:text-white">
                {formatFullTimestamp(entry.timestamp)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Actor Type</span>
              <span className="text-sm capitalize text-gray-900 dark:text-white">
                {entry.actor.type}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">IP Address</span>
              <span className="font-mono text-sm text-gray-900 dark:text-white">
                {entry.ip || 'N/A'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Session ID</span>
              <span className="truncate font-mono text-sm text-gray-900 dark:text-white">
                {entry.sessionId || 'N/A'}
              </span>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <span className="block text-xs text-gray-500">Resource</span>
              <span className="text-sm text-gray-900 dark:text-white">
                {entry.resource.type}: {entry.resource.id}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Correlation ID</span>
              <span className="truncate font-mono text-sm text-gray-900 dark:text-white">
                {entry.correlationId || 'N/A'}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="mb-3">
            <span className="mb-1 block text-xs text-gray-500">Details</span>
            <pre className="max-h-40 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
              {JSON.stringify(entry.details, null, 2)}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
            >
              <Copy className="h-3 w-3" />
              Copy JSON
            </button>
            <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700">
              <ExternalLink className="h-3 w-3" />
              View Related
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  filters,
  onFilterChange,
  onClose,
}: {
  filters: AuditLogFilters;
  onFilterChange: (filters: AuditLogFilters) => void;
  onClose: () => void;
}) {
  const toggleCategory = (cat: string) => {
    const newCats = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onFilterChange({ ...filters, categories: newCats });
  };

  const toggleSeverity = (sev: string) => {
    const newSevs = filters.severities.includes(sev)
      ? filters.severities.filter((s) => s !== sev)
      : [...filters.severities, sev];
    onFilterChange({ ...filters, severities: newSevs });
  };

  const toggleOutcome = (out: string) => {
    const newOuts = filters.outcomes.includes(out)
      ? filters.outcomes.filter((o) => o !== out)
      : [...filters.outcomes, out];
    onFilterChange({ ...filters, outcomes: newOuts });
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Categories */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </span>
          <div className="space-y-1">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  checked={filters.categories.includes(key)}
                  className="h-4 w-4 rounded text-blue-600"
                  type="checkbox"
                  onChange={() => toggleCategory(key)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Severities */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Severity
          </span>
          <div className="space-y-1">
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  checked={filters.severities.includes(key)}
                  className="h-4 w-4 rounded text-blue-600"
                  type="checkbox"
                  onChange={() => toggleSeverity(key)}
                />
                <span className="text-sm capitalize text-gray-700 dark:text-gray-300">{key}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Outcomes */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Outcome
          </span>
          <div className="space-y-1">
            {Object.entries(OUTCOME_CONFIG).map(([key, config]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  checked={filters.outcomes.includes(key)}
                  className="h-4 w-4 rounded text-blue-600"
                  type="checkbox"
                  onChange={() => toggleOutcome(key)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range
          </span>
          <div className="space-y-2">
            <input
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
              type="datetime-local"
              value={filters.dateRange.start?.toISOString().slice(0, 16) || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    start: e.target.value ? new Date(e.target.value) : null,
                  },
                })
              }
            />
            <input
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
              type="datetime-local"
              value={filters.dateRange.end?.toISOString().slice(0, 16) || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    end: e.target.value ? new Date(e.target.value) : null,
                  },
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AuditLogViewer({
  logs: propLogs,
  onExport,
  realtime = true,
  maxEntries = 1000,
}: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(propLogs || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({
    categories: [],
    severities: [],
    actors: [],
    outcomes: [],
    dateRange: { start: null, end: null },
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [isLive, setIsLive] = useState(realtime);
  const [isLoading, setIsLoading] = useState(!propLogs);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial logs if none provided
  useEffect(() => {
    if (!propLogs) {
      setIsLoading(true);
      setTimeout(() => {
        setLogs(generateMockLogs(50));
        setIsLoading(false);
      }, 500);
    }
  }, [propLogs]);

  // Simulate real-time updates
  useEffect(() => {
    if (!isLive) return undefined;

    const interval = setInterval(() => {
      const newLog = generateMockLogs(1)[0];
      setLogs((prev) => [newLog, ...prev].slice(0, maxEntries));
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive, maxEntries]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !log.action.toLowerCase().includes(query) &&
          !log.actor.name.toLowerCase().includes(query) &&
          !log.actor.email.toLowerCase().includes(query) &&
          !JSON.stringify(log.details).toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(log.category)) {
        return false;
      }

      // Severity filter
      if (filters.severities.length > 0 && !filters.severities.includes(log.severity)) {
        return false;
      }

      // Outcome filter
      if (filters.outcomes.length > 0 && !filters.outcomes.includes(log.outcome)) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start && log.timestamp < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && log.timestamp > filters.dateRange.end) {
        return false;
      }

      return true;
    });
  }, [logs, searchQuery, filters]);

  const toggleLogExpansion = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const copyLogToClipboard = (log: AuditLogEntry) => {
    void navigator.clipboard.writeText(JSON.stringify(log, null, 2));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setLogs(generateMockLogs(50));
      setIsLoading(false);
    }, 500);
  };

  const activeFiltersCount =
    filters.categories.length +
    filters.severities.length +
    filters.outcomes.length +
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="font-medium text-gray-900 dark:text-white">Audit Log</h2>
          <span className="text-sm text-gray-500">{filteredLogs.length} entries</span>
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${
              isLive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isLive ? 'Pause' : 'Resume'}
          </button>
          <button
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={isLoading}
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-4 w-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {onExport && (
            <button
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              onClick={() => onExport('json')}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="Search actions, actors, or details..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            showFilters || activeFiltersCount > 0
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
              : 'border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onClose={() => setShowFilters(false)}
          onFilterChange={setFilters}
        />
      )}

      {/* Log Entries */}
      <div ref={containerRef} className="max-h-[600px] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <Terminal className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-gray-500">No log entries match your criteria</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <LogEntryRow
              key={log.id}
              entry={log}
              isExpanded={expandedLogs.has(log.id)}
              onCopy={() => copyLogToClipboard(log)}
              onToggle={() => toggleLogExpansion(log.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
        <span className="text-xs text-gray-500">
          Showing {filteredLogs.length} of {logs.length} entries
        </span>
        <span className="text-xs text-gray-500">Max retention: {maxEntries} entries</span>
      </div>
    </div>
  );
}
