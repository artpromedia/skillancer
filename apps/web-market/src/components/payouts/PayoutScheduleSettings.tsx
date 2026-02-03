'use client';

/**
 * Payout Schedule Settings Component
 *
 * Allows users to configure automatic payout settings.
 */

import {
  Calendar,
  Clock,
  DollarSign,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import type { PayoutFrequency } from '@/lib/api/payouts';

import {
  usePayoutSchedule,
  useUpdatePayoutSchedule,
  formatCurrency,
  getFrequencyLabel,
  getDayOfWeekName,
  getDaySuffix,
} from '@/hooks/use-payouts';

// ============================================================================
// Types
// ============================================================================

interface PayoutScheduleSettingsProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PayoutScheduleSettings({ className = '' }: Readonly<PayoutScheduleSettingsProps>) {
  const { data: schedule, isLoading, error: loadError } = usePayoutSchedule();
  const updateSchedule = useUpdatePayoutSchedule();

  // Form state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [frequency, setFrequency] = useState('WEEKLY' as PayoutFrequency);
  const [dayOfWeek, setDayOfWeek] = useState<number>(5); // Friday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [minimumAmount, setMinimumAmount] = useState<string>('50');
  const [currency, setCurrency] = useState<string>('USD');
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Populate form with existing schedule
  useEffect(() => {
    if (schedule) {
      setFrequency(schedule.frequency);
      setDayOfWeek(schedule.dayOfWeek ?? 5);
      setDayOfMonth(schedule.dayOfMonth ?? 1);
      setMinimumAmount(schedule.minimumAmount.toString());
      setCurrency(schedule.currency);
      setAutoPayoutEnabled(schedule.autoPayoutEnabled);
    }
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      await updateSchedule.mutateAsync({
        frequency,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : undefined,
        dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : undefined,
        minimumAmount: Number.parseFloat(minimumAmount) || 50,
        currency,
        autoPayoutEnabled,
      });

      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    }
  };

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{loadError.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payout Schedule</h3>
            <p className="text-sm text-gray-500">Configure automatic payout settings</p>
          </div>
        </div>
        {!isEditing && (
          <button
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setIsEditing(true)}
          >
            <Settings className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            Schedule updated successfully!
          </div>
        )}

        {isEditing ? (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            {/* Auto Payout Toggle */}
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <p className="font-medium text-gray-900">Automatic Payouts</p>
                <p className="text-sm text-gray-500">Automatically withdraw funds on schedule</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <span className="sr-only">Enable automatic payouts</span>
                <input
                  checked={autoPayoutEnabled}
                  className="peer sr-only"
                  type="checkbox"
                  onChange={(e) => setAutoPayoutEnabled(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300" />
              </label>
            </div>

            {autoPayoutEnabled && (
              <>
                {/* Frequency Selection */}
                <div className="mt-6">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="frequency-select"
                  >
                    Frequency
                  </label>
                  <select
                    className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    id="frequency-select"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as PayoutFrequency)}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Every 2 Weeks</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="MANUAL">Manual Only</option>
                  </select>
                </div>

                {/* Day of Week (for weekly) */}
                {frequency === 'WEEKLY' && (
                  <div className="mt-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="day-of-week-select"
                    >
                      Day of Week
                    </label>
                    <select
                      className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="day-of-week-select"
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number.parseInt(e.target.value, 10))}
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <option key={day} value={day}>
                          {getDayOfWeekName(day)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Day of Month (for monthly) */}
                {frequency === 'MONTHLY' && (
                  <div className="mt-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="day-of-month-select"
                    >
                      Day of Month
                    </label>
                    <select
                      className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="day-of-month-select"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number.parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {getDaySuffix(day)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Minimum Amount */}
                <div className="mt-4">
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor="minimum-amount-input"
                  >
                    Minimum Amount
                  </label>
                  <p className="text-xs text-gray-500">
                    Payouts will only trigger when balance exceeds this amount
                  </p>
                  <div className="mt-2 flex rounded-lg border border-gray-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                    <span className="flex items-center border-r border-gray-300 bg-gray-50 px-3 text-gray-500">
                      {currency}
                    </span>
                    <input
                      className="block w-full rounded-r-lg border-0 py-2.5 pl-4 pr-4 focus:outline-none"
                      id="minimum-amount-input"
                      min="25"
                      placeholder="50"
                      step="1"
                      type="number"
                      value={minimumAmount}
                      onChange={(e) => setMinimumAmount(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Form Actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={updateSchedule.isPending}
                type="submit"
              >
                {updateSchedule.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
              <button
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Display Mode */
          <div className="space-y-4">
            {/* Auto Payout Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Automatic Payouts</span>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  schedule?.autoPayoutEnabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {schedule?.autoPayoutEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {schedule?.autoPayoutEnabled && (
              <>
                {/* Frequency */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Frequency</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {getFrequencyLabel(schedule.frequency)}
                    {schedule.frequency === 'WEEKLY' && schedule.dayOfWeek !== undefined && (
                      <span className="text-gray-500">
                        {' '}
                        ({getDayOfWeekName(schedule.dayOfWeek)})
                      </span>
                    )}
                    {Boolean(schedule.frequency === 'MONTHLY' && schedule.dayOfMonth) && (
                      <span className="text-gray-500"> (Day {schedule.dayOfMonth})</span>
                    )}
                  </span>
                </div>

                {/* Minimum Amount */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Minimum Amount</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(schedule.minimumAmount, schedule.currency)}
                  </span>
                </div>

                {/* Next Scheduled Payout */}
                {schedule.nextScheduledAt && (
                  <div className="mt-4 rounded-lg bg-indigo-50 p-4">
                    <p className="text-sm text-indigo-700">
                      <strong>Next scheduled payout:</strong>{' '}
                      {new Date(schedule.nextScheduledAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Last Payout */}
            {schedule?.lastPayoutAt && (
              <div className="mt-2 text-xs text-gray-500">
                Last payout: {new Date(schedule.lastPayoutAt).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PayoutScheduleSettings;
