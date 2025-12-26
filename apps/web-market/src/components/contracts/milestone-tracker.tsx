/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

/**
 * MilestoneTracker Component
 *
 * Visual timeline of contract milestones with progress tracking,
 * submission workflows, and payment status.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Progress,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
} from '@skillancer/ui';
import { cn } from '@skillancer/ui/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { useState } from 'react';

import { type Milestone, type MilestoneStatus, getMilestoneStatusInfo } from '@/lib/api/contracts';

interface MilestoneTrackerProps {
  milestones: Milestone[];
  isClient?: boolean;
  onSubmitMilestone?: (milestoneId: string) => void;
  onApproveMilestone?: (milestoneId: string) => void;
  onRequestRevision?: (milestoneId: string) => void;
  onFundMilestone?: (milestoneId: string) => void;
  onViewSubmission?: (milestoneId: string) => void;
}

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
  PENDING: 'text-muted-foreground',
  FUNDED: 'text-green-600',
  IN_PROGRESS: 'text-blue-600',
  SUBMITTED: 'text-amber-600',
  REVISION_REQUESTED: 'text-orange-600',
  APPROVED: 'text-green-600',
  RELEASED: 'text-green-600',
};

export function MilestoneTracker({
  milestones,
  isClient = true,
  onSubmitMilestone,
  onApproveMilestone,
  onRequestRevision,
  onFundMilestone,
  onViewSubmission,
}: MilestoneTrackerProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<string[]>([]);

  const toggleExpanded = (id: string) => {
    setExpandedMilestones((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const completedCount = milestones.filter(
    (m) => m.status === 'APPROVED' || m.status === 'RELEASED'
  ).length;

  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const releasedAmount = milestones
    .filter((m) => m.status === 'RELEASED')
    .reduce((sum, m) => sum + m.amount, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const getActionButton = (milestone: Milestone) => {
    if (isClient) {
      switch (milestone.status) {
        case 'PENDING':
          return (
            <Button size="sm" onClick={() => onFundMilestone?.(milestone.id)}>
              <DollarSign className="mr-1 h-4 w-4" />
              Fund Milestone
            </Button>
          );
        case 'SUBMITTED':
          return (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onApproveMilestone?.(milestone.id)}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onRequestRevision?.(milestone.id)}>
                <RotateCcw className="mr-1 h-4 w-4" />
                Request Revision
              </Button>
            </div>
          );
        default:
          return null;
      }
    } else {
      switch (milestone.status) {
        case 'FUNDED':
        case 'IN_PROGRESS':
        case 'REVISION_REQUESTED':
          return (
            <Button size="sm" onClick={() => onSubmitMilestone?.(milestone.id)}>
              <Upload className="mr-1 h-4 w-4" />
              Submit Work
            </Button>
          );
        default:
          return null;
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>
              {completedCount} of {milestones.length} milestones completed
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-sm">Total Value</p>
            <p className="text-lg font-semibold">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <Progress className="mt-4 h-2" value={(completedCount / milestones.length) * 100} />
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.map((milestone, index) => {
          const StatusIcon = statusIcons[milestone.status];
          const statusInfo = getMilestoneStatusInfo(milestone.status);
          const isExpanded = expandedMilestones.includes(milestone.id);
          const isLast = index === milestones.length - 1;

          return (
            <div key={milestone.id} className="relative">
              {/* Timeline connector */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-5 top-12 h-full w-px',
                    milestone.status === 'RELEASED' || milestone.status === 'APPROVED'
                      ? 'bg-green-200'
                      : 'bg-border'
                  )}
                />
              )}

              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(milestone.id)}>
                <div className="flex gap-4">
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                      milestone.status === 'RELEASED' || milestone.status === 'APPROVED'
                        ? 'border-green-600 bg-green-50'
                        : 'border-border bg-background'
                    )}
                  >
                    <StatusIcon className={cn('h-5 w-5', statusColors[milestone.status])} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{milestone.title}</h4>
                          <Badge className={statusInfo.color} variant="secondary">
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Due{' '}
                          {new Date(milestone.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(milestone.amount)}</p>
                        <CollapsibleTrigger asChild>
                          <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    {/* Quick Action */}
                    <div className="flex items-center gap-2">
                      {getActionButton(milestone)}
                      {milestone.submission && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewSubmission?.(milestone.id)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View Submission
                        </Button>
                      )}
                    </div>

                    <CollapsibleContent className="pt-2">
                      <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
                        {milestone.description && (
                          <div>
                            <h5 className="mb-1 text-sm font-medium">Description</h5>
                            <p className="text-muted-foreground text-sm">{milestone.description}</p>
                          </div>
                        )}

                        {milestone.deliverables && milestone.deliverables.length > 0 && (
                          <div>
                            <h5 className="mb-2 text-sm font-medium">Deliverables</h5>
                            <ul className="space-y-1">
                              {milestone.deliverables.map((d, i) => (
                                <li
                                  key={i}
                                  className="text-muted-foreground flex items-center gap-2 text-sm"
                                >
                                  <CheckCircle2 className="text-muted-foreground h-3 w-3" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Submission Details */}
                        {milestone.submission && (
                          <>
                            <Separator />
                            <div>
                              <h5 className="mb-2 text-sm font-medium">Latest Submission</h5>
                              <div className="space-y-2 text-sm">
                                <p className="text-muted-foreground">
                                  {milestone.submission.message}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  Submitted{' '}
                                  {formatDistanceToNow(new Date(milestone.submission.submittedAt))}{' '}
                                  ago
                                </p>
                                {milestone.submission.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-2">
                                    {milestone.submission.attachments.map((file) => (
                                      <a
                                        key={file.id}
                                        className="bg-background hover:bg-muted flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                                        href={file.url}
                                        rel="noopener noreferrer"
                                        target="_blank"
                                      >
                                        <FileText className="h-3 w-3" />
                                        {file.name}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Revision Details */}
                        {milestone.revisions && milestone.revisions.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h5 className="mb-2 flex items-center gap-2 text-sm font-medium">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                Revision Requested
                              </h5>
                              <p className="text-muted-foreground text-sm">
                                {milestone.revisions[milestone.revisions.length - 1].feedback}
                              </p>
                            </div>
                          </>
                        )}

                        {/* Timeline */}
                        <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                          {milestone.fundedAt && (
                            <span>Funded: {new Date(milestone.fundedAt).toLocaleDateString()}</span>
                          )}
                          {milestone.completedAt && (
                            <span>
                              Completed: {new Date(milestone.completedAt).toLocaleDateString()}
                            </span>
                          )}
                          {milestone.releasedAt && (
                            <span>
                              Released: {new Date(milestone.releasedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </div>
              </Collapsible>
            </div>
          );
        })}

        {/* Summary */}
        <Separator className="my-4" />
        <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
          <div>
            <p className="text-muted-foreground text-sm">Total Released</p>
            <p className="text-lg font-semibold text-green-600">{formatCurrency(releasedAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-sm">Remaining</p>
            <p className="text-lg font-semibold">{formatCurrency(totalAmount - releasedAmount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
