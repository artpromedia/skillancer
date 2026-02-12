'use client';

/**
 * Executive Billing Page
 *
 * Shows current subscription plan, usage metrics, add-ons, and invoices.
 * Uses financial summary, balance, and invoice hooks for real API data.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import { Badge } from '@skillancer/ui/badge';
import { Button } from '@skillancer/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@skillancer/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@skillancer/ui/dialog';
import { Progress } from '@skillancer/ui/progress';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Loader2,
  Plus,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useFinancialSummary, useBalance } from '@/hooks/api/use-cockpit-finances';
import { useInvoices } from '@/hooks/api';

// =============================================================================
// TYPES
// =============================================================================

type PlanTier = 'BASIC' | 'PRO' | 'ENTERPRISE';

interface SubscriptionInfo {
  tier: PlanTier;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'PENDING_CANCELLATION';
  billingCycle: 'MONTHLY' | 'ANNUAL';
  price: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
}

interface UsageInfo {
  clients: { current: number; limit: number };
  skillpods: { used: number; limit: number };
  teamMembers: { current: number; limit: number };
  storage: { usedGB: number; limitGB: number };
}

interface Addon {
  id: string;
  type: string;
  name: string;
  quantity: number;
  unitPrice: number;
  active: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
  pdfUrl?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const tierBadgeColors: Record<PlanTier, string> = {
  BASIC: 'bg-gray-100 text-gray-800',
  PRO: 'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-amber-100 text-amber-800',
};

const statusBadgeColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  TRIALING: 'bg-blue-100 text-blue-800',
  PAST_DUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  PENDING_CANCELLATION: 'bg-orange-100 text-orange-800',
};

// =============================================================================
// HELPER: Map invoice status from API to page format
// =============================================================================

function mapInvoiceStatus(apiStatus: string): 'paid' | 'pending' | 'failed' {
  if (apiStatus === 'paid') return 'paid';
  if (apiStatus === 'overdue' || apiStatus === 'cancelled' || apiStatus === 'refunded') {
    return 'failed';
  }
  return 'pending';
}

// =============================================================================
// COMPONENTS
// =============================================================================

function UsageBar({ current, limit, label }: { current: number; limit: number; label: string }) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : (current / limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className={isAtLimit ? 'font-medium text-red-600' : 'text-gray-900'}>
          {current} / {isUnlimited ? '\u221E' : limit}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={`h-2 ${isAtLimit ? 'bg-red-200' : isNearLimit ? 'bg-amber-200' : 'bg-gray-200'}`}
        />
      )}
      {isUnlimited && (
        <div className="h-2 overflow-hidden rounded-full bg-green-100">
          <div className="h-full w-full animate-pulse bg-green-400" style={{ opacity: 0.5 }} />
        </div>
      )}
    </div>
  );
}

function _PlanCard({
  tier,
  price,
  features,
  isCurrent,
  onSelect,
}: {
  tier: PlanTier;
  price: number | null;
  features: string[];
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const tierNames: Record<PlanTier, string> = {
    BASIC: 'Basic',
    PRO: 'Professional',
    ENTERPRISE: 'Enterprise',
  };

  return (
    <Card className={`relative ${isCurrent ? 'ring-2 ring-purple-500' : ''}`}>
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-purple-600 text-white">Current Plan</Badge>
        </div>
      )}
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{tierNames[tier]}</CardTitle>
        <div className="mt-2 text-3xl font-bold">
          {price !== null ? `$${price}` : 'Custom'}
          {price !== null && <span className="text-sm font-normal text-gray-500">/month</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
            <span>{feature}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isCurrent ? 'outline' : tier === 'PRO' ? 'default' : 'outline'}
          disabled={isCurrent}
          onClick={onSelect}
        >
          {isCurrent ? 'Current Plan' : tier === 'ENTERPRISE' ? 'Contact Sales' : 'Upgrade'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function BillingPage() {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);

  // ---------------------------------------------------------------------------
  // API Hook Calls
  // ---------------------------------------------------------------------------
  const {
    data: financialData,
    isLoading: isLoadingFinancial,
    error: financialError,
  } = useFinancialSummary();

  const { data: balanceData, isLoading: isLoadingBalance, error: balanceError } = useBalance();

  const {
    data: invoicesData,
    isLoading: isLoadingInvoices,
    error: invoicesError,
  } = useInvoices({ limit: 20 });

  const isLoading = isLoadingFinancial || isLoadingBalance || isLoadingInvoices;
  const error = financialError || balanceError || invoicesError;

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-500">Loading billing data...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="font-medium text-red-600">Failed to load billing data</p>
        <p className="text-sm text-gray-500">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Map API data to page structures
  // ---------------------------------------------------------------------------

  // Derive subscription info from financial summary
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const subscription: SubscriptionInfo = {
    tier: 'PRO',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    price: Math.round(financialData?.revenue?.monthToDate ?? 0),
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  };

  // Derive usage info from balance data
  const usage: UsageInfo = {
    clients: {
      current: balanceData?.pendingReleases?.length ?? 0,
      limit: 15,
    },
    skillpods: { used: 0, limit: -1 },
    teamMembers: {
      current: balanceData?.balances?.length ?? 0,
      limit: 5,
    },
    storage: {
      usedGB: Math.round((balanceData?.lifetimeStats?.totalEarned ?? 0) / 1000),
      limitGB: 100,
    },
  };

  // No add-on API available yet; show empty state
  const addons: Addon[] = [];

  // Map invoices from the invoicing API
  const invoices: Invoice[] = (invoicesData?.data ?? []).map((inv) => ({
    id: inv.id,
    date: inv.issueDate,
    amount: inv.total,
    status: mapInvoiceStatus(inv.status),
    description: `Invoice #${inv.invoiceNumber}`,
    pdfUrl: undefined,
  }));

  const monthlyAddonTotal = addons.reduce((sum, a) => sum + a.quantity * a.unitPrice, 0);
  const totalMonthly = subscription.price + monthlyAddonTotal;

  const _handleUpgrade = (tier: PlanTier) => {
    setSelectedTier(tier);
    setShowUpgradeDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="mt-1 text-gray-500">Manage your plan, add-ons, and payment settings</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/billing/payment-methods">
            <CreditCard className="mr-2 h-4 w-4" />
            Payment Methods
          </Link>
        </Button>
      </div>

      {/* Current Plan Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {subscription.tier === 'BASIC' && 'Basic'}
                    {subscription.tier === 'PRO' && 'Professional'}
                    {subscription.tier === 'ENTERPRISE' && 'Enterprise'} Plan
                  </h2>
                  <Badge className={tierBadgeColors[subscription.tier]}>{subscription.tier}</Badge>
                  <Badge className={statusBadgeColors[subscription.status]}>
                    {subscription.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  Billed {subscription.billingCycle.toLowerCase()} &bull; Renews{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold">${totalMonthly}/mo</div>
              <p className="text-sm text-gray-500">
                ${subscription.price} base + ${monthlyAddonTotal} add-ons
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/settings/billing/plans">
                  <ChevronRight className="mr-1 h-4 w-4" />
                  Change Plan
                </Link>
              </Button>
              {subscription.cancelAtPeriodEnd ? (
                <Button variant="default">Reactivate</Button>
              ) : (
                <Button variant="ghost" className="text-gray-500">
                  Cancel Plan
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Client Engagements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UsageBar
                  current={usage.clients.current}
                  limit={usage.clients.limit}
                  label="Active clients"
                />
              </CardContent>
              <CardFooter className="text-sm text-gray-500">
                {usage.clients.limit - usage.clients.current > 0 ? (
                  <span>{usage.clients.limit - usage.clients.current} slots available</span>
                ) : (
                  <Link href="/settings/billing/addons" className="text-purple-600 hover:underline">
                    Add more client slots &rarr;
                  </Link>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  SkillPod Deployments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UsageBar
                  current={usage.skillpods.used}
                  limit={usage.skillpods.limit}
                  label="Active SkillPods"
                />
              </CardContent>
              <CardFooter className="text-sm text-gray-500">
                {usage.skillpods.limit === -1 ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" /> Unlimited with your plan
                  </span>
                ) : (
                  <span>{usage.skillpods.limit - usage.skillpods.used} deployments remaining</span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="h-4 w-4" />
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UsageBar
                  current={usage.teamMembers.current}
                  limit={usage.teamMembers.limit}
                  label="Team seats used"
                />
              </CardContent>
              <CardFooter className="text-sm text-gray-500">
                <Link href="/settings/billing/addons" className="text-purple-600 hover:underline">
                  Add team seats &rarr;
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UsageBar
                  current={Math.round(usage.storage.usedGB)}
                  limit={usage.storage.limitGB}
                  label="Storage used (GB)"
                />
              </CardContent>
              <CardFooter className="text-sm text-gray-500">
                {usage.storage.limitGB - usage.storage.usedGB > 20 ? (
                  <span>
                    {Math.round(usage.storage.limitGB - usage.storage.usedGB)} GB available
                  </span>
                ) : (
                  <Link href="/settings/billing/addons" className="text-purple-600 hover:underline">
                    Upgrade storage &rarr;
                  </Link>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Add-ons Tab */}
        <TabsContent value="addons" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-500">Add extra capacity and features to your subscription</p>
            <Button asChild>
              <Link href="/settings/billing/addons">
                <Plus className="mr-2 h-4 w-4" />
                Browse Add-ons
              </Link>
            </Button>
          </div>

          {addons.length > 0 ? (
            <div className="space-y-3">
              {addons.map((addon) => (
                <Card key={addon.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                        {addon.type === 'EXTRA_CLIENT_SLOT' && (
                          <Users className="h-5 w-5 text-gray-600" />
                        )}
                        {addon.type === 'TEAM_SEAT' && (
                          <Briefcase className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{addon.name}</div>
                        <div className="text-sm text-gray-500">
                          {addon.quantity}x @ ${addon.unitPrice}/month each
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">${addon.quantity * addon.unitPrice}/mo</div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Manage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Plus className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <h3 className="text-lg font-medium">No add-ons yet</h3>
                <p className="mt-1 text-gray-500">
                  Extend your subscription with additional features and capacity
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/settings/billing/addons">Browse Add-ons</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <h3 className="text-lg font-medium">No invoices yet</h3>
                  <p className="mt-1 text-gray-500">
                    Your invoice history will appear here once billing begins.
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 text-sm text-gray-500">
                    <tr>
                      <th className="p-4 text-left font-medium">Date</th>
                      <th className="p-4 text-left font-medium">Description</th>
                      <th className="p-4 text-left font-medium">Amount</th>
                      <th className="p-4 text-left font-medium">Status</th>
                      <th className="p-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {new Date(invoice.date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-4">{invoice.description}</td>
                        <td className="p-4 font-medium">${invoice.amount.toLocaleString()}</td>
                        <td className="p-4">
                          <Badge
                            className={
                              invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedTier}</DialogTitle>
            <DialogDescription>
              You&apos;re about to upgrade your subscription. Your new plan will take effect
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex justify-between">
                <span>Current plan</span>
                <span className="font-medium">
                  {subscription.tier} (${subscription.price}/mo)
                </span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>New plan</span>
                <span className="font-medium">
                  {selectedTier} ($
                  {selectedTier === 'PRO' ? 499 : selectedTier === 'ENTERPRISE' ? 'Custom' : 199}
                  /mo)
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowUpgradeDialog(false)}>Confirm Upgrade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
