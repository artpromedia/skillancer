/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * FundMilestone Component
 *
 * Enhanced milestone funding component with:
 * - Real payment method selection
 * - Fee preview
 * - Stripe integration
 * - Loading states and error handling
 */

import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Separator,
} from '@skillancer/ui';
import {
  AlertCircle,
  Calendar,
  Check,
  CreditCard,
  HelpCircle,
  Loader2,
  Lock,
  Shield,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PaymentMethod } from '@/hooks/use-payment-methods';
import type { Milestone } from '@/lib/api/contracts';

import { useFundEscrow, useEscrowFeePreview, type EscrowFeePreview } from '@/hooks/use-escrow';
import { usePaymentMethods } from '@/hooks/use-payment-methods';

// ============================================================================
// Types
// ============================================================================

export interface FundMilestoneProps {
  contractId: string;
  milestone: Milestone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Fee Preview Component
// ============================================================================

interface FeePreviewDisplayProps {
  readonly feePreview: EscrowFeePreview | null;
  readonly isLoading: boolean;
  readonly milestoneAmount: number;
}

function FeePreviewDisplay({ feePreview, isLoading }: Readonly<FeePreviewDisplayProps>) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount / 100); // Amounts are in cents

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Calculating fees...</span>
      </div>
    );
  }

  if (!feePreview) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="mb-3 text-sm font-medium">Fee Breakdown</h4>
        <div className="space-y-2 text-sm">
          {feePreview.breakdown.map((item) => (
            <div key={`fee-${item.label}`} className="flex items-center justify-between">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={item.amount > 0 ? '' : 'text-green-600'}>
                {item.amount > 0 ? formatCurrency(item.amount) : 'Free'}
              </span>
            </div>
          ))}
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <span className="font-medium">Total Charge</span>
          <span className="text-lg font-bold">{formatCurrency(feePreview.totalClientCharge)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Freelancer receives</span>
          <span className="text-green-600">{formatCurrency(feePreview.netToFreelancer)}</span>
        </div>
      </div>

      {/* Platform Fee Notice */}
      <div className="text-muted-foreground flex items-start gap-2 text-xs">
        <HelpCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
        <span>
          Platform fee ({feePreview.platformFeePercent}%) is charged on successful payments to cover
          escrow protection, payment processing, and dispute resolution services.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Payment Method Item Component
// ============================================================================

interface PaymentMethodItemProps {
  readonly paymentMethod: PaymentMethod;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

function PaymentMethodItem({
  paymentMethod,
  isSelected,
  onSelect,
}: Readonly<PaymentMethodItemProps>) {
  const getIcon = () => {
    if (paymentMethod.type === 'card') {
      return <CreditCard className="h-5 w-5" />;
    }
    return <Wallet className="h-5 w-5" />;
  };

  const getLabel = () => {
    if (paymentMethod.card) {
      return `${paymentMethod.card.brand} ending in ${paymentMethod.card.last4}`;
    }
    if (paymentMethod.bankAccount) {
      return `${paymentMethod.bankAccount.bankName ?? 'Bank'} ****${paymentMethod.bankAccount.last4}`;
    }
    return 'Payment Method';
  };

  const getSubLabel = () => {
    if (paymentMethod.card) {
      return `Expires ${paymentMethod.card.expMonth}/${paymentMethod.card.expYear}`;
    }
    return null;
  };

  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
      )}
      type="button"
      onClick={onSelect}
    >
      {getIcon()}
      <div className="flex-1">
        <p className="font-medium capitalize">{getLabel()}</p>
        {getSubLabel() && <p className="text-muted-foreground text-sm">{getSubLabel()}</p>}
      </div>
      {paymentMethod.isDefault && (
        <Badge className="mr-2" variant="secondary">
          Default
        </Badge>
      )}
      {isSelected && <Check className="text-primary h-5 w-5" />}
    </button>
  );
}

// ============================================================================
// Payment Method Content Component
// ============================================================================

interface PaymentMethodContentProps {
  readonly isLoading: boolean;
  readonly hasPaymentMethod: boolean;
  readonly paymentMethods: PaymentMethod[];
  readonly selectedPaymentMethod: PaymentMethod | null;
  readonly onSelectPaymentMethod: (method: PaymentMethod) => void;
}

function PaymentMethodContent({
  isLoading,
  hasPaymentMethod,
  paymentMethods,
  selectedPaymentMethod,
  onSelectPaymentMethod,
}: Readonly<PaymentMethodContentProps>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (hasPaymentMethod) {
    return (
      <div className="space-y-2">
        {paymentMethods.map((pm) => (
          <PaymentMethodItem
            key={pm.id}
            isSelected={selectedPaymentMethod?.id === pm.id}
            paymentMethod={pm}
            onSelect={() => onSelectPaymentMethod(pm)}
          />
        ))}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-6 text-center">
        <CreditCard className="text-muted-foreground mx-auto h-10 w-10" />
        <p className="mt-2 font-medium">No payment methods</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Add a payment method to fund milestones
        </p>
        <Button className="mt-4" size="sm" variant="outline">
          Add Payment Method
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Fund Milestone Modal
// ============================================================================

export function FundMilestone({
  contractId,
  milestone,
  open,
  onOpenChange,
  onSuccess,
  onError,
}: Readonly<FundMilestoneProps>) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment methods
  const {
    paymentMethods,
    defaultPaymentMethod,
    isLoading: isLoadingPaymentMethods,
    hasPaymentMethod,
  } = usePaymentMethods();

  // Fee preview
  const { data: feePreview, isLoading: isLoadingFees } = useEscrowFeePreview(
    {
      amount: milestone.amount * 100, // Convert to cents
      contractId,
    },
    { enabled: open }
  );

  // Fund escrow mutation
  const {
    fund,
    isFunding,
    error: fundError,
  } = useFundEscrow(contractId, {
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      setError(err.message);
      onError?.(err);
    },
  });

  // Auto-select default payment method
  useEffect(() => {
    if (defaultPaymentMethod && !selectedPaymentMethod) {
      setSelectedPaymentMethod(defaultPaymentMethod);
    }
  }, [defaultPaymentMethod, selectedPaymentMethod]);

  // Reset error when modal opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const handleFund = useCallback(() => {
    if (!selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }

    setError(null);
    fund({
      contractId,
      milestoneId: milestone.id,
      amount: milestone.amount * 100, // Convert to cents
      paymentMethodId: selectedPaymentMethod.stripePaymentMethodId,
    });
  }, [contractId, milestone.id, milestone.amount, selectedPaymentMethod, fund]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDate = (date?: string) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const displayError = error || fundError?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Fund Milestone
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Milestone Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold">{milestone.title}</p>
                {milestone.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{milestone.description}</p>
                )}
              </div>
              <Badge variant="outline">Milestone {milestone.order + 1}</Badge>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <span className="text-2xl font-bold">{formatCurrency(milestone.amount)}</span>
              {milestone.dueDate && (
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Calendar className="h-4 w-4" />
                  Due {formatDate(milestone.dueDate)}
                </span>
              )}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label>Payment Method</Label>
            <PaymentMethodContent
              hasPaymentMethod={hasPaymentMethod}
              isLoading={isLoadingPaymentMethods}
              paymentMethods={paymentMethods}
              selectedPaymentMethod={selectedPaymentMethod}
              onSelectPaymentMethod={setSelectedPaymentMethod}
            />
          </div>

          {/* Fee Preview */}
          <FeePreviewDisplay
            feePreview={feePreview ?? null}
            isLoading={isLoadingFees}
            milestoneAmount={milestone.amount}
          />

          {/* Security Notice */}
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/20">
            <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
            <div className="text-sm">
              <p className="font-medium text-green-800 dark:text-green-200">Escrow Protection</p>
              <p className="text-muted-foreground">
                Your funds are held securely in escrow until you approve the milestone completion.
                You&apos;re protected by Skillancer Payment Protection.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div className="text-sm">
                <p className="font-medium text-red-800 dark:text-red-200">Payment Error</p>
                <p className="text-red-700 dark:text-red-300">{displayError}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={isFunding || !selectedPaymentMethod || isLoadingFees}
              onClick={handleFund}
            >
              {isFunding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Fund{' '}
                  {feePreview
                    ? formatCurrency(feePreview.totalClientCharge / 100)
                    : formatCurrency(milestone.amount)}
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
// Fund All Milestones Button
// ============================================================================

export interface FundAllMilestonesProps {
  contractId: string;
  unfundedMilestones: Milestone[];
  onSuccess?: () => void;
}

export function FundAllMilestonesButton({
  contractId,
  unfundedMilestones,
  onSuccess,
}: Readonly<FundAllMilestonesProps>) {
  const [showFundModal, setShowFundModal] = useState(false);
  const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState(0);

  const totalAmount = useMemo(
    () => unfundedMilestones.reduce((sum, m) => sum + m.amount, 0),
    [unfundedMilestones]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);

  const handleSuccess = useCallback(() => {
    if (currentMilestoneIndex < unfundedMilestones.length - 1) {
      // Move to next milestone
      setCurrentMilestoneIndex((i) => i + 1);
    } else {
      // All done
      setShowFundModal(false);
      setCurrentMilestoneIndex(0);
      onSuccess?.();
    }
  }, [currentMilestoneIndex, unfundedMilestones.length, onSuccess]);

  if (unfundedMilestones.length === 0) {
    return null;
  }

  const currentMilestone = unfundedMilestones[currentMilestoneIndex];

  return (
    <>
      <Button
        className="w-full"
        variant="default"
        onClick={() => {
          setCurrentMilestoneIndex(0);
          setShowFundModal(true);
        }}
      >
        <Lock className="mr-2 h-4 w-4" />
        Fund All Milestones ({formatCurrency(totalAmount)})
      </Button>

      {currentMilestone && (
        <FundMilestone
          contractId={contractId}
          milestone={currentMilestone}
          open={showFundModal}
          onOpenChange={setShowFundModal}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

export default FundMilestone;
