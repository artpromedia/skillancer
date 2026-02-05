'use client';

/**
 * EscrowStatus Component
 *
 * Displays the current status of an escrow account including
 * funded/released amounts, milestone progress, and status badges.
 *
 * @module components/escrow/EscrowStatus
 */

import {
  Shield,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
} from 'lucide-react';

import { useEscrowStatus, type EscrowStatusValue } from '@/hooks/api/use-payments';

// =============================================================================
// Types
// =============================================================================

interface EscrowStatusProps {
  escrowId: string;
  showMilestones?: boolean;
  showAmounts?: boolean;
  compact?: boolean;
}

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Shield;
  iconColor: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusConfig(status: EscrowStatusValue): StatusConfig {
  switch (status) {
    case 'PENDING_DEPOSIT':
      return {
        label: 'Awaiting Deposit',
        color: 'text-yellow-800',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: Clock,
        iconColor: 'text-yellow-500',
      };
    case 'FUNDED':
      return {
        label: 'Funded',
        color: 'text-green-800',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        iconColor: 'text-green-500',
      };
    case 'PARTIALLY_RELEASED':
      return {
        label: 'Partially Released',
        color: 'text-blue-800',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: ArrowUpCircle,
        iconColor: 'text-blue-500',
      };
    case 'RELEASED':
      return {
        label: 'Released',
        color: 'text-green-800',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        iconColor: 'text-green-500',
      };
    case 'DISPUTED':
      return {
        label: 'Disputed',
        color: 'text-red-800',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: AlertTriangle,
        iconColor: 'text-red-500',
      };
    case 'REFUNDED':
      return {
        label: 'Refunded',
        color: 'text-gray-800',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: ArrowDownCircle,
        iconColor: 'text-gray-500',
      };
    case 'CANCELED':
      return {
        label: 'Canceled',
        color: 'text-gray-800',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: XCircle,
        iconColor: 'text-gray-400',
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-gray-800',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: Shield,
        iconColor: 'text-gray-400',
      };
  }
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function getMilestoneStatusIcon(status: string) {
  switch (status) {
    case 'RELEASED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'ACTIVE':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'PENDING':
      return <Clock className="h-4 w-4 text-gray-400" />;
    case 'CANCELED':
      return <XCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getMilestoneStatusLabel(status: string): string {
  switch (status) {
    case 'RELEASED':
      return 'Released';
    case 'ACTIVE':
      return 'Active';
    case 'PENDING':
      return 'Pending';
    case 'CANCELED':
      return 'Canceled';
    default:
      return status;
  }
}

// =============================================================================
// Component
// =============================================================================

export function EscrowStatus({
  escrowId,
  showMilestones = true,
  showAmounts = true,
  compact = false,
}: EscrowStatusProps) {
  const { data: escrow, isLoading, error } = useEscrowStatus(escrowId);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="ml-2 text-sm text-gray-500">Loading escrow status...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'Failed to load escrow status'}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No Data
  // ---------------------------------------------------------------------------

  if (!escrow) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">No escrow information available.</p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(escrow.status);
  const StatusIcon = statusConfig.icon;

  // Calculate progress
  const progressPercent =
    escrow.totalAmount > 0
      ? Math.round((escrow.releasedAmount / escrow.totalAmount) * 100)
      : 0;

  // ---------------------------------------------------------------------------
  // Compact View
  // ---------------------------------------------------------------------------

  if (compact) {
    return (
      <div className={`rounded-lg border ${statusConfig.borderColor} ${statusConfig.bgColor} p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
            <span className={`text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          {showAmounts && (
            <span className="text-sm font-semibold text-gray-900">
              {formatCurrency(escrow.availableBalance, escrow.currency)}
            </span>
          )}
        </div>
        {showAmounts && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {formatCurrency(escrow.releasedAmount, escrow.currency)} of{' '}
              {formatCurrency(escrow.totalAmount, escrow.currency)} released
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Full View
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${statusConfig.bgColor}`}>
            <StatusIcon className={`h-5 w-5 ${statusConfig.iconColor}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Escrow</h3>
            <p className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Available</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(escrow.availableBalance, escrow.currency)}
          </p>
        </div>
      </div>

      {/* Amounts Grid */}
      {showAmounts && (
        <div className="grid grid-cols-3 gap-4 border-b border-gray-100 p-6">
          <div>
            <div className="flex items-center gap-1.5">
              <ArrowDownCircle className="h-4 w-4 text-green-500" />
              <p className="text-xs font-medium text-gray-500">Funded</p>
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(escrow.fundedAmount, escrow.currency)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
              <p className="text-xs font-medium text-gray-500">Released</p>
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(escrow.releasedAmount, escrow.currency)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-medium text-gray-500">Platform Fee</p>
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(escrow.platformFee, escrow.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {showAmounts && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Release Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestones */}
      {showMilestones && escrow.milestones && escrow.milestones.length > 0 && (
        <div className="p-6">
          <h4 className="text-sm font-semibold text-gray-900">Milestones</h4>
          <div className="mt-3 space-y-3">
            {escrow.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
              >
                <div className="flex items-center gap-3">
                  {getMilestoneStatusIcon(milestone.status)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{milestone.name}</p>
                    <p className="text-xs text-gray-500">
                      {getMilestoneStatusLabel(milestone.status)}
                      {milestone.dueDate && (
                        <span className="ml-2">
                          Due: {new Date(milestone.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(milestone.amount, escrow.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disputed Warning */}
      {escrow.status === 'DISPUTED' && (
        <div className="border-t border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">Funds Frozen</p>
              <p className="mt-1 text-xs text-red-600">
                This escrow is under dispute. Funds are frozen until the dispute is resolved.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EscrowStatus;
