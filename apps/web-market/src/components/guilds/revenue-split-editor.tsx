'use client';

/**
 * Revenue Split Editor Component
 * Sprint M8: Guild & Agency Accounts
 *
 * Configure and manage payment splits among guild members
 */

import {
  PieChart,
  DollarSign,
  Users,
  Calculator,
  AlertCircle,
  CheckCircle,
  RefreshCcw,
  Settings,
  Save,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

export type SplitMethod = 'EQUAL' | 'BY_ALLOCATION' | 'BY_HOURS' | 'BY_ROLE' | 'CUSTOM';

interface MemberSplit {
  memberId: string;
  memberName: string;
  avatar: string | null;
  role: string;
  percentage: number;
  amount: number;
  hoursWorked?: number;
  allocation?: number;
}

interface RevenueSplitEditorProps {
  guildId: string;
  projectId: string;
  totalAmount: number;
  platformFeePercent?: number;
  guildFeePercent?: number;
  members: {
    id: string;
    name: string;
    avatar: string | null;
    role: string;
    hoursWorked?: number;
    allocation?: number;
  }[];
  initialSplits?: MemberSplit[];
  onSave: (splits: MemberSplit[], method: SplitMethod) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

export default function RevenueSplitEditor({
  guildId,
  projectId,
  totalAmount,
  platformFeePercent = 10,
  guildFeePercent = 5,
  members,
  initialSplits,
  onSave,
  onCancel,
  readOnly = false,
}: RevenueSplitEditorProps) {
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('EQUAL');
  const [splits, setSplits] = useState<MemberSplit[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate fees
  const platformFee = (totalAmount * platformFeePercent) / 100;
  const guildFee = (totalAmount * guildFeePercent) / 100;
  const distributableAmount = totalAmount - platformFee - guildFee;

  useEffect(() => {
    if (initialSplits && initialSplits.length > 0) {
      setSplits(initialSplits);
      setSplitMethod('CUSTOM');
    } else {
      calculateSplits('EQUAL');
    }
  }, [members]);

  const calculateSplits = (method: SplitMethod) => {
    const newSplits: MemberSplit[] = [];

    switch (method) {
      case 'EQUAL': {
        const equalPercentage = 100 / members.length;
        const equalAmount = distributableAmount / members.length;
        members.forEach((member) => {
          newSplits.push({
            memberId: member.id,
            memberName: member.name,
            avatar: member.avatar,
            role: member.role,
            percentage: equalPercentage,
            amount: equalAmount,
            hoursWorked: member.hoursWorked,
            allocation: member.allocation,
          });
        });
        break;
      }

      case 'BY_ALLOCATION': {
        const totalAllocation = members.reduce((sum, m) => sum + (m.allocation || 0), 0);
        if (totalAllocation === 0) {
          calculateSplits('EQUAL');
          return;
        }
        members.forEach((member) => {
          const allocation = member.allocation || 0;
          const percentage = (allocation / totalAllocation) * 100;
          newSplits.push({
            memberId: member.id,
            memberName: member.name,
            avatar: member.avatar,
            role: member.role,
            percentage,
            amount: (distributableAmount * percentage) / 100,
            hoursWorked: member.hoursWorked,
            allocation: member.allocation,
          });
        });
        break;
      }

      case 'BY_HOURS': {
        const totalHours = members.reduce((sum, m) => sum + (m.hoursWorked || 0), 0);
        if (totalHours === 0) {
          calculateSplits('EQUAL');
          return;
        }
        members.forEach((member) => {
          const hours = member.hoursWorked || 0;
          const percentage = (hours / totalHours) * 100;
          newSplits.push({
            memberId: member.id,
            memberName: member.name,
            avatar: member.avatar,
            role: member.role,
            percentage,
            amount: (distributableAmount * percentage) / 100,
            hoursWorked: member.hoursWorked,
            allocation: member.allocation,
          });
        });
        break;
      }

      case 'BY_ROLE': {
        // Role-based weights
        const roleWeights: Record<string, number> = {
          LEAD: 2.0,
          SENIOR: 1.5,
          MEMBER: 1.0,
          JUNIOR: 0.75,
        };
        const totalWeight = members.reduce((sum, m) => sum + (roleWeights[m.role] || 1), 0);
        members.forEach((member) => {
          const weight = roleWeights[member.role] || 1;
          const percentage = (weight / totalWeight) * 100;
          newSplits.push({
            memberId: member.id,
            memberName: member.name,
            avatar: member.avatar,
            role: member.role,
            percentage,
            amount: (distributableAmount * percentage) / 100,
            hoursWorked: member.hoursWorked,
            allocation: member.allocation,
          });
        });
        break;
      }

      case 'CUSTOM':
        // Keep existing splits or initialize equal
        if (splits.length > 0) return;
        calculateSplits('EQUAL');
        return;
    }

    setSplits(newSplits);
    setSplitMethod(method);
  };

  const updateMemberPercentage = (memberId: string, newPercentage: number) => {
    setSplitMethod('CUSTOM');
    setSplits(
      splits.map((s) =>
        s.memberId === memberId
          ? {
              ...s,
              percentage: newPercentage,
              amount: (distributableAmount * newPercentage) / 100,
            }
          : s
      )
    );
  };

  const totalPercentage = useMemo(() => splits.reduce((sum, s) => sum + s.percentage, 0), [splits]);

  const isValid = useMemo(() => {
    return Math.abs(totalPercentage - 100) < 0.01;
  }, [totalPercentage]);

  const handleSave = async () => {
    if (!isValid) {
      setError('Total percentage must equal 100%');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(splits, splitMethod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save splits');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <PieChart className="h-5 w-5" />
          Revenue Distribution
        </h3>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</div>
            <div className="text-sm text-gray-500">Total Revenue</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">-{formatCurrency(platformFee)}</div>
            <div className="text-sm text-gray-500">Platform Fee ({platformFeePercent}%)</div>
          </div>
          <div className="rounded-lg bg-orange-50 p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">-{formatCurrency(guildFee)}</div>
            <div className="text-sm text-gray-500">Guild Fee ({guildFeePercent}%)</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(distributableAmount)}
            </div>
            <div className="text-sm text-gray-500">To Distribute</div>
          </div>
        </div>

        {/* Split Method Selector */}
        {!readOnly && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Split Method</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: 'EQUAL', label: 'Equal', icon: Users },
                  { value: 'BY_ALLOCATION', label: 'By Allocation', icon: Calculator },
                  { value: 'BY_HOURS', label: 'By Hours', icon: Settings },
                  { value: 'BY_ROLE', label: 'By Role', icon: Users },
                  { value: 'CUSTOM', label: 'Custom', icon: PieChart },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
                    splitMethod === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => calculateSplits(value)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Member Splits */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Member Splits</h3>
          {!readOnly && (
            <button
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
              onClick={() => calculateSplits(splitMethod)}
            >
              <RefreshCcw className="h-4 w-4" />
              Recalculate
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {splits.map((split) => (
            <div
              key={split.memberId}
              className="flex items-center gap-4 rounded-lg border border-gray-200 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                {split.memberName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>

              <div className="flex-1">
                <p className="font-medium text-gray-900">{split.memberName}</p>
                <p className="text-sm text-gray-500">{split.role}</p>
                {split.hoursWorked !== undefined && (
                  <p className="text-xs text-gray-400">{split.hoursWorked} hours logged</p>
                )}
              </div>

              <div className="flex items-center gap-4">
                {readOnly ? (
                  <span className="text-lg font-medium text-gray-900">
                    {split.percentage.toFixed(1)}%
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className="w-20 rounded border border-gray-200 p-2 text-right"
                      max="100"
                      min="0"
                      step="0.1"
                      type="number"
                      value={split.percentage.toFixed(1)}
                      onChange={(e) =>
                        updateMemberPercentage(split.memberId, parseFloat(e.target.value) || 0)
                      }
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                )}
                <div className="w-32 text-right">
                  <div className="font-bold text-gray-900">{formatCurrency(split.amount)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Validation */}
        <div
          className={`mt-4 flex items-center justify-between rounded-lg p-4 ${
            isValid ? 'bg-green-50' : 'bg-yellow-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {isValid ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-700">Distribution is valid (100%)</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-700">
                  Total is {totalPercentage.toFixed(1)}% - must equal 100%
                </span>
              </>
            )}
          </div>
          <div className="text-lg font-bold">
            {formatCurrency(splits.reduce((sum, s) => sum + s.amount, 0))}
          </div>
        </div>
      </div>

      {/* Visual Chart */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Distribution Chart</h3>
        <div className="flex items-center gap-4">
          {/* Simple bar chart visualization */}
          <div className="flex h-8 flex-1 overflow-hidden rounded-full bg-gray-100">
            {splits.map((split, index) => {
              const colors = [
                'bg-blue-500',
                'bg-green-500',
                'bg-purple-500',
                'bg-orange-500',
                'bg-pink-500',
                'bg-teal-500',
                'bg-indigo-500',
                'bg-red-500',
              ];
              return (
                <div
                  key={split.memberId}
                  className={`${colors[index % colors.length]} transition-all duration-300`}
                  style={{ width: `${split.percentage}%` }}
                  title={`${split.memberName}: ${split.percentage.toFixed(1)}%`}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          {splits.map((split, index) => {
            const colors = [
              'bg-blue-500',
              'bg-green-500',
              'bg-purple-500',
              'bg-orange-500',
              'bg-pink-500',
              'bg-teal-500',
              'bg-indigo-500',
              'bg-red-500',
            ];
            return (
              <div key={split.memberId} className="flex items-center gap-2 text-sm">
                <div className={`h-3 w-3 rounded ${colors[index % colors.length]}`} />
                <span className="text-gray-700">
                  {split.memberName} ({split.percentage.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-4">
          <button
            className="rounded-lg border border-gray-200 px-6 py-2 hover:bg-gray-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving || !isValid}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Splits
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
