'use client';

/**
 * Tenant Billing Management Page
 * Plan overview, usage, upgrade options, payment methods
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CreditCard,
  Check,
  AlertCircle,
  TrendingUp,
  Download,
  Calendar,
  Shield,
  Users,
  HardDrive,
  Monitor,
  FileText,
  Zap,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Badge } from '@skillancer/ui/badge';
import { Progress } from '@skillancer/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';
import { useToast } from '@skillancer/ui/use-toast';

// =============================================================================
// TYPES
// =============================================================================

type PlanId = 'STARTER' | 'PRO' | 'ENTERPRISE' | 'TRIAL';

interface PlanDetails {
  id: PlanId;
  name: string;
  price: number | null; // null for Enterprise (custom pricing)
  billingPeriod: 'monthly' | 'annual' | null;
  limits: {
    maxUsers: number; // -1 = unlimited
    maxConcurrentSessions: number;
    storageQuotaGB: number;
    maxRecordingsHours: number;
    maxPolicies: number;
    apiRateLimit: number;
  };
  features: {
    sessionRecording: boolean;
    ssoEnabled: boolean;
    scimProvisioning: boolean;
    customPolicies: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    advancedReporting: boolean;
    complianceReports: boolean;
    watermarking: boolean;
    clipboardBlocking: boolean;
    fileTransferBlocking: boolean;
    screenshotPrevention: boolean;
  };
}

interface BillingInfo {
  currentPlan: PlanDetails;
  status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED';
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  paymentMethod: {
    type: 'card' | 'invoice';
    last4?: string;
    brand?: string;
    email?: string;
  } | null;
}

interface UsageInfo {
  users: { current: number; limit: number };
  sessions: { current: number; limit: number };
  storage: { currentGB: number; limitGB: number };
  recordings: { currentHours: number; limitHours: number };
  apiCalls: { current: number; limit: number };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchBillingInfo(): Promise<BillingInfo> {
  const response = await fetch('/api/admin/tenant/billing');
  if (!response.ok) throw new Error('Failed to fetch billing info');
  return response.json();
}

async function fetchUsage(): Promise<UsageInfo> {
  const response = await fetch('/api/admin/tenant/usage');
  if (!response.ok) throw new Error('Failed to fetch usage');
  return response.json();
}

async function fetchInvoices(): Promise<Invoice[]> {
  const response = await fetch('/api/admin/tenant/invoices');
  if (!response.ok) throw new Error('Failed to fetch invoices');
  return response.json();
}

async function createBillingPortalSession(): Promise<{ url: string }> {
  const response = await fetch('/api/admin/tenant/billing/portal', {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to create portal session');
  return response.json();
}

async function initiateUpgrade(
  planId: PlanId
): Promise<{ checkoutUrl?: string; success?: boolean }> {
  const response = await fetch('/api/admin/tenant/billing/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  if (!response.ok) throw new Error('Failed to initiate upgrade');
  return response.json();
}

// =============================================================================
// PLAN DATA
// =============================================================================

const plans: PlanDetails[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 99,
    billingPeriod: 'monthly',
    limits: {
      maxUsers: 5,
      maxConcurrentSessions: 5,
      storageQuotaGB: 10,
      maxRecordingsHours: 10,
      maxPolicies: 3,
      apiRateLimit: 100,
    },
    features: {
      sessionRecording: true,
      ssoEnabled: false,
      scimProvisioning: false,
      customPolicies: false,
      apiAccess: false,
      webhooks: false,
      advancedReporting: false,
      complianceReports: false,
      watermarking: true,
      clipboardBlocking: true,
      fileTransferBlocking: true,
      screenshotPrevention: false,
    },
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 299,
    billingPeriod: 'monthly',
    limits: {
      maxUsers: 25,
      maxConcurrentSessions: 25,
      storageQuotaGB: 100,
      maxRecordingsHours: 100,
      maxPolicies: 20,
      apiRateLimit: 1000,
    },
    features: {
      sessionRecording: true,
      ssoEnabled: true,
      scimProvisioning: false,
      customPolicies: true,
      apiAccess: true,
      webhooks: true,
      advancedReporting: true,
      complianceReports: false,
      watermarking: true,
      clipboardBlocking: true,
      fileTransferBlocking: true,
      screenshotPrevention: true,
    },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    billingPeriod: null,
    limits: {
      maxUsers: -1,
      maxConcurrentSessions: -1,
      storageQuotaGB: -1,
      maxRecordingsHours: -1,
      maxPolicies: -1,
      apiRateLimit: 10000,
    },
    features: {
      sessionRecording: true,
      ssoEnabled: true,
      scimProvisioning: true,
      customPolicies: true,
      apiAccess: true,
      webhooks: true,
      advancedReporting: true,
      complianceReports: true,
      watermarking: true,
      clipboardBlocking: true,
      fileTransferBlocking: true,
      screenshotPrevention: true,
    },
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function UsageBar({
  label,
  current,
  limit,
  icon: Icon,
}: {
  label: string;
  current: number;
  limit: number;
  icon: React.ElementType;
}) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isWarning = !isUnlimited && percentage > 80;
  const isCritical = !isUnlimited && percentage > 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground h-4 w-4" />
          <span>{label}</span>
        </div>
        <span className="text-muted-foreground">
          {current.toLocaleString()} / {isUnlimited ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={isCritical ? 'bg-red-200' : isWarning ? 'bg-yellow-200' : ''}
        />
      )}
    </div>
  );
}

function CurrentPlanCard({ billing }: { billing: BillingInfo }) {
  const { toast } = useToast();

  const portalMutation = useMutation({
    mutationFn: createBillingPortalSession,
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to open billing portal',
        variant: 'destructive',
      });
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    TRIAL: 'bg-yellow-100 text-yellow-800',
    PAST_DUE: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Current Plan</CardTitle>
          <Badge className={statusColors[billing.status]}>{billing.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">{billing.currentPlan.name}</p>
            {billing.currentPlan.price && (
              <p className="text-muted-foreground">${billing.currentPlan.price}/month</p>
            )}
            {billing.currentPlan.price === null && (
              <p className="text-muted-foreground">Custom pricing</p>
            )}
          </div>
          {billing.status !== 'TRIAL' && billing.currentPlan.id !== 'ENTERPRISE' && (
            <Button variant="outline" onClick={() => portalMutation.mutate()}>
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          )}
        </div>

        {billing.status === 'TRIAL' && billing.trialEndsAt && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-yellow-800">Trial Period</span>
            </div>
            <p className="text-sm text-yellow-700">
              Your trial ends on {formatDate(billing.trialEndsAt)}. Upgrade now to keep your data
              and configurations.
            </p>
          </div>
        )}

        {billing.status === 'PAST_DUE' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-800">Payment Past Due</span>
            </div>
            <p className="text-sm text-red-700">
              Please update your payment method to avoid service interruption.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-2"
              onClick={() => portalMutation.mutate()}
            >
              Update Payment
            </Button>
          </div>
        )}

        {billing.paymentMethod && (
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Payment Method</p>
            {billing.paymentMethod.type === 'card' && (
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="capitalize">{billing.paymentMethod.brand}</span>
                <span>•••• {billing.paymentMethod.last4}</span>
              </div>
            )}
            {billing.paymentMethod.type === 'invoice' && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Invoice to {billing.paymentMethod.email}</span>
              </div>
            )}
          </div>
        )}

        {billing.currentPeriodEndsAt && billing.status === 'ACTIVE' && (
          <p className="text-muted-foreground text-sm">
            Next billing date: {formatDate(billing.currentPeriodEndsAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UsageCard({ usage }: { usage: UsageInfo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Current Usage
        </CardTitle>
        <CardDescription>Your resource consumption this billing period</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageBar
          label="Users"
          current={usage.users.current}
          limit={usage.users.limit}
          icon={Users}
        />
        <UsageBar
          label="Concurrent Sessions"
          current={usage.sessions.current}
          limit={usage.sessions.limit}
          icon={Monitor}
        />
        <UsageBar
          label="Storage"
          current={usage.storage.currentGB}
          limit={usage.storage.limitGB}
          icon={HardDrive}
        />
        <UsageBar
          label="Recording Hours"
          current={usage.recordings.currentHours}
          limit={usage.recordings.limitHours}
          icon={FileText}
        />
        <UsageBar
          label="API Calls (hourly)"
          current={usage.apiCalls.current}
          limit={usage.apiCalls.limit}
          icon={Zap}
        />
      </CardContent>
    </Card>
  );
}

function PlanComparisonCard({
  plan,
  currentPlanId,
  onUpgrade,
  isUpgrading,
}: {
  plan: PlanDetails;
  currentPlanId: PlanId;
  onUpgrade: (planId: PlanId) => void;
  isUpgrading: boolean;
}) {
  const isCurrent = plan.id === currentPlanId;
  const isDowngrade =
    currentPlanId === 'ENTERPRISE' || (currentPlanId === 'PRO' && plan.id === 'STARTER');

  const featureList = [
    { key: 'ssoEnabled', label: 'SSO Integration' },
    { key: 'scimProvisioning', label: 'SCIM Provisioning' },
    { key: 'customPolicies', label: 'Custom Security Policies' },
    { key: 'apiAccess', label: 'API Access' },
    { key: 'advancedReporting', label: 'Advanced Reporting' },
    { key: 'complianceReports', label: 'Compliance Reports' },
    { key: 'screenshotPrevention', label: 'Screenshot Prevention' },
  ];

  return (
    <Card className={isCurrent ? 'border-primary border-2' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {isCurrent && <Badge>Current</Badge>}
        </div>
        <CardDescription>
          {plan.price !== null ? (
            <span className="text-2xl font-bold">${plan.price}</span>
          ) : (
            <span className="text-lg font-medium">Custom Pricing</span>
          )}
          {plan.billingPeriod && <span className="text-muted-foreground">/month</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="text-muted-foreground h-4 w-4" />
            <span>{plan.limits.maxUsers === -1 ? 'Unlimited' : plan.limits.maxUsers} users</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="text-muted-foreground h-4 w-4" />
            <span>
              {plan.limits.storageQuotaGB === -1 ? 'Unlimited' : `${plan.limits.storageQuotaGB}GB`}{' '}
              storage
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {featureList.map((feature) => (
            <div key={feature.key} className="flex items-center gap-2 text-sm">
              {plan.features[feature.key as keyof typeof plan.features] ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <span className="text-muted-foreground h-4 w-4">—</span>
              )}
              <span
                className={
                  plan.features[feature.key as keyof typeof plan.features]
                    ? ''
                    : 'text-muted-foreground'
                }
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        {isCurrent ? (
          <Button className="w-full" disabled>
            Current Plan
          </Button>
        ) : isDowngrade ? (
          <Button className="w-full" variant="outline" disabled>
            Contact Sales to Downgrade
          </Button>
        ) : plan.id === 'ENTERPRISE' ? (
          <a href="mailto:sales@skillancer.io?subject=Enterprise%20Plan" className="w-full">
            <Button className="w-full" variant="outline">
              Contact Sales
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Button className="w-full" onClick={() => onUpgrade(plan.id)} disabled={isUpgrading}>
            {isUpgrading ? 'Processing...' : `Upgrade to ${plan.name}`}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function InvoicesCard({ invoices }: { invoices: Invoice[] }) {
  const statusColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No invoices yet</p>
        ) : (
          <div className="space-y-3">
            {invoices.slice(0, 5).map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between border-b py-2 last:border-0"
              >
                <div>
                  <p className="font-medium">${invoice.amount.toLocaleString()}</p>
                  <p className="text-muted-foreground text-sm">
                    {new Date(invoice.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[invoice.status]}>{invoice.status}</Badge>
                  <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {invoices.length > 5 && (
        <CardFooter>
          <Button variant="ghost" className="w-full">
            View All Invoices
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TenantBillingPage() {
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ['billing-info'],
    queryFn: fetchBillingInfo,
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usage-info'],
    queryFn: fetchUsage,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
  });

  const upgradeMutation = useMutation({
    mutationFn: initiateUpgrade,
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: 'Upgrade initiated', description: 'Your plan has been upgraded!' });
        setUpgradeDialogOpen(false);
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to initiate upgrade', variant: 'destructive' });
    },
  });

  const handleUpgrade = (planId: PlanId) => {
    setSelectedPlan(planId);
    setUpgradeDialogOpen(true);
  };

  const confirmUpgrade = () => {
    if (selectedPlan) {
      upgradeMutation.mutate(selectedPlan);
    }
  };

  if (billingLoading || usageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-12 w-12 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  const currentPlanId = billing?.currentPlan.id || 'STARTER';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription, usage, and invoices</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Current Plan */}
        <div className="lg:col-span-2">{billing && <CurrentPlanCard billing={billing} />}</div>

        {/* Usage */}
        <div>{usage && <UsageCard usage={usage} />}</div>
      </div>

      {/* Plan Comparison */}
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Available Plans</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanComparisonCard
              key={plan.id}
              plan={plan}
              currentPlanId={currentPlanId}
              onUpgrade={handleUpgrade}
              isUpgrading={upgradeMutation.isPending && selectedPlan === plan.id}
            />
          ))}
        </div>
      </div>

      {/* Invoices */}
      <div className="max-w-2xl">
        <InvoicesCard invoices={invoices} />
      </div>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Plan Upgrade</DialogTitle>
            <DialogDescription>
              You are about to upgrade to the{' '}
              <strong>{plans.find((p) => p.id === selectedPlan)?.name}</strong> plan.
              {selectedPlan && plans.find((p) => p.id === selectedPlan)?.price && (
                <span>
                  {' '}
                  You will be charged ${plans.find((p) => p.id === selectedPlan)?.price}/month.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted space-y-2 rounded-lg p-4">
              <p className="text-sm font-medium">What happens next:</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                <li>Your new plan takes effect immediately</li>
                <li>You'll be charged the prorated amount for this billing period</li>
                <li>All new features will be unlocked right away</li>
                <li>Your data and settings are preserved</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmUpgrade} disabled={upgradeMutation.isPending}>
              {upgradeMutation.isPending ? 'Processing...' : 'Confirm Upgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
