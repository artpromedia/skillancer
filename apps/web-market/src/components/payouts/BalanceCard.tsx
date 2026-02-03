'use client';

/**
 * Balance Card Component
 *
 * Displays the user's available balance and pending earnings.
 */

import { DollarSign, TrendingUp, Clock, ArrowUpRight, Loader2 } from 'lucide-react';

import { useBalance, formatCurrency } from '@/hooks/use-payouts';

// ============================================================================
// Types
// ============================================================================

interface BalanceCardProps {
  onWithdraw?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BalanceCard({ onWithdraw, className = '' }: Readonly<BalanceCardProps>) {
  const { data: balance, isLoading, error } = useBalance({ refetchInterval: 30000 });

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-6 ${className}`}>
        <p className="text-center text-sm text-red-600">
          {error?.message || 'Failed to load balance'}
        </p>
      </div>
    );
  }

  // Get primary currency balance (USD by default)
  const primaryBalance = balance.balances.find((b) => b.currency === 'USD') ?? balance.balances[0];
  const totalAvailable = primaryBalance?.available ?? 0;
  const totalPending = primaryBalance?.pending ?? 0;
  const currency = primaryBalance?.currency ?? 'USD';

  // Calculate total pending releases
  const pendingReleases = balance.pendingReleases.reduce((sum, pr) => sum + pr.amount, 0);

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-white/20 p-2">
            <DollarSign className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-white/90">Available Balance</span>
        </div>
        {balance.nextScheduledPayout && (
          <div className="flex items-center gap-1 text-xs text-white/70">
            <Clock className="h-3 w-3" />
            Next payout: {new Date(balance.nextScheduledPayout).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Main Balance */}
      <div className="mt-4">
        <span className="text-4xl font-bold">{formatCurrency(totalAvailable, currency)}</span>
      </div>

      {/* Secondary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
        <div>
          <div className="flex items-center gap-1 text-xs text-white/70">
            <Clock className="h-3 w-3" />
            Pending
          </div>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(totalPending, currency)}</p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-white/70">
            <TrendingUp className="h-3 w-3" />
            Upcoming
          </div>
          <p className="mt-1 text-lg font-semibold">{formatCurrency(pendingReleases, currency)}</p>
        </div>
      </div>

      {/* Withdraw Button */}
      {onWithdraw && totalAvailable > 0 && (
        <button
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-indigo-600 transition-colors hover:bg-white/90"
          onClick={onWithdraw}
        >
          <ArrowUpRight className="h-4 w-4" />
          Withdraw Funds
        </button>
      )}

      {/* Lifetime Stats */}
      <div className="mt-4 flex items-center justify-between text-xs text-white/60">
        <span>Lifetime earned: {formatCurrency(balance.lifetimeStats.totalEarned, currency)}</span>
        <span>Total payouts: {balance.lifetimeStats.payoutCount}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Balance Display
// ============================================================================

interface CompactBalanceProps {
  className?: string;
}

export function CompactBalance({ className = '' }: Readonly<CompactBalanceProps>) {
  const { data: balance, isLoading } = useBalance();

  if (isLoading || !balance) {
    return <span className={`text-sm text-gray-500 ${className}`}>Loading...</span>;
  }

  const primaryBalance = balance.balances.find((b) => b.currency === 'USD') ?? balance.balances[0];
  const amount = primaryBalance?.available ?? 0;
  const currency = primaryBalance?.currency ?? 'USD';

  return (
    <span className={`font-semibold text-green-600 ${className}`}>
      {formatCurrency(amount, currency)}
    </span>
  );
}

export default BalanceCard;
