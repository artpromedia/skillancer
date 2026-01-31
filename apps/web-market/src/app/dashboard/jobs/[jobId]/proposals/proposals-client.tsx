/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import { AlertCircle, Bell, Loader2, RefreshCw, Scale, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import type { Contract, HireData, Proposal } from '@/lib/api/bids';

import { AcceptProposalModal } from '@/components/bids/accept-proposal-modal';
import { HireModal } from '@/components/bids/hire-modal';
import { ProposalComparison } from '@/components/bids/proposal-comparison';
import { ProposalDetailModal } from '@/components/bids/proposal-detail-modal';
import { ProposalList } from '@/components/bids/proposal-list';
import { RejectProposalModal } from '@/components/bids/reject-proposal-modal';
import {
  useJobProposals,
  useClientProposalMutations,
  useJobProposalSubscription,
} from '@/hooks/use-client-proposals';

// ============================================================================
// Types
// ============================================================================

type TabValue = 'all' | 'shortlisted' | 'new' | 'archived';

interface NewProposalNotificationProps {
  count: number;
  onDismiss: () => void;
  onView: () => void;
}

// ============================================================================
// Notification Banner
// ============================================================================

function NewProposalNotification({
  count,
  onDismiss,
  onView,
}: Readonly<NewProposalNotificationProps>) {
  if (count === 0) return null;

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-blue-900">
              {count === 1 ? '1 new proposal received!' : `${count} new proposals received!`}
            </p>
            <p className="text-sm text-blue-700">Click to view the latest proposals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={onView}>
            View New
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ProposalsClient({ jobId }: Readonly<{ jobId: string }>) {
  const router = useRouter();

  // UI State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareProposals, setCompareProposals] = useState<Proposal[]>([]);
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);
  const [hireProposal, setHireProposal] = useState<Proposal | null>(null);
  const [rejectProposal, setRejectProposal] = useState<Proposal | null>(null);
  const [acceptProposal, setAcceptProposal] = useState<Proposal | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [newProposalCount, setNewProposalCount] = useState(0);

  // Fetch proposals using hook
  const { proposals, isLoading, isFetching, error, hasMore, loadMore, refetch } = useJobProposals({
    jobId,
    sortBy: 'match_score',
    pageSize: 20,
  });

  // Mutations
  const {
    shortlist,
    archive,
    decline,
    accept,
    isShortlisting: _isShortlisting,
    isArchiving: _isArchiving,
    isDeclining,
    isAccepting,
  } = useClientProposalMutations({
    jobId,
    onShortlist: () => {
      void refetch();
    },
    onArchive: () => {
      setDetailProposal(null);
      void refetch();
    },
    onDecline: () => {
      setDetailProposal(null);
      setRejectProposal(null);
      void refetch();
    },
    onAccept: (contract: Contract) => {
      setAcceptProposal(null);
      setHireProposal(null);
      router.push(`/dashboard/contracts/${contract.id}`);
    },
    onError: (error) => {
      console.error('Proposal action failed:', error);
    },
  });

  // Real-time updates
  useJobProposalSubscription({
    jobId,
    enabled: true,
    onNewProposal: () => {
      setNewProposalCount((prev) => prev + 1);
      // Could also show a toast notification here
    },
    onProposalUpdated: () => {
      void refetch();
    },
    onProposalWithdrawn: () => {
      void refetch();
    },
  });

  // Selection handlers
  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === proposals.length ? [] : proposals.map((p) => p.id)));
  }, [proposals]);

  // Action handlers
  const handleShortlist = useCallback(
    (id: string): Promise<void> => {
      shortlist(id);
      return Promise.resolve();
    },
    [shortlist]
  );

  const handleArchive = useCallback(
    (id: string): Promise<void> => {
      archive(id);
      return Promise.resolve();
    },
    [archive]
  );

  const handleDecline = useCallback(
    (id: string): Promise<void> => {
      // Open reject modal for reason
      const proposal = proposals.find((p) => p.id === id);
      if (proposal) {
        setRejectProposal(proposal);
      }
      return Promise.resolve();
    },
    [proposals]
  );

  const handleConfirmReject = useCallback(
    (proposalId: string, reason?: string) => {
      decline({ proposalId, reason });
    },
    [decline]
  );

  const handleHire = useCallback((proposal: Proposal) => {
    // Open accept modal or hire modal
    setAcceptProposal(proposal);
  }, []);

  const handleConfirmAccept = useCallback(
    (data: HireData) => {
      accept(data);
    },
    [accept]
  );

  // Compare handlers
  const handleRemoveFromCompare = useCallback((id: string) => {
    setCompareProposals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClearCompare = useCallback(() => {
    setCompareProposals([]);
  }, []);

  // Hire success handler (from HireModal)
  const handleHireSuccess = useCallback(
    (contract: Contract) => {
      setHireProposal(null);
      router.push(`/dashboard/contracts/${contract.id}`);
    },
    [router]
  );

  // Message handler
  const handleMessage = useCallback((_proposal: Proposal) => {
    // Feature: Open messaging modal - not yet implemented
  }, []);

  // New proposal notification handlers
  const handleDismissNotification = useCallback(() => {
    setNewProposalCount(0);
  }, []);

  const handleViewNewProposals = useCallback(() => {
    setNewProposalCount(0);
    setActiveTab('new');
    void refetch();
  }, [refetch]);

  // Filter proposals by tab
  const filteredProposals = useMemo(() => {
    switch (activeTab) {
      case 'shortlisted':
        return proposals.filter((p) => p.status === 'SHORTLISTED');
      case 'new': {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return proposals.filter((p) => new Date(p.submittedAt).getTime() > oneDayAgo);
      }
      case 'archived':
        return proposals.filter((p) => p.status === 'ARCHIVED');
      default:
        return proposals.filter((p) => p.status !== 'ARCHIVED' && p.status !== 'DECLINED');
    }
  }, [proposals, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      all: proposals.filter((p) => p.status !== 'ARCHIVED' && p.status !== 'DECLINED').length,
      shortlisted: proposals.filter((p) => p.status === 'SHORTLISTED').length,
      new: proposals.filter((p) => new Date(p.submittedAt).getTime() > oneDayAgo).length,
      archived: proposals.filter((p) => p.status === 'ARCHIVED').length,
    };
  }, [proposals]);

  return (
    <div className="space-y-6">
      {/* New proposal notification */}
      <NewProposalNotification
        count={newProposalCount}
        onDismiss={handleDismissNotification}
        onView={handleViewNewProposals}
      />

      {/* Error state */}
      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900">Failed to load proposals</p>
              <p className="text-sm text-red-700">{error.message}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">
              <Users className="mr-2 h-4 w-4" />
              All Proposals
              {tabCounts.all > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {tabCounts.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shortlisted">
              Shortlisted
              {tabCounts.shortlisted > 0 && (
                <Badge className="ml-2" variant="secondary">
                  {tabCounts.shortlisted}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="new">
              New
              {tabCounts.new > 0 && (
                <Badge className="ml-2 bg-blue-500 text-white">{tabCounts.new}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              disabled={isFetching}
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
              Refresh
            </Button>

            {compareProposals.length > 0 && (
              <Button variant="outline" onClick={() => setActiveTab('all')}>
                <Scale className="mr-2 h-4 w-4" />
                Compare ({compareProposals.length})
              </Button>
            )}
          </div>
        </div>

        <TabsContent className="mt-6" value="all">
          <ProposalList
            isLoading={isLoading}
            proposals={filteredProposals}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={handleHire}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="shortlisted">
          <ProposalList
            isLoading={isLoading}
            proposals={filteredProposals}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={handleHire}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="new">
          <ProposalList
            isLoading={isLoading}
            proposals={filteredProposals}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={handleHire}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="archived">
          <ProposalList
            isLoading={isLoading}
            proposals={filteredProposals}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={handleHire}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>
      </Tabs>

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-4">
          <Button disabled={isFetching} variant="outline" onClick={loadMore}>
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Proposals'
            )}
          </Button>
        </div>
      )}

      {/* Comparison panel */}
      {compareProposals.length > 0 && (
        <ProposalComparison
          maxItems={3}
          proposals={compareProposals}
          onClearAll={handleClearCompare}
          onHire={handleHire}
          onRemove={handleRemoveFromCompare}
        />
      )}

      {/* Detail modal */}
      <ProposalDetailModal
        open={!!detailProposal}
        proposal={detailProposal}
        onArchive={handleArchive}
        onDecline={handleDecline}
        onHire={handleHire}
        onMessage={handleMessage}
        onOpenChange={(open) => !open && setDetailProposal(null)}
        onShortlist={handleShortlist}
      />

      {/* Accept/Hire confirmation modal */}
      <AcceptProposalModal
        isLoading={isAccepting}
        open={!!acceptProposal}
        proposal={acceptProposal}
        onAccept={handleConfirmAccept}
        onOpenChange={(open) => !open && setAcceptProposal(null)}
      />

      {/* Reject confirmation modal */}
      <RejectProposalModal
        isLoading={isDeclining}
        open={!!rejectProposal}
        proposal={rejectProposal}
        onOpenChange={(open) => !open && setRejectProposal(null)}
        onReject={handleConfirmReject}
      />

      {/* Legacy Hire modal (for advanced contract setup) */}
      <HireModal
        jobId={jobId}
        open={!!hireProposal}
        proposal={hireProposal}
        onHireSuccess={handleHireSuccess}
        onOpenChange={(open) => !open && setHireProposal(null)}
      />
    </div>
  );
}
