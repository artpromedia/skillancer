'use client';

/**
 * Executive Plans Page
 *
 * Compare and switch between subscription plans
 */

import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@skillancer/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';
import { Switch } from '@skillancer/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@skillancer/ui/tooltip';
import {
  ArrowLeft,
  Check,
  Star,
  Zap,
  Shield,
  Users,
  Briefcase,
  Clock,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

type PlanTier = 'BASIC' | 'PRO' | 'ENTERPRISE';

interface PlanDetails {
  tier: PlanTier;
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  limits: {
    clients: number;
    skillpods: number | 'unlimited';
    teamMembers: number | 'unlimited';
    storage: string;
    support: string;
  };
  features: string[];
  highlighted?: boolean;
}

// =============================================================================
// PLAN DATA
// =============================================================================

const plans: PlanDetails[] = [
  {
    tier: 'BASIC',
    name: 'Basic',
    description: 'For executives getting started with fractional work',
    monthlyPrice: 199,
    annualPrice: 1990,
    limits: {
      clients: 5,
      skillpods: 10,
      teamMembers: 1,
      storage: '10 GB',
      support: 'Email',
    },
    features: [
      'Executive profile & marketplace listing',
      'Client engagement workspace',
      'Basic time tracking',
      'Standard templates',
      'Email support',
    ],
  },
  {
    tier: 'PRO',
    name: 'Professional',
    description: 'For established executives scaling their practice',
    monthlyPrice: 499,
    annualPrice: 4990,
    limits: {
      clients: 15,
      skillpods: 'unlimited',
      teamMembers: 5,
      storage: '100 GB',
      support: 'Priority',
    },
    features: [
      'Everything in Basic, plus:',
      'Unlimited SkillPod deployments',
      'Team member seats (up to 5)',
      'Advanced analytics & reporting',
      'AI-powered recommendations',
      'Custom branding',
      'API access',
      'Priority email & chat support',
    ],
    highlighted: true,
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'For high-volume executives and executive firms',
    monthlyPrice: null,
    annualPrice: null,
    limits: {
      clients: 'unlimited' as unknown as number,
      skillpods: 'unlimited',
      teamMembers: 'unlimited',
      storage: 'Unlimited',
      support: 'Dedicated',
    },
    features: [
      'Everything in Professional, plus:',
      'Unlimited clients & team members',
      'White-label options',
      'Custom integrations',
      'Dedicated success manager',
      'SLA guarantees',
      '24/7 phone support',
      'Volume discounts',
    ],
  },
];

// Current plan (mock)
const currentTier: PlanTier = 'PRO';

// =============================================================================
// COMPONENTS
// =============================================================================

function PlanCard({
  plan,
  isAnnual,
  isCurrent,
  onSelect,
}: {
  plan: PlanDetails;
  isAnnual: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const monthlyEquivalent =
    isAnnual && plan.annualPrice ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
  const savings =
    plan.monthlyPrice && plan.annualPrice
      ? Math.round((plan.monthlyPrice * 12 - plan.annualPrice) / 12)
      : 0;

  return (
    <Card
      className={`relative flex flex-col ${
        plan.highlighted ? 'shadow-lg ring-2 ring-purple-500' : ''
      } ${isCurrent ? 'border-green-500' : ''}`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-purple-600 text-white">
            <Star className="mr-1 h-3 w-3" />
            Most Popular
          </Badge>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <Badge className="bg-green-600 text-white">Current Plan</Badge>
        </div>
      )}

      <CardHeader className="pb-4 text-center">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

        <div className="mt-4">
          {price !== null ? (
            <>
              <div className="text-4xl font-bold">
                ${monthlyEquivalent}
                <span className="text-base font-normal text-gray-500">/mo</span>
              </div>
              {isAnnual && savings > 0 && (
                <p className="mt-1 text-sm text-green-600">
                  Save ${savings}/mo with annual billing
                </p>
              )}
              {isAnnual && (
                <p className="mt-1 text-xs text-gray-500">Billed ${plan.annualPrice}/year</p>
              )}
            </>
          ) : (
            <div className="text-4xl font-bold">Custom</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Limits */}
        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              Clients
            </span>
            <span className="font-medium">
              {typeof plan.limits.clients === 'number'
                ? `Up to ${plan.limits.clients}`
                : 'Unlimited'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-400" />
              SkillPods
            </span>
            <span className="font-medium">
              {plan.limits.skillpods === 'unlimited' ? 'Unlimited' : plan.limits.skillpods}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-400" />
              Team Members
            </span>
            <span className="font-medium">
              {plan.limits.teamMembers === 'unlimited'
                ? 'Unlimited'
                : `Up to ${plan.limits.teamMembers}`}
            </span>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-2">
          {plan.features.map((feature, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {i === 0 && plan.tier !== 'BASIC' ? (
                <span className="font-medium text-gray-700">{feature}</span>
              ) : (
                <>
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                  <span>{feature}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <Button
          className="w-full"
          disabled={isCurrent}
          variant={plan.highlighted && !isCurrent ? 'default' : 'outline'}
          onClick={onSelect}
        >
          {isCurrent
            ? 'Current Plan'
            : plan.tier === 'ENTERPRISE'
              ? 'Contact Sales'
              : currentTier === 'BASIC'
                ? 'Upgrade'
                : 'Downgrade'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PlansPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);

  const handleSelectPlan = (plan: PlanDetails) => {
    if (plan.tier === 'ENTERPRISE') {
      // Redirect to contact form
      window.open('/contact?subject=enterprise', '_blank');
      return;
    }
    setSelectedPlan(plan);
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = () => {
    // API call to change plan
    setShowConfirmDialog(false);
    // Show success message
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/settings/billing">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Billing
          </Link>
        </Button>
      </div>

      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="mt-2 text-gray-500">
          Select the plan that fits your executive practice. All plans include a 14-day free trial.
        </p>

        {/* Billing Toggle */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <span className={!isAnnual ? 'font-medium' : 'text-gray-500'}>Monthly</span>
          <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
          <span className={isAnnual ? 'font-medium' : 'text-gray-500'}>
            Annual
            <Badge className="ml-2 bg-green-100 text-green-800">Save 17%</Badge>
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.tier}
            isAnnual={isAnnual}
            isCurrent={plan.tier === currentTier}
            plan={plan}
            onSelect={() => handleSelectPlan(plan)}
          />
        ))}
      </div>

      {/* FAQ Link */}
      <div className="mt-8 text-center">
        <p className="text-gray-500">
          Have questions?{' '}
          <Link className="text-purple-600 hover:underline" href="/help/billing">
            Read our billing FAQ
          </Link>{' '}
          or{' '}
          <Link className="text-purple-600 hover:underline" href="/contact">
            contact support
          </Link>
        </p>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan && currentTier === 'BASIC' ? 'Upgrade' : 'Change'} to{' '}
              {selectedPlan?.name}?
            </DialogTitle>
            <DialogDescription>
              {selectedPlan &&
                (currentTier === 'BASIC' || selectedPlan.tier === 'PRO' ? (
                  <>
                    Your plan will be upgraded immediately. You'll be charged a prorated amount for
                    the remainder of your billing cycle.
                  </>
                ) : (
                  <>
                    Your plan will change at the end of your current billing period. You'll retain
                    access to your current features until then.
                  </>
                ))}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Current Plan</span>
                <span className="font-medium">{currentTier}</span>
              </div>
              <div className="flex items-center justify-between text-purple-600">
                <span>New Plan</span>
                <span className="font-medium">{selectedPlan?.name}</span>
              </div>
              <hr />
              <div className="flex items-center justify-between">
                <span className="text-gray-500">New {isAnnual ? 'Annual' : 'Monthly'} Rate</span>
                <span className="text-lg font-bold">
                  ${isAnnual ? selectedPlan?.annualPrice : selectedPlan?.monthlyPrice}
                  {isAnnual ? '/year' : '/mo'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmChange}>
              Confirm {currentTier === 'BASIC' ? 'Upgrade' : 'Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
