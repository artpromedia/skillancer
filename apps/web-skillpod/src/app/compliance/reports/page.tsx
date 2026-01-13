/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Compliance Reports List Page
 *
 * List of generated compliance reports with filtering,
 * scheduling, and export capabilities.
 *
 * @module app/compliance/reports/page
 */

import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  Check,
  AlertTriangle,
  Loader2,
  MoreVertical,
  Eye,
  Trash2,
  RefreshCw,
  Mail,
  Share2,
  ChevronDown,
  Shield,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ComplianceReport {
  id: string;
  name: string;
  type: 'soc2' | 'hipaa' | 'gdpr' | 'pci' | 'custom';
  status: 'completed' | 'generating' | 'scheduled' | 'failed';
  createdAt: Date;
  generatedAt?: Date;
  scheduledFor?: Date;
  period: {
    start: Date;
    end: Date;
  };
  createdBy: string;
  fileSize?: number;
  downloadUrl?: string;
  summary?: {
    score: number;
    findings: number;
    recommendations: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const REPORT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  soc2: {
    label: 'SOC 2',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  hipaa: {
    label: 'HIPAA',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  gdpr: {
    label: 'GDPR',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  pci: {
    label: 'PCI DSS',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  custom: {
    label: 'Custom',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Check; color: string }> = {
  completed: { label: 'Completed', icon: Check, color: 'text-green-600' },
  generating: { label: 'Generating', icon: Loader2, color: 'text-blue-600' },
  scheduled: { label: 'Scheduled', icon: Clock, color: 'text-yellow-600' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'text-red-600' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPeriod(start: Date, end: Date): string {
  const startStr = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    start
  );
  const endStr = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(end);
  return `${startStr} - ${endStr}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function ReportCard({
  report,
  onView,
  onDownload,
  onDelete,
  onRetry,
  onShare,
}: {
  report: ComplianceReport;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onShare: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const typeConfig = REPORT_TYPE_CONFIG[report.type];
  const statusConfig = STATUS_CONFIG[report.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-700">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{report.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeConfig.color}`}>
                {typeConfig.label}
              </span>
              <span className="text-xs text-gray-500">
                {formatPeriod(report.period.start, report.period.end)}
              </span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </button>

          {showMenu && (
            <>
              <div
                aria-hidden="true"
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {report.status === 'completed' && (
                  <>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={() => {
                        onView();
                        setShowMenu(false);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Report
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={() => {
                        onDownload();
                        setShowMenu(false);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={() => {
                        onShare();
                        setShowMenu(false);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  </>
                )}
                {report.status === 'failed' && (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    onClick={() => {
                      onRetry();
                      setShowMenu(false);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                )}
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="mb-3 flex items-center gap-2">
        <StatusIcon
          className={`h-4 w-4 ${statusConfig.color} ${report.status === 'generating' ? 'animate-spin' : ''}`}
        />
        <span className={`text-sm ${statusConfig.color}`}>{statusConfig.label}</span>
        {report.status === 'scheduled' && report.scheduledFor && (
          <span className="text-xs text-gray-500">for {formatDateTime(report.scheduledFor)}</span>
        )}
      </div>

      {/* Summary (for completed reports) */}
      {report.status === 'completed' && report.summary && (
        <div className="mb-3 flex items-center gap-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
          <div className="text-center">
            <div
              className={`text-lg font-bold ${
                report.summary.score >= 90
                  ? 'text-green-600'
                  : report.summary.score >= 70
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {report.summary.score}%
            </div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {report.summary.findings}
            </div>
            <div className="text-xs text-gray-500">Findings</div>
          </div>
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {report.summary.recommendations}
            </div>
            <div className="text-xs text-gray-500">Recommendations</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>By {report.createdBy}</span>
        <div className="flex items-center gap-2">
          {report.fileSize && <span>{formatFileSize(report.fileSize)}</span>}
          <span>{formatDate(report.createdAt)}</span>
        </div>
      </div>

      {/* Quick Actions */}
      {report.status === 'completed' && (
        <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
            View
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
            onClick={onDownload}
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      )}
    </div>
  );
}

interface FilterState {
  type: string[];
  status: string[];
  dateRange: { start: Date | null; end: Date | null };
}

function FilterPanel({
  filters,
  onFilterChange,
  onClose,
}: {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClose: () => void;
}) {
  const toggleType = (type: string) => {
    const newTypes = filters.type.includes(type)
      ? filters.type.filter((t) => t !== type)
      : [...filters.type, type];
    onFilterChange({ ...filters, type: newTypes });
  };

  const toggleStatus = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onFilterChange({ ...filters, status: newStatus });
  };

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Report Type */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Report Type
          </span>
          <div className="space-y-2">
            {Object.entries(REPORT_TYPE_CONFIG).map(([type, config]) => (
              <label key={type} className="flex cursor-pointer items-center gap-2">
                <input
                  checked={filters.type.includes(type)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  type="checkbox"
                  onChange={() => toggleType(type)}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </span>
          <div className="space-y-2">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <label key={status} className="flex cursor-pointer items-center gap-2">
                <input
                  checked={filters.status.includes(status)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  type="checkbox"
                  onChange={() => toggleStatus(status)}
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              type="date"
              value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              type="date"
              value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
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

export default function ComplianceReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: [] as string[],
    status: [] as string[],
    dateRange: { start: null as Date | null, end: null as Date | null },
  });

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Mock reports
        setReports([
          {
            id: 'rpt-1',
            name: 'Q4 2024 SOC 2 Compliance Report',
            type: 'soc2',
            status: 'completed',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            period: {
              start: new Date('2024-10-01'),
              end: new Date('2024-12-31'),
            },
            createdBy: 'compliance@company.com',
            fileSize: 2.5 * 1024 * 1024,
            summary: { score: 94, findings: 3, recommendations: 8 },
          },
          {
            id: 'rpt-2',
            name: 'Annual HIPAA Assessment',
            type: 'hipaa',
            status: 'completed',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            period: {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            },
            createdBy: 'admin@company.com',
            fileSize: 4.1 * 1024 * 1024,
            summary: { score: 91, findings: 5, recommendations: 12 },
          },
          {
            id: 'rpt-3',
            name: 'GDPR Data Processing Report',
            type: 'gdpr',
            status: 'generating',
            createdAt: new Date(),
            period: {
              start: new Date('2024-01-01'),
              end: new Date('2024-12-31'),
            },
            createdBy: 'dpo@company.com',
          },
          {
            id: 'rpt-4',
            name: 'Monthly PCI DSS Scan Report',
            type: 'pci',
            status: 'scheduled',
            createdAt: new Date(),
            scheduledFor: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            period: {
              start: new Date('2024-12-01'),
              end: new Date('2024-12-31'),
            },
            createdBy: 'security@company.com',
          },
          {
            id: 'rpt-5',
            name: 'Custom Audit Report - User Access',
            type: 'custom',
            status: 'failed',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            period: {
              start: new Date('2024-11-01'),
              end: new Date('2024-11-30'),
            },
            createdBy: 'admin@company.com',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !report.name.toLowerCase().includes(query) &&
          !report.createdBy.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Type filter
      if (filters.type.length > 0 && !filters.type.includes(report.type)) {
        return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(report.status)) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start && report.createdAt < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && report.createdAt > filters.dateRange.end) {
        return false;
      }

      return true;
    });
  }, [reports, searchQuery, filters]);

  const handleViewReport = (report: ComplianceReport) => {
    router.push(`/compliance/reports/${report.id}`);
  };

  const handleDownloadReport = (_report: ComplianceReport) => {
    // Feature: Download report as PDF - not yet implemented
  };

  const handleDeleteReport = (report: ComplianceReport) => {
    if (confirm('Are you sure you want to delete this report?')) {
      setReports(reports.filter((r) => r.id !== report.id));
    }
  };

  const handleRetryReport = (report: ComplianceReport) => {
    setReports(
      reports.map((r) => (r.id === report.id ? { ...r, status: 'generating' as const } : r))
    );
  };

  const handleShareReport = (_report: ComplianceReport) => {
    // Feature: Share report with stakeholders - not yet implemented
  };

  const activeFiltersCount =
    filters.type.length +
    filters.status.length +
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Compliance Reports
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Generate and manage compliance reports for audits
              </p>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={() => router.push('/compliance/reports/new')}
            >
              <Plus className="h-4 w-4" />
              New Report
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Search and Filters */}
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Search reports..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
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

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
              No reports found
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              {searchQuery || activeFiltersCount > 0
                ? 'Try adjusting your search or filters'
                : 'Create your first compliance report'}
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={() => router.push('/compliance/reports/new')}
            >
              <Plus className="h-4 w-4" />
              Create Report
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onDelete={() => handleDeleteReport(report)}
                onDownload={() => handleDownloadReport(report)}
                onRetry={() => handleRetryReport(report)}
                onShare={() => handleShareReport(report)}
                onView={() => handleViewReport(report)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
