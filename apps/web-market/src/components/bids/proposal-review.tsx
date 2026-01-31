/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * ProposalReview Component
 *
 * Detailed review panel for a single proposal.
 * Shows complete proposal information with action buttons.
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@skillancer/ui';
import {
  Archive,
  BookmarkPlus,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  ThumbsDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { FreelancerPreview } from './freelancer-preview';

import type { Proposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface ProposalReviewProps {
  proposal: Proposal;
  onShortlist?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDecline?: (id: string) => void;
  onHire?: (proposal: Proposal) => void;
  onMessage?: (proposal: Proposal) => void;
  onScheduleInterview?: (proposal: Proposal) => void;
  isLoading?: {
    shortlist?: boolean;
    archive?: boolean;
    decline?: boolean;
  };
  showActions?: boolean;
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'SUBMITTED':
    case 'VIEWED':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'SHORTLISTED':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'INTERVIEWING':
    case 'INTERVIEW':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'HIRED':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'DECLINED':
    case 'WITHDRAWN':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'ARCHIVED':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getMatchScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

// ============================================================================
// Component
// ============================================================================

export function ProposalReview({
  proposal,
  onShortlist,
  onArchive,
  onDecline,
  onHire,
  onMessage,
  onScheduleInterview,
  isLoading = {},
  showActions = true,
  compact = false,
}: Readonly<ProposalReviewProps>) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(date);
  };

  const canShortlist = ['SUBMITTED', 'VIEWED'].includes(proposal.status);
  const canDecline = ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(proposal.status);
  const canHire = ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'INTERVIEWING'].includes(proposal.status);
  const canArchive = !['HIRED', 'ARCHIVED'].includes(proposal.status);
  const canScheduleInterview = ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(proposal.status);

  return (
    <Card className="overflow-hidden">
      {/* Boost Banner */}
      {proposal.boostType && (
        <div
          className={cn(
            'px-4 py-1.5 text-center text-xs font-medium text-white',
            proposal.boostType === 'PREMIUM' && 'bg-gradient-to-r from-purple-500 to-pink-500',
            proposal.boostType === 'FEATURED' && 'bg-gradient-to-r from-blue-500 to-cyan-500',
            proposal.boostType === 'BASIC' && 'bg-slate-500'
          )}
        >
          <Zap className="mr-1 inline h-3.5 w-3.5" />
          {proposal.boostType} Boosted Proposal
        </div>
      )}

      <CardContent className={cn('p-6', compact && 'p-4')}>
        {/* Header with Status and Match Score */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn('border', getStatusBadgeStyle(proposal.status))} variant="outline">
              {proposal.status}
            </Badge>
            {proposal.clientViewed && (
              <Badge className="border-green-200 bg-green-100 text-green-700" variant="outline">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Viewed
              </Badge>
            )}
          </div>

          {proposal.matchScore && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1',
                      getMatchScoreColor(proposal.matchScore.overall)
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-semibold">{proposal.matchScore.overall}%</span>
                    <span className="text-muted-foreground text-xs">match</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Match Score Breakdown</p>
                  <div className="mt-1 space-y-1 text-xs">
                    <p>Skills: {proposal.matchScore.breakdown.skillsMatch}%</p>
                    <p>Experience: {proposal.matchScore.breakdown.experienceRelevance}%</p>
                    <p>Rate: {proposal.matchScore.breakdown.rateCompetitiveness}%</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Freelancer Section */}
        <FreelancerPreview
          compact={compact}
          freelancer={proposal.freelancer}
          showActions={false}
          onMessage={onMessage ? () => onMessage(proposal) : undefined}
        />

        <Separator className="my-4" />

        {/* Bid Details */}
        <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
          <div>
            <p className="text-muted-foreground text-xs">Bid Amount</p>
            <p className="text-xl font-bold">
              {formatCurrency(proposal.bidAmount)}
              {proposal.contractType === 'HOURLY' && (
                <span className="text-muted-foreground text-sm font-normal">/hr</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Delivery Time</p>
            <p className="text-xl font-bold">{proposal.deliveryDays} days</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Contract Type</p>
            <p className="text-xl font-bold">{proposal.contractType}</p>
          </div>
        </div>

        {/* Cover Letter */}
        <div className="mb-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium">
            <FileText className="h-4 w-4" />
            Cover Letter
          </h4>
          <div
            className={cn('rounded-lg border bg-white p-4', compact && 'max-h-40 overflow-auto')}
          >
            <p className={cn('text-sm', compact ? 'line-clamp-4' : 'whitespace-pre-wrap')}>
              {proposal.coverLetter}
            </p>
          </div>
        </div>

        {/* Milestones (if present) */}
        {!compact && proposal.milestones && proposal.milestones.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 font-medium">Proposed Milestones</h4>
            <div className="space-y-2">
              {proposal.milestones.map((milestone, index) => (
                <div key={milestone.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{milestone.title}</p>
                    {milestone.description && (
                      <p className="text-muted-foreground text-sm">{milestone.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(milestone.amount)}</p>
                    <p className="text-muted-foreground text-xs">{milestone.durationDays} days</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {!compact && proposal.attachments && proposal.attachments.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <Paperclip className="h-4 w-4" />
              Attachments ({proposal.attachments.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {proposal.attachments.map((attachment) => (
                <Button key={attachment.id} asChild size="sm" variant="outline">
                  <a download href={attachment.url}>
                    <Download className="mr-1 h-3 w-3" />
                    {attachment.filename}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Submission Time */}
        <p className="text-muted-foreground mb-4 text-sm">
          Submitted {timeAgo(proposal.submittedAt)}
        </p>

        {/* Actions */}
        {showActions && (
          <div className="flex flex-wrap gap-2">
            {canHire && onHire && (
              <Button className="flex-1" onClick={() => onHire(proposal)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Hire
              </Button>
            )}

            {canShortlist && onShortlist && (
              <Button
                disabled={isLoading.shortlist}
                variant="outline"
                onClick={() => onShortlist(proposal.id)}
              >
                {isLoading.shortlist ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                )}
                Shortlist
              </Button>
            )}

            {canScheduleInterview && onScheduleInterview && (
              <Button variant="outline" onClick={() => onScheduleInterview(proposal)}>
                <Calendar className="mr-2 h-4 w-4" />
                Interview
              </Button>
            )}

            {onMessage && (
              <Button variant="outline" onClick={() => onMessage(proposal)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Message
              </Button>
            )}

            {canDecline && onDecline && (
              <Button
                disabled={isLoading.decline}
                variant="outline"
                onClick={() => onDecline(proposal.id)}
              >
                {isLoading.decline ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown className="mr-2 h-4 w-4" />
                )}
                Decline
              </Button>
            )}

            {canArchive && onArchive && (
              <Button
                disabled={isLoading.archive}
                variant="ghost"
                onClick={() => onArchive(proposal.id)}
              >
                {isLoading.archive ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-2 h-4 w-4" />
                )}
                Archive
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
