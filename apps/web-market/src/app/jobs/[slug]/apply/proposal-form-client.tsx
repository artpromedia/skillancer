'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { ProposalForm } from '@/components/bids/proposal-form';
import { useProposalForm } from '@/hooks/use-proposal-form';

interface ProposalFormClientProps {
  jobId: string;
  jobTitle: string;
  jobBudget: {
    type: 'FIXED' | 'HOURLY';
    minAmount?: number;
    maxAmount?: number;
    amount?: number;
  };
  jobSkills: string[];
}

export function ProposalFormClient({
  jobId,
  jobTitle,
  jobBudget,
  jobSkills,
}: ProposalFormClientProps) {
  const router = useRouter();

  const form = useProposalForm({
    jobId,
    initialContractType: jobBudget.type,
    suggestedBidAmount:
      jobBudget.amount ?? Math.round(((jobBudget.minAmount ?? 0) + (jobBudget.maxAmount ?? 0)) / 2),
    onSubmitSuccess: (proposalId) => {
      router.push(`/dashboard/proposals/${proposalId}?submitted=true`);
    },
  });

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <ProposalForm
      form={form}
      jobBudget={jobBudget}
      jobId={jobId}
      jobSkills={jobSkills}
      jobTitle={jobTitle}
      onCancel={handleCancel}
    />
  );
}
