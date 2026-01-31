/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
'use client';

/**
 * AcceptProposalModal Component
 *
 * Confirmation modal for accepting a proposal and initiating the hiring process.
 * Shows a summary and allows customization of contract terms.
 */

import {
  Alert,
  AlertDescription,
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
  Input,
  Label,
  Separator,
  Textarea,
} from '@skillancer/ui';
import { AlertCircle, Calendar, CheckCircle2, DollarSign, Loader2, Shield } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { HireData, Proposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface AcceptProposalModalProps {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (data: HireData) => void;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AcceptProposalModal({
  proposal,
  open,
  onOpenChange,
  onAccept,
  isLoading = false,
}: Readonly<AcceptProposalModalProps>) {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [agreedAmount, setAgreedAmount] = useState<number | null>(null);
  const [agreedDeliveryDays, setAgreedDeliveryDays] = useState<number | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const handleAccept = useCallback(() => {
    if (!proposal) return;

    const data: HireData = {
      proposalId: proposal.id,
      contractType: proposal.contractType,
      agreedAmount: agreedAmount ?? proposal.bidAmount,
      agreedDeliveryDays: agreedDeliveryDays ?? proposal.deliveryDays,
      welcomeMessage: welcomeMessage || undefined,
      milestones: proposal.milestones?.map((m) => ({
        title: m.title,
        description: m.description,
        amount: m.amount,
        durationDays: m.durationDays,
      })),
    };

    onAccept(data);
  }, [proposal, agreedAmount, agreedDeliveryDays, welcomeMessage, onAccept]);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      setWelcomeMessage('');
      setAgreedAmount(null);
      setAgreedDeliveryDays(null);
      onOpenChange(false);
    }
  }, [isLoading, onOpenChange]);

  if (!proposal) return null;

  const freelancer = proposal.freelancer;
  const finalAmount = agreedAmount ?? proposal.bidAmount;
  const _finalDelivery = agreedDeliveryDays ?? proposal.deliveryDays;

  // Calculate platform fee (simplified)
  const calculateFeeRate = (amount: number): number => {
    if (amount <= 500) return 0.1;
    if (amount <= 10000) return 0.05;
    return 0.03;
  };
  const platformFeeRate = calculateFeeRate(finalAmount);
  const platformFee = Math.round(finalAmount * platformFeeRate * 100) / 100;
  const totalCost = finalAmount + platformFee;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Accept Proposal & Hire
          </DialogTitle>
          <DialogDescription>Review the terms and confirm to create a contract</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Freelancer Info */}
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage
                alt={freelancer?.name ?? freelancer?.displayName}
                src={freelancer?.avatarUrl}
              />
              <AvatarFallback>
                {(freelancer?.name ?? freelancer?.displayName)?.charAt(0) ?? 'F'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{freelancer?.name ?? freelancer?.displayName}</h3>
                {freelancer?.verificationLevel !== 'BASIC' && (
                  <Shield className="h-4 w-4 text-blue-500" />
                )}
              </div>
              <p className="text-muted-foreground text-sm">{freelancer?.title}</p>
            </div>
          </div>

          {/* Contract Terms */}
          <div className="space-y-4">
            <h4 className="font-medium">Contract Terms</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Agreed Amount</Label>
                <div className="relative">
                  <DollarSign className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    className="pl-9"
                    id="amount"
                    min={0}
                    placeholder={String(proposal.bidAmount)}
                    type="number"
                    value={agreedAmount ?? ''}
                    onChange={(e) =>
                      setAgreedAmount(e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Original bid: {formatCurrency(proposal.bidAmount)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery">Delivery (days)</Label>
                <div className="relative">
                  <Calendar className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    className="pl-9"
                    id="delivery"
                    min={1}
                    placeholder={String(proposal.deliveryDays)}
                    type="number"
                    value={agreedDeliveryDays ?? ''}
                    onChange={(e) =>
                      setAgreedDeliveryDays(e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Original: {proposal.deliveryDays} days
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Welcome Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal welcome message for the freelancer..."
                rows={3}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Cost Summary */}
          <div className="rounded-lg bg-slate-50 p-4">
            <h4 className="mb-3 font-medium">Cost Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Contract Amount</span>
                <span className="font-medium">{formatCurrency(finalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Platform Fee ({(platformFeeRate * 100).toFixed(0)}%)
                </span>
                <span>{formatCurrency(platformFee)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              After accepting, you&apos;ll need to fund the first milestone to activate the
              contract. The freelancer will be notified immediately.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button disabled={isLoading} variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={isLoading} onClick={handleAccept}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Accept & Create Contract
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
