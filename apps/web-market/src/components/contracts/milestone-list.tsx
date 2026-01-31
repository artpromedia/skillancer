/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * MilestoneList Component
 *
 * Displays a list of contract milestones with summary stats,
 * filtering, and action buttons based on user role.
 */

import {
  Card,
  CardContent,
  Button,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@skillancer/ui';
import { cn } from '@skillancer/ui/lib/utils';
import { Plus, Filter, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { useState, useMemo } from 'react';

import { MilestoneCard } from './milestone-card';

import type { Milestone } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

export interface MilestoneListProps {
  milestones: Milestone[];
  isClient?: boolean;
  isLoading?: boolean;
  loadingMilestoneId?: string | null;
  onCreateMilestone?: () => void;
  onSubmitMilestone?: (milestoneId: string) => void;
  onApproveMilestone?: (milestoneId: string) => void;
  onRequestRevision?: (milestoneId: string) => void;
  onFundMilestone?: (milestoneId: string) => void;
  onViewSubmission?: (milestoneId: string) => void;
  onEditMilestone?: (milestoneId: string) => void;
  className?: string;
}

type FilterOption = 'all' | 'pending' | 'in-progress' | 'completed';

// ============================================================================
// Skeleton Component
// ============================================================================

function MilestoneListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-2 w-full" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function MilestoneList({
  milestones,
  isClient = false,
  isLoading = false,
  loadingMilestoneId = null,
  onCreateMilestone,
  onSubmitMilestone,
  onApproveMilestone,
  onRequestRevision,
  onFundMilestone,
  onViewSubmission,
  onEditMilestone,
  className,
}: Readonly<MilestoneListProps>) {
  const [filter, setFilter] = useState<FilterOption>('all');

  // Calculate stats
  const stats = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter(
      (m) => m.status === 'APPROVED' || m.status === 'RELEASED'
    ).length;
    const inProgress = milestones.filter(
      (m) =>
        m.status === 'IN_PROGRESS' || m.status === 'SUBMITTED' || m.status === 'REVISION_REQUESTED'
    ).length;
    const pending = milestones.filter(
      (m) => m.status === 'PENDING' || m.status === 'FUNDED'
    ).length;
    const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
    const releasedAmount = milestones
      .filter((m) => m.status === 'RELEASED')
      .reduce((sum, m) => sum + m.amount, 0);
    const escrowAmount = milestones
      .filter((m) => m.escrowFunded && m.status !== 'RELEASED')
      .reduce((sum, m) => sum + m.amount, 0);

    return {
      total,
      completed,
      inProgress,
      pending,
      totalAmount,
      releasedAmount,
      escrowAmount,
      progress: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [milestones]);

  // Filter milestones
  const filteredMilestones = useMemo(() => {
    switch (filter) {
      case 'pending':
        return milestones.filter((m) => m.status === 'PENDING' || m.status === 'FUNDED');
      case 'in-progress':
        return milestones.filter(
          (m) =>
            m.status === 'IN_PROGRESS' ||
            m.status === 'SUBMITTED' ||
            m.status === 'REVISION_REQUESTED'
        );
      case 'completed':
        return milestones.filter((m) => m.status === 'APPROVED' || m.status === 'RELEASED');
      default:
        return milestones;
    }
  }, [milestones, filter]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  if (isLoading) {
    return <MilestoneListSkeleton />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Milestones</h2>
          <p className="text-muted-foreground text-sm">
            {stats.completed} of {stats.total} milestones completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterOption)}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({stats.total})</SelectItem>
              <SelectItem value="pending">Pending ({stats.pending})</SelectItem>
              <SelectItem value="in-progress">In Progress ({stats.inProgress})</SelectItem>
              <SelectItem value="completed">Completed ({stats.completed})</SelectItem>
            </SelectContent>
          </Select>
          {isClient && onCreateMilestone && (
            <Button onClick={onCreateMilestone}>
              <Plus className="mr-2 h-4 w-4" />
              Add Milestone
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Value</p>
              <p className="text-lg font-semibold">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Released</p>
              <p className="text-lg font-semibold">{formatCurrency(stats.releasedAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-950">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">In Escrow</p>
              <p className="text-lg font-semibold">{formatCurrency(stats.escrowAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">Progress</p>
              <p className="text-sm font-medium">{Math.round(stats.progress)}%</p>
            </div>
            <Progress className="h-2" value={stats.progress} />
          </CardContent>
        </Card>
      </div>

      {/* Milestone List */}
      {filteredMilestones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-1 font-semibold">No Milestones Found</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              {filter === 'all'
                ? 'This contract has no milestones yet.'
                : `No milestones match the "${filter}" filter.`}
            </p>
            {isClient && onCreateMilestone && filter === 'all' && (
              <Button onClick={onCreateMilestone}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Milestone
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMilestones.map((milestone) => (
            <MilestoneCard
              key={milestone.id}
              isClient={isClient}
              isLoading={loadingMilestoneId === milestone.id}
              milestone={milestone}
              onApprove={onApproveMilestone ? () => onApproveMilestone(milestone.id) : undefined}
              onEdit={onEditMilestone ? () => onEditMilestone(milestone.id) : undefined}
              onFund={onFundMilestone ? () => onFundMilestone(milestone.id) : undefined}
              onRequestRevision={
                onRequestRevision ? () => onRequestRevision(milestone.id) : undefined
              }
              onSubmit={onSubmitMilestone ? () => onSubmitMilestone(milestone.id) : undefined}
              onViewSubmission={onViewSubmission ? () => onViewSubmission(milestone.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MilestoneList;
