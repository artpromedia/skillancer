/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import {
  ArrowUpRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  Filter,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PencilLine,
  Search,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';


import { BidBoostModal } from '@/components/bids/bid-boost-modal';
import { getMyProposals, getProposalStatusInfo, withdrawProposal } from '@/lib/api/bids';

import type { Proposal, ProposalStatus } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

type FilterOption = 'all' | 'pending' | 'shortlisted' | 'interviewing' | 'hired' | 'declined';

// ============================================================================
// Proposal Card
// ============================================================================

function ProposalCard({
  proposal,
  onWithdraw,
  onBoost,
}: Readonly<{
  proposal: Proposal;
  onWithdraw: (id: string) => void;
  onBoost: (proposal: Proposal) => void;
}>) {
  const router = useRouter();
  const statusInfo = getProposalStatusInfo(proposal.status);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadgeStyle = (status: ProposalStatus) => {
    switch (status) {
      case 'SUBMITTED':
      case 'VIEWED':
        return 'bg-blue-100 text-blue-700';
      case 'SHORTLISTED':
        return 'bg-amber-100 text-amber-700';
      case 'INTERVIEWING':
        return 'bg-purple-100 text-purple-700';
      case 'HIRED':
        return 'bg-green-100 text-green-700';
      case 'DECLINED':
      case 'WITHDRAWN':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      {/* Boost indicator */}
      {proposal.boostType && (
        <div
          className={cn(
            'px-3 py-1 text-center text-xs font-medium text-white',
            proposal.boostType === 'PREMIUM' && 'bg-gradient-to-r from-purple-500 to-pink-500',
            proposal.boostType === 'FEATURED' && 'bg-gradient-to-r from-blue-500 to-cyan-500',
            proposal.boostType === 'BASIC' && 'bg-slate-500'
          )}
        >
          <Zap className="mr-1 inline h-3 w-3" />
          {proposal.boostType} Boosted
        </div>
      )}

      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Job info */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge className={getStatusBadgeStyle(proposal.status)} variant="secondary">
                {statusInfo.label}
              </Badge>
              {proposal.clientViewed && (
                <Badge className="bg-green-100 text-green-700" variant="secondary">
                  <Eye className="mr-1 h-3 w-3" />
                  Viewed
                </Badge>
              )}
            </div>

            <Link
              className="mb-1 line-clamp-2 text-lg font-semibold hover:underline"
              href={`/jobs/${proposal.job?.slug}`}
            >
              {proposal.job?.title}
            </Link>

            <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-3 text-sm">
              {proposal.job?.client && (
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={proposal.job.client.avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {proposal.job.client.name?.charAt(0) ?? 'C'}
                    </AvatarFallback>
                  </Avatar>
                  {proposal.job.client.name}
                </div>
              )}
              <span>•</span>
              <span>{timeAgo(proposal.submittedAt)}</span>
            </div>

            {/* Cover letter preview */}
            <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">
              {proposal.coverLetter}
            </p>

            {/* Bid details */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-semibold">{formatCurrency(proposal.bidAmount)}</span>
                {proposal.contractType === 'HOURLY' && (
                  <span className="text-muted-foreground">/hr</span>
                )}
              </div>
              <div className="text-muted-foreground flex items-center gap-1 text-sm">
                <Clock className="h-4 w-4" />
                {proposal.deliveryDays} days
              </div>
              {proposal.milestones && proposal.milestones.length > 0 && (
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {proposal.milestones.length} milestones
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-start gap-2">
            {proposal.status === 'SUBMITTED' && !proposal.boostType && (
              <Button size="sm" variant="outline" onClick={() => onBoost(proposal)}>
                <Zap className="mr-2 h-4 w-4" />
                Boost
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-8 w-8" size="icon" variant="ghost">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/jobs/${proposal.job?.slug}`)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Job
                </DropdownMenuItem>
                {['SUBMITTED', 'SHORTLISTED'].includes(proposal.status) && (
                  <>
                    <DropdownMenuItem
                      onClick={() => router.push(`/dashboard/proposals/${proposal.id}/edit`)}
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      Edit Proposal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => onWithdraw(proposal.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Withdraw
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Status timeline for active proposals */}
        {['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'INTERVIEWING'].includes(proposal.status) && (
          <div className="mt-4 border-t pt-4">
            <ProposalStatusTimeline status={proposal.status} />
          </div>
        )}

        {/* Interview info */}
        {proposal.status === 'INTERVIEWING' &&
          proposal.interviewSlots &&
          proposal.interviewSlots.length > 0 && (
            <div className="mt-4 rounded-lg bg-purple-50 p-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-900">Interview Scheduled</span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {new Date(proposal.interviewSlots[0].startTime).toLocaleString()}
              </p>
            </div>
          )}

        {/* Hired info */}
        {proposal.status === 'HIRED' && (
          <div className="mt-4 rounded-lg bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-900">You got the job!</span>
              </div>
              <Button asChild size="sm">
                <Link href={`/dashboard/contracts/${proposal.contractId}`}>
                  View Contract
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Declined info */}
        {proposal.status === 'DECLINED' && proposal.declineReason && (
          <div className="mt-4 rounded-lg bg-red-50 p-3">
            <p className="text-sm text-red-800">
              <strong>Reason:</strong> {proposal.declineReason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Status Timeline
// ============================================================================

function ProposalStatusTimeline({ status }: Readonly<{ status: ProposalStatus }>) {
  const steps = [
    { id: 'SUBMITTED', label: 'Submitted' },
    { id: 'VIEWED', label: 'Viewed' },
    { id: 'SHORTLISTED', label: 'Shortlisted' },
    { id: 'INTERVIEWING', label: 'Interviewing' },
    { id: 'HIRED', label: 'Hired' },
  ];

  const currentIndex = steps.findIndex((s) => s.id === status);

  return (
    <div className="flex items-center">
      {steps.map((step, index) => (
        <div key={step.id} className="flex flex-1 items-center">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
              index < currentIndex && 'bg-green-500 text-white',
              index === currentIndex && 'bg-primary text-primary-foreground',
              index > currentIndex && 'bg-slate-200 text-slate-500'
            )}
          >
            {index < currentIndex ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                'mx-1 h-0.5 flex-1',
                index < currentIndex ? 'bg-green-500' : 'bg-slate-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Stats Cards
// ============================================================================

function StatsCards({ proposals }: Readonly<{ proposals: Proposal[] }>) {
  const stats = useMemo(() => {
    const total = proposals.length;
    const pending = proposals.filter((p) =>
      ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(p.status)
    ).length;
    const interviewing = proposals.filter((p) => p.status === 'INTERVIEWING').length;
    const hired = proposals.filter((p) => p.status === 'HIRED').length;
    const viewRate =
      total > 0 ? Math.round((proposals.filter((p) => p.clientViewed).length / total) * 100) : 0;

    return { total, pending, interviewing, hired, viewRate };
  }, [proposals]);

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-slate-400" />
          <span className="text-2xl font-bold">{stats.total}</span>
        </div>
        <p className="text-muted-foreground text-sm">Total Proposals</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-400" />
          <span className="text-2xl font-bold">{stats.pending}</span>
        </div>
        <p className="text-muted-foreground text-sm">Pending</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-400" />
          <span className="text-2xl font-bold">{stats.interviewing}</span>
        </div>
        <p className="text-muted-foreground text-sm">Interviewing</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <span className="text-2xl font-bold">{stats.hired}</span>
        </div>
        <p className="text-muted-foreground text-sm">Hired</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-400" />
          <span className="text-2xl font-bold">{stats.viewRate}%</span>
        </div>
        <p className="text-muted-foreground text-sm">View Rate</p>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function FreelancerProposalsPage() {
  const searchParams = useSearchParams();
  const showSubmitted = searchParams.get('submitted') === 'true';

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [boostProposal, setBoostProposal] = useState<Proposal | null>(null);

  // Load proposals
  useEffect(() => {
    setIsLoading(true);
    void getMyProposals()
      .then((data) => setProposals(data.proposals))
      .catch(() => setProposals([]))
      .finally(() => setIsLoading(false));
  }, []);

  // Handle withdraw
  const handleWithdraw = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to withdraw this proposal?')) return;

    try {
      await withdrawProposal(id);
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'WITHDRAWN' as const } : p))
      );
    } catch {
      alert('Failed to withdraw proposal');
    }
  }, []);

  // Handle boost success
  const handleBoostSuccess = useCallback(
    (boostType: string) => {
      if (boostProposal) {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === boostProposal.id ? { ...p, boostType: boostType as Proposal['boostType'] } : p
          )
        );
      }
    },
    [boostProposal]
  );

  // Filter proposals
  const filteredProposals = useMemo(() => {
    switch (filter) {
      case 'pending':
        return proposals.filter((p) => ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(p.status));
      case 'shortlisted':
        return proposals.filter((p) => p.status === 'SHORTLISTED');
      case 'interviewing':
        return proposals.filter((p) => p.status === 'INTERVIEWING');
      case 'hired':
        return proposals.filter((p) => p.status === 'HIRED');
      case 'declined':
        return proposals.filter((p) => ['DECLINED', 'WITHDRAWN'].includes(p.status));
      default:
        return proposals;
    }
  }, [proposals, filter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">My Proposals</h1>
          <p className="text-muted-foreground">Track and manage your job proposals</p>
        </div>

        {/* Success message */}
        {showSubmitted && (
          <Card className="mb-6 border-green-300 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">Proposal submitted successfully!</span>
            </div>
          </Card>
        )}

        {/* Stats */}
        <StatsCards proposals={proposals} />

        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterOption)}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Proposals</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="shortlisted">Shortlisted</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
              <SelectItem value="hired">Hired</SelectItem>
              <SelectItem value="declined">Declined/Withdrawn</SelectItem>
            </SelectContent>
          </Select>

          <Button asChild>
            <Link href="/jobs">
              <Search className="mr-2 h-4 w-4" />
              Find Jobs
            </Link>
          </Button>
        </div>

        {/* Proposals list */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Loading proposals...
          </div>
        )}
        {!isLoading && filteredProposals.length === 0 && (
          <Card className="p-12 text-center">
            <Briefcase className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h3 className="mb-2 text-lg font-semibold">No proposals found</h3>
            <p className="text-muted-foreground mb-4">
              {filter === 'all'
                ? "You haven't submitted any proposals yet"
                : `No ${filter} proposals`}
            </p>
            <Button asChild>
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
          </Card>
        )}
        {!isLoading && filteredProposals.length > 0 && (
          <div className="space-y-4">
            {filteredProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onBoost={setBoostProposal}
                onWithdraw={handleWithdraw}
              />
            ))}
          </div>
        )}
      </div>

      {/* Boost modal */}
      <BidBoostModal
        currentPosition={5}
        jobTitle={boostProposal?.job?.title ?? ''}
        open={!!boostProposal}
        proposalId={boostProposal?.id ?? ''}
        totalProposals={12}
        onBoostSuccess={handleBoostSuccess}
        onOpenChange={(open) => !open && setBoostProposal(null)}
      />
    </div>
  );
}
