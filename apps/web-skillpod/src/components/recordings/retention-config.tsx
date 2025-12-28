/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Retention Configuration Component
 *
 * Modal for creating and editing retention policies with
 * condition builder and storage impact preview.
 *
 * @module components/recordings/retention-config
 */

import { X, Plus, Trash2, AlertTriangle, HardDrive, Check } from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PolicyCondition {
  id: string;
  field: 'contract_value' | 'compliance_type' | 'violation_severity' | 'user_role' | 'pod_template';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: string | number | string[];
}

interface RetentionPolicyInput {
  name: string;
  description: string;
  retentionDays: number;
  conditions: PolicyCondition[];
}

interface RetentionPolicy extends RetentionPolicyInput {
  id: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  recordingCount: number;
  storageUsed: number;
}

interface RetentionConfigProps {
  policy?: RetentionPolicy;
  onSave: (policy: RetentionPolicyInput) => void;
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const RETENTION_PRESETS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
  { days: 2555, label: '7 years' },
  { days: -1, label: 'Indefinite' },
];

const CONDITION_FIELDS = [
  { value: 'contract_value', label: 'Contract Value', type: 'number' },
  {
    value: 'compliance_type',
    label: 'Compliance Type',
    type: 'select',
    options: ['HIPAA', 'SOX', 'PCI-DSS', 'GDPR', 'SOC2'],
  },
  {
    value: 'violation_severity',
    label: 'Violation Severity',
    type: 'select',
    options: ['critical', 'high', 'medium', 'low'],
  },
  {
    value: 'user_role',
    label: 'User Role',
    type: 'select',
    options: ['freelancer', 'client', 'admin'],
  },
  { value: 'pod_template', label: 'Pod Template', type: 'text' },
];

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
  ],
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'contains', label: 'contains' },
  ],
  select: [
    { value: 'equals', label: 'equals' },
    { value: 'in', label: 'is one of' },
  ],
};

const COMPLIANCE_REQUIREMENTS = [
  { type: 'HIPAA', minDays: 2190, description: '6 years for covered entities' },
  { type: 'SOX', minDays: 2555, description: '7 years for financial records' },
  { type: 'PCI-DSS', minDays: 365, description: '1 year minimum' },
  { type: 'GDPR', minDays: 0, description: 'Data minimization applies' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatRetentionDays(days: number): string {
  if (days === -1) return 'Indefinite';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

function estimateStorageImpact(days: number, baseRecordings: number = 100): number {
  // Rough estimate: longer retention = more storage
  const avgRecordingSize = 150 * 1024 * 1024; // 150MB
  const factor = days === -1 ? 10 : Math.min(days / 90, 10);
  return Math.floor(baseRecordings * factor * avgRecordingSize);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function RetentionSlider({
  value,
  onChange,
}: Readonly<{ value: number; onChange: (days: number) => void }>) {
  // Map slider position to days
  const positions = [30, 60, 90, 180, 365, 730, 1095, 2555, -1];
  const currentIndex = positions.indexOf(value);
  const sliderValue = currentIndex >= 0 ? currentIndex : 2; // Default to 90

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          htmlFor="retention-period-slider"
        >
          Retention Period
        </label>
        <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
          {formatRetentionDays(value)}
        </span>
      </div>

      <input
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-500 dark:bg-gray-700"
        id="retention-period-slider"
        max={positions.length - 1}
        min={0}
        type="range"
        value={sliderValue}
        onChange={(e) => {
          const index = Number.parseInt(e.target.value, 10);
          const days = positions[index];
          if (days !== undefined) {
            onChange(days);
          }
        }}
      />

      <div className="flex justify-between text-xs text-gray-500">
        <span>30d</span>
        <span>90d</span>
        <span>1y</span>
        <span>3y</span>
        <span>7y</span>
        <span>∞</span>
      </div>

      {/* Quick Select */}
      <div className="flex flex-wrap gap-2">
        {RETENTION_PRESETS.map((preset) => (
          <button
            key={preset.days}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              value === preset.days
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'
            }`}
            onClick={() => onChange(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper function to render condition value input based on field type
function renderConditionValueInput(
  fieldConfig: (typeof CONDITION_FIELDS)[number] | undefined,
  condition: PolicyCondition,
  onUpdate: (updates: Partial<PolicyCondition>) => void
) {
  if (fieldConfig?.type === 'select') {
    if (condition.operator === 'in') {
      return (
        <div className="flex flex-1 flex-wrap gap-1">
          {fieldConfig.options?.map((opt) => {
            const currentValues = Array.isArray(condition.value) ? condition.value : [];
            const isChecked = currentValues.includes(opt);
            return (
              <label
                key={opt}
                className={`cursor-pointer rounded px-2 py-0.5 text-xs ${
                  isChecked
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <input
                  checked={isChecked}
                  className="sr-only"
                  type="checkbox"
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...currentValues, opt]
                      : currentValues.filter((v) => v !== opt);
                    onUpdate({ value: newValues });
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    }
    return (
      <select
        className="flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        value={String(condition.value)}
        onChange={(e) => onUpdate({ value: e.target.value })}
      >
        <option value="">Select...</option>
        {fieldConfig.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (fieldConfig?.type === 'number') {
    return (
      <input
        className="w-32 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        type="number"
        value={condition.value as number}
        onChange={(e) => onUpdate({ value: Number.parseFloat(e.target.value) || 0 })}
      />
    );
  }

  return (
    <input
      className="flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      type="text"
      value={String(condition.value)}
      onChange={(e) => onUpdate({ value: e.target.value })}
    />
  );
}

function ConditionBuilder({
  conditions,
  onChange,
}: Readonly<{
  conditions: PolicyCondition[];
  onChange: (conditions: PolicyCondition[]) => void;
}>) {
  const handleAddCondition = () => {
    onChange([
      ...conditions,
      {
        id: `cond-${Date.now()}`,
        field: 'contract_value',
        operator: 'greater_than',
        value: 0,
      },
    ]);
  };

  const handleRemoveCondition = (id: string) => {
    onChange(conditions.filter((c) => c.id !== id));
  };

  const handleUpdateCondition = (id: string, updates: Partial<PolicyCondition>) => {
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const getFieldConfig = (field: string) => {
    return CONDITION_FIELDS.find((f) => f.value === field);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Conditions
        </span>
        <button
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={handleAddCondition}
        >
          <Plus className="h-4 w-4" />
          Add Condition
        </button>
      </div>

      {conditions.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-gray-200 py-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No conditions. This policy will apply to all recordings without specific rules.
        </p>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => {
            const fieldConfig = getFieldConfig(condition.field);
            const operators = OPERATORS[fieldConfig?.type || 'text'];

            return (
              <div
                key={condition.id}
                className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
              >
                {index > 0 && <span className="w-8 text-xs text-gray-500">AND</span>}

                {/* Field Select */}
                <select
                  className="flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  value={condition.field}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, {
                      field: e.target.value as PolicyCondition['field'],
                      operator: 'equals',
                      value: '',
                    })
                  }
                >
                  {CONDITION_FIELDS.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>

                {/* Operator Select */}
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  value={condition.operator}
                  onChange={(e) =>
                    handleUpdateCondition(condition.id, {
                      operator: e.target.value as PolicyCondition['operator'],
                    })
                  }
                >
                  {operators?.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value Input */}
                {renderConditionValueInput(fieldConfig, condition, (updates) =>
                  handleUpdateCondition(condition.id, updates)
                )}

                {/* Remove Button */}
                <button
                  className="p-1 text-gray-400 hover:text-red-500"
                  onClick={() => handleRemoveCondition(condition.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StorageImpactPreview({ retentionDays }: Readonly<{ retentionDays: number }>) {
  const estimatedStorage = useMemo(() => estimateStorageImpact(retentionDays), [retentionDays]);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <div className="mb-2 flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-blue-900 dark:text-blue-100">
          Estimated Storage Impact
        </span>
      </div>
      <p className="text-sm text-blue-700 dark:text-blue-300">
        This policy could require approximately <strong>{formatFileSize(estimatedStorage)}</strong>{' '}
        of storage per 100 recordings.
      </p>
    </div>
  );
}

function ComplianceRequirements({ retentionDays }: Readonly<{ retentionDays: number }>) {
  const meetsRequirements = COMPLIANCE_REQUIREMENTS.filter(
    (req) => retentionDays === -1 || retentionDays >= req.minDays
  );

  const missingRequirements = COMPLIANCE_REQUIREMENTS.filter(
    (req) => retentionDays !== -1 && retentionDays < req.minDays
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Compliance Requirements
      </h4>

      {meetsRequirements.length > 0 && (
        <div className="space-y-1">
          {meetsRequirements.map((req) => (
            <div
              key={req.type}
              className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
            >
              <Check className="h-4 w-4" />
              <span>{req.type}</span>
              <span className="text-gray-500">- {req.description}</span>
            </div>
          ))}
        </div>
      )}

      {missingRequirements.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="mb-2 flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Insufficient for:</span>
          </div>
          <div className="space-y-1">
            {missingRequirements.map((req) => (
              <div key={req.type} className="text-sm text-yellow-600 dark:text-yellow-400">
                {req.type} - requires {formatRetentionDays(req.minDays)} ({req.description})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RetentionConfig({ policy, onSave, onClose }: Readonly<RetentionConfigProps>) {
  const [name, setName] = useState(policy?.name || '');
  const [description, setDescription] = useState(policy?.description || '');
  const [retentionDays, setRetentionDays] = useState(policy?.retentionDays || 90);
  const [conditions, setConditions] = useState<PolicyCondition[]>(policy?.conditions || []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!policy;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    if (description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      retentionDays,
      conditions,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Retention Policy' : 'Create Retention Policy'}
          </h2>
          <button
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Name */}
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="policy-name"
            >
              Policy Name
            </label>
            <input
              className={`w-full rounded-lg border bg-white px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              id="policy-name"
              placeholder="e.g., Compliance 7-year"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="policy-description"
            >
              Description
            </label>
            <textarea
              className={`w-full resize-none rounded-lg border bg-white px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white ${
                errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              id="policy-description"
              placeholder="Describe when this policy should be applied..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Retention Period */}
          <RetentionSlider value={retentionDays} onChange={setRetentionDays} />

          {/* Conditions */}
          <ConditionBuilder conditions={conditions} onChange={setConditions} />

          {/* Storage Impact */}
          <StorageImpactPreview retentionDays={retentionDays} />

          {/* Compliance Requirements */}
          <ComplianceRequirements retentionDays={retentionDays} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={handleSubmit}
          >
            {isEditing ? 'Save Changes' : 'Create Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RetentionConfig;
