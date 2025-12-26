/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import {
  Archive,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Crown,
  DollarSign,
  Filter,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  Sparkles,
  Star,
  ThumbsDown,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import type { Proposal, SmartMatchScore } from '@/lib/api/bids';

import { getProposalStatusInfo } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface ProposalListProps {
  proposals: Proposal[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onViewDetails: (proposal: Proposal) => void;
  onShortlist: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onHire: (proposal: Proposal) => void;
  isLoading?: boolean;
  className?: string;
}

type SortOption = 'recent' | 'price-low' | 'price-high' | 'rating' | 'match-score';
type FilterOption = 'all' | 'shortlisted' | 'new' | 'boosted';

// ============================================================================
// Proposal Card
// ============================================================================

function ProposalCard({
  proposal,
  isSelected,
  onSelect,
  onViewDetails,
  onShortlist,
  onArchive,
  onDecline,
  onHire,
}: {
  proposal: Proposal;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
  onShortlist: () => Promise<void>;
  onArchive: () => Promise<void>;
  onDecline: () => Promise<void>;
  onHire: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const _statusInfo = getProposalStatusInfo(proposal.status);

  // Handle actions with loading state
  const handleAction = useCallback(async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  // Time ago
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all hover:shadow-md',
        isSelected && 'ring-primary ring-2',
        proposal.status === 'SHORTLISTED' && 'border-l-4 border-l-amber-400',
        proposal.boostType === 'PREMIUM' && 'border-l-4 border-l-purple-500',
        proposal.boostType === 'FEATURED' && 'border-l-4 border-l-blue-500'
      )}
    >
      {/* Boost badge */}
      {proposal.boostType && (
        <div
          className={cn(
            'absolute right-0 top-0 px-2 py-1 text-xs font-medium text-white',
            proposal.boostType === 'PREMIUM' && 'bg-purple-500',
            proposal.boostType === 'FEATURED' && 'bg-blue-500',
            proposal.boostType === 'BASIC' && 'bg-slate-500'
          )}
        >
          {proposal.boostType === 'PREMIUM' && <Crown className="mr-1 inline h-3 w-3" />}
          {proposal.boostType === 'FEATURED' && <Sparkles className="mr-1 inline h-3 w-3" />}
          {proposal.boostType === 'BASIC' && <Zap className="mr-1 inline h-3 w-3" />}
          {proposal.boostType}
        </div>
      )}

      <div className="p-4 sm:p-6">
        <div className="flex gap-4">
          {/* Selection checkbox */}
          <div className="flex items-start pt-1">
            <input
              checked={isSelected}
              className="h-4 w-4 rounded border-slate-300"
              type="checkbox"
              onChange={onSelect}
            />
          </div>

          {/* Freelancer avatar */}
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={proposal.freelancer?.avatarUrl} />
            <AvatarFallback>{proposal.freelancer?.name?.charAt(0) ?? 'F'}</AvatarFallback>
          </Avatar>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    className="font-semibold hover:underline"
                    href={`/freelancers/${proposal.freelancer?.username}`}
                  >
                    {proposal.freelancer?.name}
                  </Link>
                  {proposal.freelancer?.verificationLevel !== 'BASIC' && (
                    <Badge className="bg-blue-100 text-blue-700" variant="secondary">
                      Verified
                    </Badge>
                  )}
                  {proposal.status === 'SHORTLISTED' && (
                    <Badge className="bg-amber-100 text-amber-700" variant="secondary">
                      <Star className="mr-1 h-3 w-3" />
                      Shortlisted
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {proposal.freelancer?.title} • {proposal.freelancer?.location}
                </p>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-8 w-8" disabled={isProcessing} size="icon" variant="ghost">
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onViewDetails}>View Full Proposal</DropdownMenuItem>
                  {proposal.status !== 'SHORTLISTED' && (
                    <DropdownMenuItem onClick={() => void handleAction(onShortlist)}>
                      <Star className="mr-2 h-4 w-4" />
                      Add to Shortlist
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => void handleAction(onArchive)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => void handleAction(onDecline)}
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    Decline
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats row */}
            <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">{proposal.freelancer?.rating?.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({proposal.freelancer?.reviewCount} reviews)
                </span>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{proposal.freelancer?.successRate}% success</span>
              </div>
              <div className="text-muted-foreground">${proposal.freelancer?.hourlyRate}/hr</div>
            </div>

            {/* Cover letter preview */}
            <p className="text-muted-foreground mb-4 line-clamp-3 text-sm">
              {proposal.coverLetter}
            </p>

            {/* Match score */}
            {proposal.matchScore && <MatchScoreIndicator score={proposal.matchScore} />}

            {/* Footer */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              {/* Bid details */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <DollarSign className="text-muted-foreground h-4 w-4" />
                  <span className="font-semibold">{formatCurrency(proposal.bidAmount)}</span>
                  {proposal.contractType === 'HOURLY' && (
                    <span className="text-muted-foreground">/hr</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-slate-600">
                  <Clock className="h-4 w-4" />
                  <span>{proposal.deliveryDays} days</span>
                </div>
                <span className="text-muted-foreground">{timeAgo(proposal.submittedAt)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onViewDetails}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  View
                </Button>
                <Button size="sm" onClick={onHire}>
                  Hire
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Match Score Indicator
// ============================================================================

function MatchScoreIndicator({ score }: { score: SmartMatchScore }) {
  const getColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="rounded-lg bg-gradient-to-r from-slate-50 to-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Smart Match Score</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-sm font-semibold text-white',
            getColor(score.overall)
          )}
        >
          {score.overall}%
        </span>
      </div>
      <div className="flex gap-2">
        {Object.entries(score.breakdown).map(([key, value]) => (
          <div key={key} className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn('h-full transition-all', getColor(value))}
                style={{ width: `${value}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-center text-xs">{key.slice(0, 4)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalList({
  proposals,
  selectedIds,
  onSelect,
  onSelectAll,
  onViewDetails,
  onShortlist,
  onArchive,
  onDecline,
  onHire,
  isLoading,
  className,
}: ProposalListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('match-score');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  // Filter and sort proposals
  const filteredProposals = useMemo(() => {
    let result = [...proposals];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.freelancer?.name?.toLowerCase().includes(query) ||
          p.coverLetter.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterBy === 'shortlisted') {
      result = result.filter((p) => p.status === 'SHORTLISTED');
    } else if (filterBy === 'new') {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      result = result.filter((p) => new Date(p.submittedAt).getTime() > oneDayAgo);
    } else if (filterBy === 'boosted') {
      result = result.filter((p) => p.boostType);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        case 'price-low':
          return a.bidAmount - b.bidAmount;
        case 'price-high':
          return b.bidAmount - a.bidAmount;
        case 'rating':
          return (b.freelancer?.rating ?? 0) - (a.freelancer?.rating ?? 0);
        case 'match-score':
          return (b.matchScore?.overall ?? 0) - (a.matchScore?.overall ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [proposals, searchQuery, sortBy, filterBy]);

  // Stats
  const stats = useMemo(() => {
    const shortlisted = proposals.filter((p) => p.status === 'SHORTLISTED').length;
    const newToday = proposals.filter(
      (p) => new Date(p.submittedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;
    const avgBid =
      proposals.length > 0
        ? proposals.reduce((sum, p) => sum + p.bidAmount, 0) / proposals.length
        : 0;

    return { shortlisted, newToday, avgBid };
  }, [proposals]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading proposals...
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-2xl font-bold">{proposals.length}</p>
              <p className="text-muted-foreground text-sm">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold">{stats.shortlisted}</p>
              <p className="text-muted-foreground text-sm">Shortlisted</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold">{stats.newToday}</p>
              <p className="text-muted-foreground text-sm">New Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-2xl font-bold">${Math.round(stats.avgBid).toLocaleString()}</p>
              <p className="text-muted-foreground text-sm">Avg Bid</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
              type="button"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter dropdown */}
        <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Proposals</SelectItem>
            <SelectItem value="shortlisted">Shortlisted</SelectItem>
            <SelectItem value="new">New Today</SelectItem>
            <SelectItem value="boosted">Boosted</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort dropdown */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-44">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="match-score">Best Match</SelectItem>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="rating">Highest Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <Card className="bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.length} proposal{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <Star className="mr-2 h-4 w-4" />
                Shortlist All
              </Button>
              <Button size="sm" variant="outline">
                <Archive className="mr-2 h-4 w-4" />
                Archive All
              </Button>
              <Button size="sm" variant="ghost" onClick={onSelectAll}>
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Select all checkbox */}
      <div className="flex items-center gap-2">
        <input
          checked={selectedIds.length === filteredProposals.length && proposals.length > 0}
          className="h-4 w-4 rounded border-slate-300"
          type="checkbox"
          onChange={onSelectAll}
        />
        <span className="text-muted-foreground text-sm">
          Select all ({filteredProposals.length})
        </span>
      </div>

      {/* Proposal list */}
      {filteredProposals.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h3 className="mb-2 text-lg font-semibold">No proposals found</h3>
          <p className="text-muted-foreground">
            {searchQuery || filterBy !== 'all'
              ? 'Try adjusting your search or filters'
              : "You haven't received any proposals yet"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              isSelected={selectedIds.includes(proposal.id)}
              proposal={proposal}
              onArchive={() => onArchive(proposal.id)}
              onDecline={() => onDecline(proposal.id)}
              onHire={() => onHire(proposal)}
              onSelect={() => onSelect(proposal.id)}
              onShortlist={() => onShortlist(proposal.id)}
              onViewDetails={() => onViewDetails(proposal)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
