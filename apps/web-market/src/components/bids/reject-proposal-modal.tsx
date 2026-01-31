/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * RejectProposalModal Component
 *
 * Confirmation modal for rejecting/declining a proposal.
 * Allows optional feedback reason to help freelancers improve.
 */

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Textarea,
} from '@skillancer/ui';
import { AlertTriangle, Loader2, ThumbsDown } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { Proposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface RejectProposalModalProps {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReject: (proposalId: string, reason?: string) => void;
  isLoading?: boolean;
}

// ============================================================================
// Predefined Reasons
// ============================================================================

const REJECTION_REASONS = [
  { id: 'rate', label: 'Rate is too high' },
  { id: 'experience', label: 'Looking for different experience level' },
  { id: 'timeline', label: "Delivery timeline doesn't fit our needs" },
  { id: 'skills', label: "Skills don't match requirements" },
  { id: 'proposal', label: "Proposal didn't address key requirements" },
  { id: 'other', label: 'Other reason' },
  { id: 'none', label: 'Prefer not to say' },
] as const;

// ============================================================================
// Component
// ============================================================================

export function RejectProposalModal({
  proposal,
  open,
  onOpenChange,
  onReject,
  isLoading = false,
}: Readonly<RejectProposalModalProps>) {
  const [selectedReason, setSelectedReason] = useState<string>('none');
  const [customReason, setCustomReason] = useState('');

  const handleReject = useCallback(() => {
    if (!proposal) return;

    let reason: string | undefined;
    if (selectedReason !== 'none') {
      if (selectedReason === 'other' && customReason.trim()) {
        reason = customReason.trim();
      } else {
        reason = REJECTION_REASONS.find((r) => r.id === selectedReason)?.label;
      }
    }

    onReject(proposal.id, reason);
  }, [proposal, selectedReason, customReason, onReject]);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      setSelectedReason('none');
      setCustomReason('');
      onOpenChange(false);
    }
  }, [isLoading, onOpenChange]);

  if (!proposal) return null;

  const freelancer = proposal.freelancer;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-red-600" />
            Decline Proposal
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to decline this proposal? The freelancer will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Freelancer Info */}
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <Avatar className="h-10 w-10">
              <AvatarImage
                alt={freelancer?.name ?? freelancer?.displayName}
                src={freelancer?.avatarUrl}
              />
              <AvatarFallback>
                {(freelancer?.name ?? freelancer?.displayName)?.charAt(0) ?? 'F'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-medium">{freelancer?.name ?? freelancer?.displayName}</h3>
              <p className="text-muted-foreground text-sm">{freelancer?.title}</p>
            </div>
          </div>

          <Separator />

          {/* Reason Selection */}
          <div className="space-y-3">
            <Label>Reason for declining (optional)</Label>
            <p className="text-muted-foreground text-xs">
              This feedback helps freelancers improve their proposals.
            </p>

            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {REJECTION_REASONS.map((reason) => (
                <div key={reason.id} className="flex items-center space-x-2">
                  <RadioGroupItem id={reason.id} value={reason.id} />
                  <Label className="cursor-pointer font-normal" htmlFor={reason.id}>
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Custom reason text area */}
            {selectedReason === 'other' && (
              <Textarea
                className="mt-2"
                placeholder="Please specify the reason..."
                rows={3}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">This action cannot be undone</p>
              <p className="text-amber-700">
                Once declined, this proposal will be marked as rejected and the freelancer will be
                notified.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={isLoading} variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={isLoading} variant="destructive" onClick={handleReject}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              <>
                <ThumbsDown className="mr-2 h-4 w-4" />
                Decline Proposal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
