'use client';

import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@skillancer/ui';
import { ArrowUp, Check, Crown, Loader2, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';

import { boostProposal } from '@/lib/api/bids';

// ============================================================================
// Types
// ============================================================================

interface BidBoostModalProps {
  proposalId: string;
  jobTitle: string;
  currentPosition?: number;
  totalProposals?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBoostSuccess?: (boostType: BoostPackage['type']) => void;
}

interface BoostPackage {
  type: 'BASIC' | 'FEATURED' | 'PREMIUM';
  name: string;
  price: number;
  credits: number;
  description: string;
  features: string[];
  icon: typeof Zap;
  color: string;
  bgColor: string;
  borderColor: string;
  popular?: boolean;
  durationDays: number;
  positionBoost: string;
}

// ============================================================================
// Constants
// ============================================================================

const BOOST_PACKAGES: BoostPackage[] = [
  {
    type: 'BASIC',
    name: 'Boost',
    price: 5,
    credits: 5,
    description: 'Get noticed faster',
    features: ['Move up 5 positions', 'Highlighted for 3 days', 'Basic badge indicator'],
    icon: ArrowUp,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    durationDays: 3,
    positionBoost: '+5 positions',
  },
  {
    type: 'FEATURED',
    name: 'Featured',
    price: 15,
    credits: 15,
    description: 'Stand out from the crowd',
    features: [
      'Top 5 placement',
      'Featured badge for 7 days',
      'Priority in search results',
      'Email notification to client',
    ],
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    popular: true,
    durationDays: 7,
    positionBoost: 'Top 5',
  },
  {
    type: 'PREMIUM',
    name: 'Premium',
    price: 30,
    credits: 30,
    description: 'Maximum visibility',
    features: [
      'Top placement guaranteed',
      'Premium gold badge',
      'Extended 14 day visibility',
      'Priority client notifications',
      'Exclusive premium styling',
      'Interview priority',
    ],
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    durationDays: 14,
    positionBoost: '#1 Position',
  },
];

// ============================================================================
// Component
// ============================================================================

export function BidBoostModal({
  proposalId,
  jobTitle,
  currentPosition,
  totalProposals,
  open,
  onOpenChange,
  onBoostSuccess,
}: BidBoostModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<BoostPackage['type'] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle boost purchase
  const handleBoost = useCallback(async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    setError(null);

    try {
      await boostProposal(proposalId, selectedPackage);
      setSuccess(true);
      onBoostSuccess?.(selectedPackage);

      // Close after animation
      setTimeout(() => {
        onOpenChange(false);
        // Reset state after close animation
        setTimeout(() => {
          setSuccess(false);
          setSelectedPackage(null);
        }, 300);
      }, 1500);
    } catch {
      setError('Failed to boost your proposal. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [proposalId, selectedPackage, onBoostSuccess, onOpenChange]);

  // Reset on close
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setSelectedPackage(null);
        setError(null);
        setSuccess(false);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Boost Your Proposal
          </DialogTitle>
          <DialogDescription>
            Stand out and get noticed faster for &ldquo;{jobTitle}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {/* Success state */}
        {success ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Boost Applied!</h3>
            <p className="text-muted-foreground">
              Your proposal has been boosted and is now more visible to the client.
            </p>
          </div>
        ) : (
          <>
            {/* Current position indicator */}
            {currentPosition !== undefined && totalProposals !== undefined && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 p-4">
                <div>
                  <p className="text-muted-foreground text-sm">Current Position</p>
                  <p className="text-2xl font-bold">
                    #{currentPosition}{' '}
                    <span className="text-muted-foreground text-sm font-normal">
                      of {totalProposals}
                    </span>
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-slate-300" />
              </div>
            )}

            {/* Boost packages */}
            <div className="grid gap-4 md:grid-cols-3">
              {BOOST_PACKAGES.map((pkg) => (
                <button
                  key={pkg.type}
                  className={cn(
                    'relative rounded-lg border-2 p-4 text-left transition-all',
                    selectedPackage === pkg.type
                      ? `${pkg.borderColor} ${pkg.bgColor} ring-2 ring-offset-2`
                      : 'border-slate-200 hover:border-slate-300',
                    pkg.popular && selectedPackage !== pkg.type && 'border-purple-300'
                  )}
                  style={{
                    ['--tw-ring-color' as string]:
                      selectedPackage === pkg.type
                        ? pkg.borderColor.replace('border-', 'rgb(var(--') + '))'
                        : undefined,
                  }}
                  type="button"
                  onClick={() => setSelectedPackage(pkg.type)}
                >
                  {/* Popular badge */}
                  {pkg.popular && (
                    <Badge className="absolute -top-2 right-2 bg-purple-500">Most Popular</Badge>
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      'mb-3 flex h-10 w-10 items-center justify-center rounded-full',
                      pkg.bgColor
                    )}
                  >
                    <pkg.icon className={cn('h-5 w-5', pkg.color)} />
                  </div>

                  {/* Package info */}
                  <h4 className="mb-1 font-semibold">{pkg.name}</h4>
                  <p className="text-muted-foreground mb-3 text-sm">{pkg.description}</p>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-2xl font-bold">${pkg.price}</span>
                    <span className="text-muted-foreground text-sm"> / {pkg.credits} credits</span>
                  </div>

                  {/* Position boost */}
                  <div
                    className={cn(
                      'mb-3 rounded-md px-2 py-1 text-center text-sm font-medium',
                      pkg.bgColor,
                      pkg.color
                    )}
                  >
                    {pkg.positionBoost}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {pkg.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className={cn('mt-0.5 h-4 w-4 flex-shrink-0', pkg.color)} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Duration */}
                  <p className="text-muted-foreground mt-3 text-center text-xs">
                    Active for {pkg.durationDays} days
                  </p>

                  {/* Selection indicator */}
                  {selectedPackage === pkg.type && (
                    <div className={cn('absolute right-2 top-2', pkg.color)}>
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>

              <div className="flex items-center gap-4">
                {selectedPackage && (
                  <p className="text-muted-foreground text-sm">
                    Total:{' '}
                    <span className="font-semibold text-slate-900">
                      ${BOOST_PACKAGES.find((p) => p.type === selectedPackage)?.price}
                    </span>
                  </p>
                )}
                <Button
                  disabled={!selectedPackage || isProcessing}
                  onClick={() => void handleBoost()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Boost Now
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-center text-xs">
                Boosts are non-refundable. Your credits will be deducted immediately. View your{' '}
                <a className="text-primary underline" href="/dashboard/billing">
                  credit balance
                </a>
                .
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
