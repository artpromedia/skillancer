/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

import { cn } from '../lib/utils';

import type * as React from 'react';

// ============================================================================
// Types
// ============================================================================

export type StatusBadgeStatus =
  | 'pending'
  | 'active'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

export type StatusBadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  status: StatusBadgeStatus;
  label: string;
  icon?: React.ReactNode;
  size?: StatusBadgeSize;
  variant?: 'solid' | 'outline' | 'subtle';
  pulse?: boolean;
  className?: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

const statusConfig: Record<
  StatusBadgeStatus,
  { solid: string; outline: string; subtle: string; dot: string }
> = {
  pending: {
    solid: 'bg-amber-500 text-white border-amber-500',
    outline: 'border-amber-500 text-amber-600 bg-transparent',
    subtle: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  active: {
    solid: 'bg-blue-500 text-white border-blue-500',
    outline: 'border-blue-500 text-blue-600 bg-transparent',
    subtle: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  success: {
    solid: 'bg-green-500 text-white border-green-500',
    outline: 'border-green-500 text-green-600 bg-transparent',
    subtle: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  warning: {
    solid: 'bg-orange-500 text-white border-orange-500',
    outline: 'border-orange-500 text-orange-600 bg-transparent',
    subtle: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
  },
  error: {
    solid: 'bg-red-500 text-white border-red-500',
    outline: 'border-red-500 text-red-600 bg-transparent',
    subtle: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
  info: {
    solid: 'bg-cyan-500 text-white border-cyan-500',
    outline: 'border-cyan-500 text-cyan-600 bg-transparent',
    subtle: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
  },
  neutral: {
    solid: 'bg-gray-500 text-white border-gray-500',
    outline: 'border-gray-400 text-gray-600 bg-transparent',
    subtle: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-500',
  },
};

const sizeConfig: Record<StatusBadgeSize, { badge: string; dot: string; icon: string }> = {
  sm: { badge: 'text-xs px-2 py-0.5 gap-1', dot: 'h-1.5 w-1.5', icon: 'h-3 w-3' },
  md: { badge: 'text-sm px-2.5 py-1 gap-1.5', dot: 'h-2 w-2', icon: 'h-4 w-4' },
  lg: { badge: 'text-base px-3 py-1.5 gap-2', dot: 'h-2.5 w-2.5', icon: 'h-5 w-5' },
};

// ============================================================================
// StatusBadge Component
// ============================================================================

export function StatusBadge({
  status,
  label,
  icon,
  size = 'md',
  variant = 'subtle',
  pulse = false,
  className,
}: StatusBadgeProps) {
  const statusStyles = statusConfig[status];
  const sizeStyles = sizeConfig[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        statusStyles[variant],
        sizeStyles.badge,
        className
      )}
    >
      {/* Pulse dot or custom icon */}
      {icon ? (
        <span className={sizeStyles.icon}>{icon}</span>
      ) : (
        <span className="relative flex">
          <span
            className={cn(
              'rounded-full',
              statusStyles.dot,
              sizeStyles.dot,
              pulse && 'absolute animate-ping opacity-75'
            )}
          />
          {pulse && (
            <span className={cn('relative rounded-full', statusStyles.dot, sizeStyles.dot)} />
          )}
          {!pulse && <span className={cn('rounded-full', statusStyles.dot, sizeStyles.dot)} />}
        </span>
      )}
      {label}
    </span>
  );
}

// ============================================================================
// Preset Status Badges
// ============================================================================

export interface PresetBadgeProps {
  size?: StatusBadgeSize;
  variant?: 'solid' | 'outline' | 'subtle';
  className?: string;
}

// Proposal Status Badges
export function ProposalDraftBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Draft" status="neutral" {...props} />;
}

export function ProposalSubmittedBadge(props: PresetBadgeProps) {
  return <StatusBadge pulse label="Submitted" status="active" {...props} />;
}

export function ProposalViewedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Viewed" status="info" {...props} />;
}

export function ProposalShortlistedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Shortlisted" status="success" {...props} />;
}

export function ProposalRejectedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Rejected" status="error" {...props} />;
}

export function ProposalWithdrawnBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Withdrawn" status="neutral" {...props} />;
}

export function ProposalHiredBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Hired" status="success" {...props} />;
}

// Job Status Badges
export function JobOpenBadge(props: PresetBadgeProps) {
  return <StatusBadge pulse label="Open" status="success" {...props} />;
}

export function JobClosedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Closed" status="neutral" {...props} />;
}

export function JobInProgressBadge(props: PresetBadgeProps) {
  return <StatusBadge label="In Progress" status="active" {...props} />;
}

export function JobCompletedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Completed" status="success" {...props} />;
}

// Contract Status Badges
export function ContractPendingBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Pending" status="pending" {...props} />;
}

export function ContractActiveBadge(props: PresetBadgeProps) {
  return <StatusBadge pulse label="Active" status="active" {...props} />;
}

export function ContractCompletedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Completed" status="success" {...props} />;
}

export function ContractDisputedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Disputed" status="error" {...props} />;
}

export function ContractCancelledBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Cancelled" status="neutral" {...props} />;
}

// Payment Status Badges
export function PaymentPendingBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Pending" status="pending" {...props} />;
}

export function PaymentProcessingBadge(props: PresetBadgeProps) {
  return <StatusBadge pulse label="Processing" status="active" {...props} />;
}

export function PaymentCompletedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Paid" status="success" {...props} />;
}

export function PaymentFailedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Failed" status="error" {...props} />;
}

export function PaymentRefundedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Refunded" status="warning" {...props} />;
}

// Verification Status Badges
export function VerifiedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Verified" status="success" {...props} />;
}

export function UnverifiedBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Unverified" status="warning" {...props} />;
}

export function PendingVerificationBadge(props: PresetBadgeProps) {
  return <StatusBadge label="Pending Review" status="pending" {...props} />;
}

// ============================================================================
// Status Badge Factory
// ============================================================================

export type ProposalStatus =
  | 'draft'
  | 'submitted'
  | 'viewed'
  | 'shortlisted'
  | 'rejected'
  | 'withdrawn'
  | 'hired';

export type JobStatus = 'open' | 'closed' | 'in_progress' | 'completed';
export type ContractStatus = 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export function getProposalStatusBadge(status: ProposalStatus, props?: PresetBadgeProps) {
  const badges: Record<ProposalStatus, () => React.ReactElement> = {
    draft: () => <ProposalDraftBadge {...props} />,
    submitted: () => <ProposalSubmittedBadge {...props} />,
    viewed: () => <ProposalViewedBadge {...props} />,
    shortlisted: () => <ProposalShortlistedBadge {...props} />,
    rejected: () => <ProposalRejectedBadge {...props} />,
    withdrawn: () => <ProposalWithdrawnBadge {...props} />,
    hired: () => <ProposalHiredBadge {...props} />,
  };
  return badges[status]();
}

export function getJobStatusBadge(status: JobStatus, props?: PresetBadgeProps) {
  const badges: Record<JobStatus, () => React.ReactElement> = {
    open: () => <JobOpenBadge {...props} />,
    closed: () => <JobClosedBadge {...props} />,
    in_progress: () => <JobInProgressBadge {...props} />,
    completed: () => <JobCompletedBadge {...props} />,
  };
  return badges[status]();
}

export function getContractStatusBadge(status: ContractStatus, props?: PresetBadgeProps) {
  const badges: Record<ContractStatus, () => React.ReactElement> = {
    pending: () => <ContractPendingBadge {...props} />,
    active: () => <ContractActiveBadge {...props} />,
    completed: () => <ContractCompletedBadge {...props} />,
    disputed: () => <ContractDisputedBadge {...props} />,
    cancelled: () => <ContractCancelledBadge {...props} />,
  };
  return badges[status]();
}

export function getPaymentStatusBadge(status: PaymentStatus, props?: PresetBadgeProps) {
  const badges: Record<PaymentStatus, () => React.ReactElement> = {
    pending: () => <PaymentPendingBadge {...props} />,
    processing: () => <PaymentProcessingBadge {...props} />,
    completed: () => <PaymentCompletedBadge {...props} />,
    failed: () => <PaymentFailedBadge {...props} />,
    refunded: () => <PaymentRefundedBadge {...props} />,
  };
  return badges[status]();
}
