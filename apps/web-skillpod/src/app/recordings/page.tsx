/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Recordings Library Page
 *
 * Lists all session recordings with comprehensive filtering,
 * bulk actions, and storage management.
 *
 * @module app/recordings/page
 */

import {
  Search,
  Filter,
  FileText,
  Download,
  Trash2,
  Share2,
  HardDrive,
  Clock,
  ChevronDown,
  X,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { RecordingCard } from '@/components/recordings/recording-card';

// ============================================================================
// Types
// ============================================================================

interface Recording {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  podId: string;
  podName: string;
  templateName: string;
  contractId?: string;
  contractName?: string;
  projectId?: string;
  projectName?: string;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  thumbnailUrl?: string;
  videoUrl: string;
  fileSize: number; // bytes
  violations: ViolationSummary[];
  events: EventSummary;
  retentionPolicy: RetentionPolicy;
  status: 'processing' | 'ready' | 'archived' | 'pending_deletion';
}

interface ViolationSummary {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
}

interface EventSummary {
  fileTransfers: number;
  clipboardEvents: number;
  keystrokes: number;
  screenshots: number;
}

interface RetentionPolicy {
  id: string;
  name: string;
  retentionDays: number;
  expiresAt: Date;
  isOnHold: boolean;
  holdReason?: string;
}

interface RecordingFilters {
  search: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  userId: string | null;
  podId: string | null;
  templateId: string | null;
  contractId: string | null;
  projectId: string | null;
  hasViolations: boolean | null;
  violationSeverity: string[];
  status: string[];
}

interface StorageStats {
  totalUsed: number;
  quota: number;
  recordingCount: number;
  oldestRecording: Date | null;
  newestRecording: Date | null;
  byRetentionPolicy: {
    policyId: string;
    policyName: string;
    size: number;
    count: number;
  }[];
}

interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

// ============================================================================
// Constants
// ============================================================================

const VIEW_MODES = ['grid', 'list'] as const;
type ViewMode = (typeof VIEW_MODES)[number];

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'duration_desc', label: 'Longest first' },
  { value: 'duration_asc', label: 'Shortest first' },
  { value: 'size_desc', label: 'Largest first' },
  { value: 'size_asc', label: 'Smallest first' },
  { value: 'violations_desc', label: 'Most violations' },
];

const STATUS_OPTIONS = [
  { value: 'ready', label: 'Ready', color: 'green' },
  { value: 'processing', label: 'Processing', color: 'yellow' },
  { value: 'archived', label: 'Archived', color: 'gray' },
  { value: 'pending_deletion', label: 'Pending Deletion', color: 'red' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// ============================================================================
// Sub-Components
// ============================================================================

function StorageSummary({ stats }: Readonly<{ stats: StorageStats }>) {
  const usagePercent = (stats.totalUsed / stats.quota) * 100;
  const isWarning = usagePercent > 80;
  const isCritical = usagePercent > 95;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-900 dark:text-white">Storage Usage</span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {stats.recordingCount} recordings
        </span>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {formatFileSize(stats.totalUsed)} of {formatFileSize(stats.quota)}
          </span>
          <span
            className={`font-medium ${(() => {
              if (isCritical) return 'text-red-600';
              if (isWarning) return 'text-yellow-600';
              return 'text-gray-900 dark:text-white';
            })()}`}
          >
            {usagePercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all ${(() => {
              if (isCritical) return 'bg-red-500';
              if (isWarning) return 'bg-yellow-500';
              return 'bg-blue-500';
            })()}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>

      {stats.byRetentionPolicy.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">By Retention Policy</div>
          <div className="space-y-1">
            {stats.byRetentionPolicy.slice(0, 3).map((policy) => (
              <div key={policy.policyId} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{policy.policyName}</span>
                <span className="text-gray-900 dark:text-white">
                  {formatFileSize(policy.size)} ({policy.count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RetentionPolicyBanner({ policy }: Readonly<{ policy: RetentionPolicy }>) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 text-blue-600" />
        <div>
          <h3 className="font-medium text-blue-900 dark:text-blue-100">
            Default Retention Policy: {policy.name}
          </h3>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            Recordings are automatically deleted after {policy.retentionDays} days unless on
            compliance hold.
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterPanel({
  filters,
  onFiltersChange,
  users,
  pods,
  templates,
  contracts,
  projects,
  onClose,
}: Readonly<{
  filters: RecordingFilters;
  onFiltersChange: (filters: RecordingFilters) => void;
  users: FilterOption[];
  pods: FilterOption[];
  templates: FilterOption[];
  contracts: FilterOption[];
  projects: FilterOption[];
  onClose: () => void;
}>) {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: RecordingFilters = {
      search: '',
      dateFrom: null,
      dateTo: null,
      userId: null,
      podId: null,
      templateId: null,
      contractId: null,
      projectId: null,
      hasViolations: null,
      violationSeverity: [],
      status: [],
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
    onClose();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
        <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Date Range */}
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range
          </span>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              type="date"
              value={localFilters.dateFrom?.toISOString().split('T')[0] || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  dateFrom: e.target.value ? new Date(e.target.value) : null,
                })
              }
            />
            <span className="self-center text-gray-500">to</span>
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              type="date"
              value={localFilters.dateTo?.toISOString().split('T')[0] || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  dateTo: e.target.value ? new Date(e.target.value) : null,
                })
              }
            />
          </div>
        </div>

        {/* User Filter */}
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="filter-user"
          >
            User
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            id="filter-user"
            value={localFilters.userId || ''}
            onChange={(e) =>
              setLocalFilters({
                ...localFilters,
                userId: e.target.value || null,
              })
            }
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} {user.count !== undefined && `(${user.count})`}
              </option>
            ))}
          </select>
        </div>

        {/* Pod Filter */}
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="filter-pod"
          >
            Pod / Template
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            id="filter-pod"
            value={localFilters.podId || ''}
            onChange={(e) =>
              setLocalFilters({
                ...localFilters,
                podId: e.target.value || null,
              })
            }
          >
            <option value="">All pods</option>
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name} {pod.count !== undefined && `(${pod.count})`}
              </option>
            ))}
          </select>
        </div>

        {/* Contract Filter */}
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            htmlFor="filter-contract"
          >
            Contract / Project
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            id="filter-contract"
            value={localFilters.contractId || ''}
            onChange={(e) =>
              setLocalFilters({
                ...localFilters,
                contractId: e.target.value || null,
              })
            }
          >
            <option value="">All contracts</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.name} {contract.count !== undefined && `(${contract.count})`}
              </option>
            ))}
          </select>
        </div>

        {/* Violations Filter */}
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Violations
          </span>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                checked={localFilters.hasViolations === true}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                type="checkbox"
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    hasViolations: e.target.checked ? true : null,
                  })
                }
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Has violations only</span>
            </label>
            {localFilters.hasViolations && (
              <div className="ml-6 flex flex-wrap gap-2">
                {['critical', 'high', 'medium', 'low'].map((severity) => (
                  <label key={severity} className="flex items-center gap-1">
                    <input
                      checked={localFilters.violationSeverity.includes(severity)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      type="checkbox"
                      onChange={(e) => {
                        const newSeverities = e.target.checked
                          ? [...localFilters.violationSeverity, severity]
                          : localFilters.violationSeverity.filter((s) => s !== severity);
                        setLocalFilters({
                          ...localFilters,
                          violationSeverity: newSeverities,
                        });
                      }}
                    />
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${(() => {
                        if (severity === 'critical') return 'bg-red-100 text-red-700';
                        if (severity === 'high') return 'bg-orange-100 text-orange-700';
                        if (severity === 'medium') return 'bg-yellow-100 text-yellow-700';
                        return 'bg-blue-100 text-blue-700';
                      })()}`}
                    >
                      {severity}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <label key={status.value} className="flex items-center gap-1">
                <input
                  checked={localFilters.status.includes(status.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  type="checkbox"
                  onChange={(e) => {
                    const newStatus = e.target.checked
                      ? [...localFilters.status, status.value]
                      : localFilters.status.filter((s) => s !== status.value);
                    setLocalFilters({ ...localFilters, status: newStatus });
                  }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{status.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <button
          className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={handleReset}
        >
          Reset
        </button>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          onClick={handleApply}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDownload,
  onDelete,
  onShare,
}: Readonly<{
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onShare: () => void;
}>) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {selectedCount} of {totalCount} selected
        </span>
        <button
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
        >
          {selectedCount === totalCount ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function RecordingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState('date_desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [defaultRetentionPolicy, setDefaultRetentionPolicy] = useState<RetentionPolicy | null>(
    null
  );

  const [filters, setFilters] = useState<RecordingFilters>({
    search: searchParams.get('search') || '',
    dateFrom: null,
    dateTo: null,
    userId: searchParams.get('userId') || null,
    podId: searchParams.get('podId') || null,
    templateId: null,
    contractId: searchParams.get('contractId') || null,
    projectId: null,
    hasViolations: searchParams.get('hasViolations') === 'true' ? true : null,
    violationSeverity: [],
    status: [],
  });

  // Filter options (would come from API)
  const [filterOptions, setFilterOptions] = useState<{
    users: FilterOption[];
    pods: FilterOption[];
    templates: FilterOption[];
    contracts: FilterOption[];
    projects: FilterOption[];
  }>({
    users: [],
    pods: [],
    templates: [],
    contracts: [],
    projects: [],
  });

  // Load recordings
  useEffect(() => {
    const loadRecordings = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Simulated API call - would use actual API client
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Mock data
        const mockRecordings: Recording[] = Array.from({ length: 24 }, (_, i) => ({
          id: `rec-${i + 1}`,
          sessionId: `session-${i + 1}`,
          userId: `user-${(i % 5) + 1}`,
          userName: ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eve Davis'][
            i % 5
          ],
          userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
          podId: `pod-${(i % 3) + 1}`,
          podName: ['Dev Environment', 'Design Studio', 'Data Analysis'][i % 3],
          templateName: ['Ubuntu Desktop', 'Windows 11', 'CentOS'][i % 3],
          contractId: i % 2 === 0 ? `contract-${(i % 4) + 1}` : undefined,
          contractName: i % 2 === 0 ? `Project ${String.fromCodePoint(65 + (i % 4))}` : undefined,
          startTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - Math.random() * 29 * 24 * 60 * 60 * 1000),
          duration: Math.floor(Math.random() * 7200) + 300,
          thumbnailUrl: `https://picsum.photos/seed/${i}/320/180`,
          videoUrl: `/recordings/${i + 1}/stream`,
          fileSize: Math.floor(Math.random() * 500000000) + 10000000,
          violations:
            i % 4 === 0
              ? [
                  {
                    id: `v-${i}-1`,
                    type: 'screenshot_attempt',
                    severity: 'high' as const,
                    timestamp: Math.random() * 3600,
                  },
                ]
              : [],
          events: {
            fileTransfers: Math.floor(Math.random() * 10),
            clipboardEvents: Math.floor(Math.random() * 50),
            keystrokes: Math.floor(Math.random() * 10000),
            screenshots: 0,
          },
          retentionPolicy: {
            id: 'default',
            name: 'Standard 90-day',
            retentionDays: 90,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            isOnHold: i === 0,
            holdReason: i === 0 ? 'Compliance audit' : undefined,
          },
          status: 'ready' as const,
        }));

        setRecordings(mockRecordings);

        // Mock storage stats
        setStorageStats({
          totalUsed: 125 * 1024 * 1024 * 1024, // 125 GB
          quota: 500 * 1024 * 1024 * 1024, // 500 GB
          recordingCount: mockRecordings.length,
          oldestRecording: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          newestRecording: new Date(),
          byRetentionPolicy: [
            {
              policyId: 'default',
              policyName: 'Standard 90-day',
              size: 100 * 1024 * 1024 * 1024,
              count: 20,
            },
            {
              policyId: 'compliance',
              policyName: 'Compliance 7-year',
              size: 25 * 1024 * 1024 * 1024,
              count: 4,
            },
          ],
        });

        // Mock default retention policy
        setDefaultRetentionPolicy({
          id: 'default',
          name: 'Standard 90-day',
          retentionDays: 90,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          isOnHold: false,
        });

        // Mock filter options
        setFilterOptions({
          users: [
            { id: 'user-1', name: 'Alice Johnson', count: 8 },
            { id: 'user-2', name: 'Bob Smith', count: 6 },
            { id: 'user-3', name: 'Carol Williams', count: 5 },
            { id: 'user-4', name: 'David Brown', count: 3 },
            { id: 'user-5', name: 'Eve Davis', count: 2 },
          ],
          pods: [
            { id: 'pod-1', name: 'Dev Environment', count: 10 },
            { id: 'pod-2', name: 'Design Studio', count: 8 },
            { id: 'pod-3', name: 'Data Analysis', count: 6 },
          ],
          templates: [
            { id: 'tpl-1', name: 'Ubuntu Desktop', count: 12 },
            { id: 'tpl-2', name: 'Windows 11', count: 8 },
            { id: 'tpl-3', name: 'CentOS', count: 4 },
          ],
          contracts: [
            { id: 'contract-1', name: 'Project A', count: 5 },
            { id: 'contract-2', name: 'Project B', count: 4 },
            { id: 'contract-3', name: 'Project C', count: 3 },
          ],
          projects: [],
        });
      } catch (err) {
        setError('Failed to load recordings');
        console.error('Error loading recordings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadRecordings();
  }, [filters]);

  // Filter and sort recordings
  const filteredRecordings = recordings
    .filter((recording) => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matches =
          recording.userName.toLowerCase().includes(search) ||
          recording.podName.toLowerCase().includes(search) ||
          recording.contractName?.toLowerCase().includes(search);
        if (!matches) return false;
      }
      if (filters.userId && recording.userId !== filters.userId) return false;
      if (filters.podId && recording.podId !== filters.podId) return false;
      if (filters.contractId && recording.contractId !== filters.contractId) return false;
      if (filters.hasViolations === true && recording.violations.length === 0) return false;
      if (filters.status.length > 0 && !filters.status.includes(recording.status)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return a.startTime.getTime() - b.startTime.getTime();
        case 'duration_desc':
          return b.duration - a.duration;
        case 'duration_asc':
          return a.duration - b.duration;
        case 'size_desc':
          return b.fileSize - a.fileSize;
        case 'size_asc':
          return a.fileSize - b.fileSize;
        case 'violations_desc':
          return b.violations.length - a.violations.length;
        default:
          return b.startTime.getTime() - a.startTime.getTime();
      }
    });

  // Selection handlers
  const handleSelectRecording = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredRecordings.map((r) => r.id)));
  }, [filteredRecordings]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk action handlers
  const handleBulkDownload = async () => {
    // Feature: Bulk download recordings - not yet implemented
  };

  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} recordings? This cannot be undone.`)) return;
    // Feature: Bulk delete recordings via API - not yet implemented
  };

  const handleBulkShare = () => {
    // Feature: Bulk share recordings - not yet implemented
  };

  // Recording action handlers
  const handlePlayRecording = (id: string) => {
    router.push(`/recordings/${id}`);
  };

  const handleDownloadRecording = async (_id: string) => {
    // Feature: Download single recording - not yet implemented
  };

  const handleShareRecording = (_id: string) => {
    // Feature: Share recording - not yet implemented
  };

  const handleDeleteRecording = (_id: string) => {
    if (!confirm('Delete this recording? This cannot be undone.')) return;
    // Feature: Delete recording via API - not yet implemented
  };

  // Active filter count
  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.userId,
    filters.podId,
    filters.contractId,
    filters.hasViolations,
    filters.status.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Session Recordings
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Review and manage recorded SkillPod sessions
              </p>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
              onClick={() => setIsLoading(true)}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="space-y-4 lg:col-span-1">
            {storageStats && <StorageSummary stats={storageStats} />}
            {defaultRetentionPolicy && <RetentionPolicyBanner policy={defaultRetentionPolicy} />}
          </div>

          {/* Main Content */}
          <div className="space-y-4 lg:col-span-3">
            {/* Search and Controls */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Search recordings..."
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>

                {/* Filter Button */}
                <button
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
                    showFilters || activeFilterCount > 0
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                      : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
                  }`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Sort */}
                <div className="relative">
                  <select
                    className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-4 pr-10 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>

                {/* View Mode */}
                <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
                  {VIEW_MODES.map((mode) => (
                    <button
                      key={mode}
                      className={`p-2 ${
                        viewMode === mode
                          ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                      onClick={() => setViewMode(mode)}
                    >
                      {mode === 'grid' ? (
                        <LayoutGrid className="h-5 w-5" />
                      ) : (
                        <List className="h-5 w-5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="mt-4">
                  <FilterPanel
                    contracts={filterOptions.contracts}
                    filters={filters}
                    pods={filterOptions.pods}
                    projects={filterOptions.projects}
                    templates={filterOptions.templates}
                    users={filterOptions.users}
                    onClose={() => setShowFilters(false)}
                    onFiltersChange={setFilters}
                  />
                </div>
              )}
            </div>

            {/* Bulk Actions */}
            <BulkActionsBar
              selectedCount={selectedIds.size}
              totalCount={filteredRecordings.length}
              onDelete={handleBulkDelete}
              onDeselectAll={handleDeselectAll}
              onDownload={handleBulkDownload}
              onSelectAll={handleSelectAll}
              onShare={handleBulkShare}
            />

            {/* Recordings Grid/List */}
            {(() => {
              if (isLoading) {
                return (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                );
              }
              if (error) {
                return (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                  </div>
                );
              }
              if (filteredRecordings.length === 0) {
                return (
                  <div className="py-12 text-center">
                    <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                    <h3 className="mb-1 text-lg font-medium text-gray-900 dark:text-white">
                      No recordings found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {activeFilterCount > 0
                        ? 'Try adjusting your filters'
                        : 'Recordings will appear here after SkillPod sessions'}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
                      : 'space-y-2'
                  }
                >
                  {filteredRecordings.map((recording) => (
                    <RecordingCard
                      key={recording.id}
                      isSelected={selectedIds.has(recording.id)}
                      recording={recording}
                      viewMode={viewMode}
                      onDelete={() => handleDeleteRecording(recording.id)}
                      onDownload={() => handleDownloadRecording(recording.id)}
                      onPlay={() => handlePlayRecording(recording.id)}
                      onSelect={(selected) => handleSelectRecording(recording.id, selected)}
                      onShare={() => handleShareRecording(recording.id)}
                    />
                  ))}
                </div>
              );
            })()}

            {/* Results Summary */}
            {!isLoading && !error && filteredRecordings.length > 0 && (
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredRecordings.length} of {recordings.length} recordings
                {activeFilterCount > 0 && ' (filtered)'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
