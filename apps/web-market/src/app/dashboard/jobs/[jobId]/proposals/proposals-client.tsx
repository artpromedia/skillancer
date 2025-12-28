/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars, no-case-declarations, no-console */
'use client';

import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import { Scale, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';


import { HireModal } from '@/components/bids/hire-modal';
import { ProposalComparison } from '@/components/bids/proposal-comparison';
import { ProposalDetailModal } from '@/components/bids/proposal-detail-modal';
import { ProposalList } from '@/components/bids/proposal-list';
import {
  archiveProposal,
  declineProposal,
  getProposalsForJob,
  shortlistProposal,
  subscribeToJobProposals,
} from '@/lib/api/bids';

import type { Contract, Proposal } from '@/lib/api/bids';

// ============================================================================
// Component
// ============================================================================

export function ProposalsClient({ jobId }: Readonly<{ jobId: string }>) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareProposals, setCompareProposals] = useState<Proposal[]>([]);
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);
  const [hireProposal, setHireProposal] = useState<Proposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Load proposals
  useEffect(() => {
    setIsLoading(true);
    void getProposalsForJob(jobId)
      .then((data) => setProposals(data.proposals))
      .catch(() => setProposals([]))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToJobProposals(jobId, (event) => {
      if (event.type === 'NEW_PROPOSAL') {
        setProposals((prev) => [event.proposal, ...prev]);
      } else if (event.type === 'PROPOSAL_UPDATED') {
        setProposals((prev) => prev.map((p) => (p.id === event.proposal.id ? event.proposal : p)));
      } else if (event.type === 'PROPOSAL_WITHDRAWN') {
        setProposals((prev) => prev.filter((p) => p.id !== event.proposalId));
      }
    });

    return unsubscribe;
  }, [jobId]);

  // Selection handlers
  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === proposals.length ? [] : proposals.map((p) => p.id)));
  }, [proposals]);

  // Action handlers
  const handleShortlist = useCallback(async (id: string) => {
    await shortlistProposal(id);
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'SHORTLISTED' as const } : p))
    );
  }, []);

  const handleArchive = useCallback(async (id: string) => {
    await archiveProposal(id);
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'ARCHIVED' as const } : p))
    );
    setDetailProposal(null);
  }, []);

  const handleDecline = useCallback(async (id: string) => {
    await declineProposal(id, 'Position filled');
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'DECLINED' as const } : p))
    );
    setDetailProposal(null);
  }, []);

  // Compare handlers
  const _handleAddToCompare = useCallback(
    (proposal: Proposal) => {
      if (compareProposals.length >= 3) return;
      if (compareProposals.some((p) => p.id === proposal.id)) return;
      setCompareProposals((prev) => [...prev, proposal]);
    },
    [compareProposals]
  );

  const handleRemoveFromCompare = useCallback((id: string) => {
    setCompareProposals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClearCompare = useCallback(() => {
    setCompareProposals([]);
  }, []);

  // Hire success handler
  const handleHireSuccess = useCallback(
    (contract: Contract) => {
      router.push(`/dashboard/contracts/${contract.id}`);
    },
    [router]
  );

  // Message handler
  const handleMessage = useCallback((_proposal: Proposal) => {
    // Feature: Open messaging modal - not yet implemented
  }, []);

  // Filter proposals by tab
  const getFilteredProposals = useCallback(() => {
    switch (activeTab) {
      case 'shortlisted':
        return proposals.filter((p) => p.status === 'SHORTLISTED');
      case 'new':
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return proposals.filter((p) => new Date(p.submittedAt).getTime() > oneDayAgo);
      case 'archived':
        return proposals.filter((p) => p.status === 'ARCHIVED');
      default:
        return proposals.filter((p) => p.status !== 'ARCHIVED' && p.status !== 'DECLINED');
    }
  }, [proposals, activeTab]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">
              <Users className="mr-2 h-4 w-4" />
              All Proposals
            </TabsTrigger>
            <TabsTrigger value="shortlisted">Shortlisted</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          {compareProposals.length > 0 && (
            <Button variant="outline" onClick={() => setActiveTab('compare')}>
              <Scale className="mr-2 h-4 w-4" />
              Compare ({compareProposals.length})
            </Button>
          )}
        </div>

        <TabsContent className="mt-6" value="all">
          <ProposalList
            isLoading={isLoading}
            proposals={getFilteredProposals()}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={setHireProposal}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="shortlisted">
          <ProposalList
            isLoading={isLoading}
            proposals={getFilteredProposals()}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={setHireProposal}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="new">
          <ProposalList
            isLoading={isLoading}
            proposals={getFilteredProposals()}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={setHireProposal}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="archived">
          <ProposalList
            isLoading={isLoading}
            proposals={getFilteredProposals()}
            selectedIds={selectedIds}
            onArchive={handleArchive}
            onDecline={handleDecline}
            onHire={setHireProposal}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onShortlist={handleShortlist}
            onViewDetails={setDetailProposal}
          />
        </TabsContent>
      </Tabs>

      {/* Comparison panel */}
      {compareProposals.length > 0 && (
        <ProposalComparison
          maxItems={3}
          proposals={compareProposals}
          onClearAll={handleClearCompare}
          onHire={setHireProposal}
          onRemove={handleRemoveFromCompare}
        />
      )}

      {/* Detail modal */}
      <ProposalDetailModal
        open={!!detailProposal}
        proposal={detailProposal}
        onArchive={handleArchive}
        onDecline={handleDecline}
        onHire={setHireProposal}
        onMessage={handleMessage}
        onOpenChange={(open) => !open && setDetailProposal(null)}
        onShortlist={handleShortlist}
      />

      {/* Hire modal */}
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
