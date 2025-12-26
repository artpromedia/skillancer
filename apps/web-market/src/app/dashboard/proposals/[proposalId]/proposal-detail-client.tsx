'use client';

import { Button } from '@skillancer/ui';
import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { withdrawProposal } from '@/lib/api/bids';

interface ProposalDetailClientProps {
  proposalId: string;
  canWithdraw: boolean;
}

export function ProposalDetailClient({ proposalId, canWithdraw }: ProposalDetailClientProps) {
  const router = useRouter();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = useCallback(async () => {
    if (
      !confirm('Are you sure you want to withdraw this proposal? This action cannot be undone.')
    ) {
      return;
    }

    setIsWithdrawing(true);
    try {
      await withdrawProposal(proposalId);
      router.push('/dashboard/proposals?withdrawn=true');
    } catch {
      alert('Failed to withdraw proposal. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  }, [proposalId, router]);

  if (!canWithdraw) {
    return null;
  }

  return (
    <Button
      className="w-full"
      disabled={isWithdrawing}
      variant="destructive"
      onClick={() => void handleWithdraw()}
    >
      {isWithdrawing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Withdrawing...
        </>
      ) : (
        <>
          <Trash2 className="mr-2 h-4 w-4" />
          Withdraw Proposal
        </>
      )}
    </Button>
  );
}
