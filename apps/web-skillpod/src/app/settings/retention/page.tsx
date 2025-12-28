/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Retention Policy Settings Page
 *
 * Configure recording retention policies, storage quotas,
 * compliance holds, and auto-deletion rules.
 *
 * @module app/settings/retention/page
 */

import { HardDrive, AlertTriangle, Plus, Edit2, Trash2, FileText, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';

import { RetentionConfig } from '@/components/recordings/retention-config';

// ============================================================================
// Types
// ============================================================================

interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  retentionDays: number;
  isDefault: boolean;
  conditions: PolicyCondition[];
  createdAt: Date;
  updatedAt: Date;
  recordingCount: number;
  storageUsed: number;
}

interface PolicyCondition {
  id: string;
  field: 'contract_value' | 'compliance_type' | 'violation_severity' | 'user_role' | 'pod_template';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: string | number | string[];
}

interface ComplianceHold {
  id: string;
  name: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  recordingCount: number;
  status: 'active' | 'expired' | 'released';
}

interface StorageQuota {
  total: number;
  used: number;
  recordings: number;
  byPolicy: {
    policyId: string;
    policyName: string;
    size: number;
    count: number;
  }[];
}

interface PendingDeletion {
  id: string;
  recordingId: string;
  recordingName: string;
  scheduledAt: Date;
  reason: string;
  canOverride: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const RETENTION_PRESETS = [
  { days: 30, label: '30 days', description: 'Standard short-term retention' },
  { days: 90, label: '90 days', description: 'Quarterly retention' },
  { days: 365, label: '1 year', description: 'Annual retention' },
  { days: 2555, label: '7 years', description: 'Compliance (SOX, HIPAA)' },
  { days: -1, label: 'Indefinite', description: 'Never auto-delete' },
];

// ============================================================================
// Helper Functions
// ============================================================================

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

function formatRetentionDays(days: number): string {
  if (days === -1) return 'Indefinite';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function StorageOverview({ quota }: Readonly<{ quota: StorageQuota }>) {
  const usagePercent = (quota.used / quota.total) * 100;
  const isWarning = usagePercent > 80;
  const isCritical = usagePercent > 95;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Storage Usage</h3>
        </div>
        <span className="text-sm text-gray-500">
          {quota.recordings.toLocaleString()} recordings
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {formatFileSize(quota.used)} of {formatFileSize(quota.total)} used
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
        <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
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

      {(isWarning || isCritical) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg p-3 ${
            isCritical
              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{isCritical ? 'Storage Critical' : 'Storage Warning'}</p>
            <p className="mt-1 text-sm">
              {isCritical
                ? 'Immediate action required. New recordings may be blocked.'
                : 'Consider adjusting retention policies or upgrading storage.'}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">By Policy</h4>
        {quota.byPolicy.map((policy) => (
          <div key={policy.policyId} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full bg-blue-500"
                style={{
                  backgroundColor: `hsl(${(Number.parseInt(policy.policyId, 36) * 137) % 360}, 70%, 50%)`,
                }}
              />
              <span className="text-gray-600 dark:text-gray-400">{policy.policyName}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-900 dark:text-white">{formatFileSize(policy.size)}</span>
              <span className="ml-1 text-gray-500">({policy.count})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PolicyCard({
  policy,
  onEdit,
  onDelete,
  onSetDefault,
}: Readonly<{
  policy: RetentionPolicy;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}>) {
  return (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-800 ${
        policy.isDefault
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700'
      } p-4`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 dark:text-white">{policy.name}</h4>
            {policy.isDefault && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Default
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{policy.description}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={onEdit}
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {!policy.isDefault && (
            <button className="rounded p-1.5 text-gray-400 hover:text-red-600" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Retention</span>
          <div className="font-medium text-gray-900 dark:text-white">
            {formatRetentionDays(policy.retentionDays)}
          </div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Recordings</span>
          <div className="font-medium text-gray-900 dark:text-white">
            {policy.recordingCount.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Storage</span>
          <div className="font-medium text-gray-900 dark:text-white">
            {formatFileSize(policy.storageUsed)}
          </div>
        </div>
      </div>

      {policy.conditions.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Conditions</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {policy.conditions.map((condition) => (
              <span
                key={condition.id}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {condition.field.replace('_', ' ')} {condition.operator} {String(condition.value)}
              </span>
            ))}
          </div>
        </div>
      )}

      {!policy.isDefault && (
        <button
          className="mt-3 w-full rounded py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          onClick={onSetDefault}
        >
          Set as Default
        </button>
      )}
    </div>
  );
}

function ComplianceHoldCard({
  hold,
  onRelease,
  onExtend,
}: Readonly<{
  hold: ComplianceHold;
  onRelease: () => void;
  onExtend: () => void;
}>) {
  const isExpiring =
    hold.expiresAt &&
    hold.status === 'active' &&
    new Date(hold.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-800 ${
        hold.status === 'active' ? 'border-orange-500' : 'border-gray-200 dark:border-gray-700'
      } p-4`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-lg p-2 ${
              hold.status === 'active'
                ? 'bg-orange-100 dark:bg-orange-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <Lock
              className={`h-5 w-5 ${
                hold.status === 'active' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'
              }`}
            />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{hold.name}</h4>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{hold.reason}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span>Created by {hold.createdBy}</span>
              <span>{formatDate(hold.createdAt)}</span>
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs ${(() => {
            if (hold.status === 'active')
              return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            if (hold.status === 'expired')
              return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
          })()}`}
        >
          {hold.status}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">{hold.recordingCount} recordings</span>
          {hold.expiresAt && (
            <span className={isExpiring ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}>
              Expires {formatDate(hold.expiresAt)}
            </span>
          )}
        </div>
        {hold.status === 'active' && (
          <div className="flex items-center gap-2">
            <button
              className="rounded px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={onExtend}
            >
              Extend
            </button>
            <button
              className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={onRelease}
            >
              Release
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingDeletionList({
  items,
  onOverride,
}: Readonly<{
  items: PendingDeletion[];
  onOverride: (id: string) => void;
}>) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
        No recordings pending deletion
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
        >
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{item.recordingName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Scheduled for {formatDate(item.scheduledAt)} • {item.reason}
            </div>
          </div>
          {item.canOverride && (
            <button
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              onClick={() => onOverride(item.id)}
            >
              Override
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function RetentionSettingsPage() {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [holds, setHolds] = useState<ComplianceHold[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Mock data
        await new Promise((resolve) => setTimeout(resolve, 500));

        setPolicies([
          {
            id: 'default',
            name: 'Standard 90-day',
            description: 'Default retention for all recordings',
            retentionDays: 90,
            isDefault: true,
            conditions: [],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
            recordingCount: 1250,
            storageUsed: 100 * 1024 * 1024 * 1024,
          },
          {
            id: 'compliance',
            name: 'Compliance 7-year',
            description: 'Extended retention for regulated contracts',
            retentionDays: 2555,
            isDefault: false,
            conditions: [
              {
                id: 'c1',
                field: 'compliance_type',
                operator: 'in',
                value: ['HIPAA', 'SOX', 'PCI'],
              },
            ],
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-02-01'),
            recordingCount: 340,
            storageUsed: 50 * 1024 * 1024 * 1024,
          },
          {
            id: 'high-value',
            name: 'High-Value Contracts',
            description: '1-year retention for contracts over $100k',
            retentionDays: 365,
            isDefault: false,
            conditions: [
              { id: 'c2', field: 'contract_value', operator: 'greater_than', value: 100000 },
            ],
            createdAt: new Date('2024-02-01'),
            updatedAt: new Date('2024-02-01'),
            recordingCount: 180,
            storageUsed: 25 * 1024 * 1024 * 1024,
          },
        ]);

        setHolds([
          {
            id: 'hold-1',
            name: 'Q1 2024 Audit',
            reason: 'Internal security audit - preserving all relevant session recordings',
            createdBy: 'admin@company.com',
            createdAt: new Date('2024-03-01'),
            expiresAt: new Date('2024-06-30'),
            recordingCount: 45,
            status: 'active',
          },
          {
            id: 'hold-2',
            name: 'Legal Discovery - Case #2024-001',
            reason: 'Legal hold for ongoing litigation',
            createdBy: 'legal@company.com',
            createdAt: new Date('2024-02-15'),
            expiresAt: null,
            recordingCount: 12,
            status: 'active',
          },
        ]);

        setPendingDeletions([
          {
            id: 'pd-1',
            recordingId: 'rec-123',
            recordingName: 'Session with Alice - Feb 15',
            scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            reason: 'Reached 90-day retention limit',
            canOverride: true,
          },
          {
            id: 'pd-2',
            recordingId: 'rec-124',
            recordingName: 'Session with Bob - Feb 16',
            scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            reason: 'Reached 90-day retention limit',
            canOverride: true,
          },
        ]);

        setStorageQuota({
          total: 500 * 1024 * 1024 * 1024,
          used: 175 * 1024 * 1024 * 1024,
          recordings: 1770,
          byPolicy: [
            {
              policyId: 'default',
              policyName: 'Standard 90-day',
              size: 100 * 1024 * 1024 * 1024,
              count: 1250,
            },
            {
              policyId: 'compliance',
              policyName: 'Compliance 7-year',
              size: 50 * 1024 * 1024 * 1024,
              count: 340,
            },
            {
              policyId: 'high-value',
              policyName: 'High-Value Contracts',
              size: 25 * 1024 * 1024 * 1024,
              count: 180,
            },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  // Handlers
  const handleCreatePolicy = () => {
    setShowCreatePolicy(true);
  };

  const handleEditPolicy = (policy: RetentionPolicy) => {
    setEditingPolicy(policy);
  };

  const handleDeletePolicy = (policyId: string) => {
    if (
      !confirm('Delete this retention policy? Affected recordings will use the default policy.')
    ) {
      return;
    }
    setPolicies((prev) => prev.filter((p) => p.id !== policyId));
  };

  const handleSetDefaultPolicy = (policyId: string) => {
    setPolicies((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === policyId,
      }))
    );
  };

  const handleReleaseHold = (holdId: string) => {
    if (
      !confirm(
        'Release this compliance hold? Affected recordings may become eligible for deletion.'
      )
    ) {
      return;
    }
    setHolds((prev) =>
      prev.map((h) => (h.id === holdId ? { ...h, status: 'released' as const } : h))
    );
  };

  const handleExtendHold = (_holdId: string) => {
    // Feature: Extend legal hold duration - not yet implemented
  };

  const handleOverrideDeletion = (deletionId: string) => {
    if (
      !confirm(
        'Override this scheduled deletion? The recording will use the next applicable retention policy.'
      )
    ) {
      return;
    }
    setPendingDeletions((prev) => prev.filter((p) => p.id !== deletionId));
  };

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
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Retention Policies
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Configure how long session recordings are stored
              </p>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              onClick={handleCreatePolicy}
            >
              <Plus className="h-4 w-4" />
              Create Policy
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sidebar - Storage Overview */}
          <div className="space-y-6 lg:col-span-1">
            {storageQuota && <StorageOverview quota={storageQuota} />}

            {/* Quick Actions */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 font-medium text-gray-900 dark:text-white">Quick Actions</h3>
              <div className="space-y-2">
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                  <Lock className="h-4 w-4" />
                  Create Compliance Hold
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                  <FileText className="h-4 w-4" />
                  View Audit Log
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                  <HardDrive className="h-4 w-4" />
                  Request Storage Upgrade
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Retention Policies */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Retention Policies
              </h2>
              <div className="space-y-4">
                {policies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onDelete={() => handleDeletePolicy(policy.id)}
                    onEdit={() => handleEditPolicy(policy)}
                    onSetDefault={() => handleSetDefaultPolicy(policy.id)}
                  />
                ))}
              </div>
            </div>

            {/* Compliance Holds */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Compliance Holds
                </h2>
                <span className="text-sm text-gray-500">
                  {holds.filter((h) => h.status === 'active').length} active
                </span>
              </div>
              {holds.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                  No compliance holds active
                </div>
              ) : (
                <div className="space-y-4">
                  {holds.map((hold) => (
                    <ComplianceHoldCard
                      key={hold.id}
                      hold={hold}
                      onExtend={() => handleExtendHold(hold.id)}
                      onRelease={() => handleReleaseHold(hold.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Pending Deletions */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pending Auto-Deletions
                </h2>
                <span className="text-sm text-red-600 dark:text-red-400">
                  {pendingDeletions.length} scheduled
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <PendingDeletionList items={pendingDeletions} onOverride={handleOverrideDeletion} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Policy Modal */}
      {(showCreatePolicy || editingPolicy) && (
        <RetentionConfig
          policy={editingPolicy || undefined}
          onClose={() => {
            setShowCreatePolicy(false);
            setEditingPolicy(null);
          }}
          onSave={(policy) => {
            if (editingPolicy) {
              setPolicies((prev) =>
                prev.map((p) => (p.id === editingPolicy.id ? { ...p, ...policy } : p))
              );
            } else {
              setPolicies((prev) => [
                ...prev,
                {
                  ...policy,
                  id: `policy-${Date.now()}`,
                  isDefault: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  recordingCount: 0,
                  storageUsed: 0,
                } as RetentionPolicy,
              ]);
            }
            setShowCreatePolicy(false);
            setEditingPolicy(null);
          }}
        />
      )}
    </div>
  );
}
