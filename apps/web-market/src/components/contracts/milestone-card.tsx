/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * MilestoneCard Component
 *
 * Individual milestone card showing status, amount, due date,
 * and available actions based on user role and milestone status.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import { cn } from '@skillancer/ui/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  Upload,
  RotateCcw,
  Eye,
  Calendar,
  Loader2,
} from 'lucide-react';

import { type Milestone, type MilestoneStatus, getMilestoneStatusInfo } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

export interface MilestoneCardProps {
  milestone: Milestone;
  isClient?: boolean;
  isLoading?: boolean;
  onSubmit?: () => void;
  onApprove?: () => void;
  onRequestRevision?: () => void;
  onFund?: () => void;
  onViewSubmission?: () => void;
  onEdit?: () => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const statusIcons: Record<MilestoneStatus, typeof Circle> = {
  PENDING: Circle,
  FUNDED: DollarSign,
  IN_PROGRESS: Clock,
  SUBMITTED: FileText,
  REVISION_REQUESTED: RotateCcw,
  APPROVED: CheckCircle2,
  RELEASED: CheckCircle2,
};

const statusColors: Record<MilestoneStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  FUNDED: 'bg-green-50 text-green-700 border-green-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  REVISION_REQUESTED: 'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  RELEASED: 'bg-green-100 text-green-800 border-green-300',
};

// ============================================================================
// Component
// ============================================================================

export function MilestoneCard({
  milestone,
  isClient = false,
  isLoading = false,
  onSubmit,
  onApprove,
  onRequestRevision,
  onFund,
  onViewSubmission,
  onEdit,
  className,
}: Readonly<MilestoneCardProps>) {
  const StatusIcon = statusIcons[milestone.status];
  const statusInfo = getMilestoneStatusInfo(milestone.status);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const isCompleted = milestone.status === 'APPROVED' || milestone.status === 'RELEASED';
  const isPending = milestone.status === 'PENDING';
  const canSubmit =
    !isClient &&
    (milestone.status === 'FUNDED' ||
      milestone.status === 'IN_PROGRESS' ||
      milestone.status === 'REVISION_REQUESTED');
  const canFund = isClient && milestone.status === 'PENDING';
  const canReview = isClient && milestone.status === 'SUBMITTED';

  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                statusColors[milestone.status]
              )}
            >
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{milestone.title}</CardTitle>
              {milestone.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {milestone.description}
                </CardDescription>
              )}
            </div>
          </div>
          <Badge className={cn('shrink-0', statusColors[milestone.status])} variant="outline">
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Amount and Due Date */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <DollarSign className="text-muted-foreground h-4 w-4" />
              <span className="font-semibold">{formatCurrency(milestone.amount)}</span>
            </div>
            {milestone.dueDate && (
              <div className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Due {format(new Date(milestone.dueDate), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
          {milestone.escrowFunded && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-green-50 text-green-700" variant="secondary">
                    <DollarSign className="mr-1 h-3 w-3" />
                    Escrow Funded
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Payment is secured in escrow and will be released upon approval
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Deliverables */}
        {milestone.deliverables && milestone.deliverables.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium">Deliverables:</p>
            <ul className="space-y-1 text-sm">
              {milestone.deliverables.map((deliverable) => (
                <li
                  key={`deliverable-${deliverable.slice(0, 20)}`}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2
                    className={cn(
                      'h-4 w-4',
                      isCompleted ? 'text-green-600' : 'text-muted-foreground'
                    )}
                  />
                  <span className={cn(isCompleted && 'line-through opacity-60')}>
                    {deliverable}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submission Info */}
        {milestone.submission && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Submitted Work</p>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(milestone.submission.submittedAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <p className="line-clamp-2 text-sm">{milestone.submission.message}</p>
            {milestone.submission.attachments.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <FileText className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs">
                  {milestone.submission.attachments.length} attachment(s)
                </span>
              </div>
            )}
            {onViewSubmission && (
              <Button
                className="mt-2 h-auto p-0"
                size="sm"
                variant="link"
                onClick={onViewSubmission}
              >
                <Eye className="mr-1 h-3 w-3" />
                View Details
              </Button>
            )}
          </div>
        )}

        {/* Revision Request */}
        {milestone.revision && milestone.status === 'REVISION_REQUESTED' && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-800">Revision Requested</p>
            </div>
            <p className="text-sm text-orange-700">{milestone.revision.notes}</p>
            <span className="text-muted-foreground mt-1 text-xs">
              {formatDistanceToNow(new Date(milestone.revision.requestedAt), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {/* Client Actions */}
          {canFund && onFund && (
            <Button disabled={isLoading} size="sm" onClick={onFund}>
              {isLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="mr-1 h-4 w-4" />
              )}
              Fund Milestone
            </Button>
          )}

          {canReview && (
            <>
              {onApprove && (
                <Button disabled={isLoading} size="sm" onClick={onApprove}>
                  {isLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                  )}
                  Approve & Release
                </Button>
              )}
              {onRequestRevision && (
                <Button
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  onClick={onRequestRevision}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Request Revision
                </Button>
              )}
            </>
          )}

          {/* Freelancer Actions */}
          {canSubmit && onSubmit && (
            <Button disabled={isLoading} size="sm" onClick={onSubmit}>
              {isLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              Submit Work
            </Button>
          )}

          {/* Edit Action (Client only, pending status) */}
          {isClient && isPending && onEdit && (
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MilestoneCard;
