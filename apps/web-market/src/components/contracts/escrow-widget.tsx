/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@skillancer/ui';
import {
  AlertTriangle,
  Check,
  CreditCard,
  HelpCircle,
  Loader2,
  Lock,
  Shield,
  Wallet,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import type { Milestone } from '@/lib/api/contracts';

// ============================================================================
// Types
// ============================================================================

interface EscrowWidgetProps {
  escrowBalance: number;
  fundedMilestones: Milestone[];
  unfundedMilestones: Milestone[];
  isClient: boolean;
  onFundMilestone?: (milestoneId: string, amount: number) => Promise<void>;
  onReleasePayment?: (milestoneId: string) => Promise<void>;
}

// ============================================================================
// Fund Milestone Modal
// ============================================================================

interface FundMilestoneModalProps {
  milestone: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFund: (milestoneId: string, amount: number) => Promise<void>;
}

function FundMilestoneModal({ milestone, open, onOpenChange, onFund }: FundMilestoneModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'balance'>('card');

  const handleFund = async () => {
    if (!milestone) return;

    setIsProcessing(true);
    try {
      await onFund(milestone.id, milestone.amount);
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  if (!milestone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Fund Milestone
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Milestone Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="font-medium">{milestone.title}</p>
            <p className="text-muted-foreground text-sm">{milestone.description}</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(milestone.amount)}</p>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Payment Method</Label>
            <div className="grid gap-2">
              <button
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  paymentMethod === 'card'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/50'
                )}
                type="button"
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard className="h-5 w-5" />
                <div className="flex-1">
                  <p className="font-medium">Credit Card</p>
                  <p className="text-muted-foreground text-sm">Visa ending in 4242</p>
                </div>
                {paymentMethod === 'card' && <Check className="text-primary h-5 w-5" />}
              </button>
              <button
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  paymentMethod === 'balance'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/50'
                )}
                type="button"
                onClick={() => setPaymentMethod('balance')}
              >
                <Wallet className="h-5 w-5" />
                <div className="flex-1">
                  <p className="font-medium">Account Balance</p>
                  <p className="text-muted-foreground text-sm">Available: $1,250.00</p>
                </div>
                {paymentMethod === 'balance' && <Check className="text-primary h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
            <Shield className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="text-sm">
              <p className="font-medium text-green-800 dark:text-green-200">Escrow Protection</p>
              <p className="text-muted-foreground">
                Funds are held securely until you approve the milestone completion.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={isProcessing} onClick={handleFund}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Fund {formatCurrency(milestone.amount)}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Escrow Widget Component
// ============================================================================

export function EscrowWidget({
  escrowBalance,
  fundedMilestones,
  unfundedMilestones,
  isClient,
  onFundMilestone,
  onReleasePayment,
}: EscrowWidgetProps) {
  const [fundingMilestone, setFundingMilestone] = useState<Milestone | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);

  const handleRelease = useCallback(
    async (milestoneId: string) => {
      if (!onReleasePayment) return;

      setReleasingId(milestoneId);
      try {
        await onReleasePayment(milestoneId);
      } finally {
        setReleasingId(null);
      }
    },
    [onReleasePayment]
  );

  const totalUnfunded = unfundedMilestones.reduce((sum, m) => sum + m.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <Shield className="text-primary h-5 w-5" />
            Escrow Protection
          </h3>
          <button
            className="text-muted-foreground hover:text-foreground"
            title="Learn about escrow"
            type="button"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* How Escrow Works */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="font-medium">How Escrow Works</p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-xs">
                1
              </span>
              Client funds milestone before work begins
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-xs">
                2
              </span>
              Freelancer completes and submits work
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-xs">
                3
              </span>
              Client approves and releases payment
            </li>
          </ul>
        </div>

        {/* Current Escrow Balance */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-300">Current Escrow Balance</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                {formatCurrency(escrowBalance)}
              </p>
            </div>
            <Lock className="h-8 w-8 text-green-600" />
          </div>
        </div>

        {/* Funded Milestones */}
        {fundedMilestones.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Funded Milestones</p>
            {fundedMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{milestone.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatCurrency(milestone.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700" variant="secondary">
                    <Lock className="mr-1 h-3 w-3" />
                    Funded
                  </Badge>
                  {isClient && milestone.status === 'SUBMITTED' && onReleasePayment && (
                    <Button
                      disabled={releasingId === milestone.id}
                      size="sm"
                      onClick={() => handleRelease(milestone.id)}
                    >
                      {releasingId === milestone.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Release'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Unfunded Milestones Warning */}
        {unfundedMilestones.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">Unfunded Milestones</p>
            </div>
            {unfundedMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20"
              >
                <div>
                  <p className="font-medium">{milestone.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatCurrency(milestone.amount)}
                  </p>
                </div>
                {isClient && onFundMilestone && (
                  <Button size="sm" onClick={() => setFundingMilestone(milestone)}>
                    Fund Now
                  </Button>
                )}
              </div>
            ))}

            {isClient && (
              <p className="text-muted-foreground text-sm">
                Total to fund:{' '}
                <span className="font-semibold">{formatCurrency(totalUnfunded)}</span>
              </p>
            )}
          </div>
        )}

        {/* No Milestones */}
        {fundedMilestones.length === 0 && unfundedMilestones.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">No milestones set up yet</p>
        )}

        {/* Protection Notice */}
        <div className="text-muted-foreground border-t pt-3 text-xs">
          <p className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Your funds are protected by Skillancer Payment Protection
          </p>
        </div>
      </CardContent>

      {/* Fund Milestone Modal */}
      {onFundMilestone && (
        <FundMilestoneModal
          milestone={fundingMilestone}
          open={!!fundingMilestone}
          onFund={onFundMilestone}
          onOpenChange={(open) => !open && setFundingMilestone(null)}
        />
      )}
    </Card>
  );
}
