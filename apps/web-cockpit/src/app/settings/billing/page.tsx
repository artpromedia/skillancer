'use client';

/**
 * Executive Billing Page
 *
 * Shows current subscription plan, usage metrics, add-ons, and invoices.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Check,
  AlertCircle,
  TrendingUp,
  Download,
  Calendar,
  Shield,
  Users,
  Briefcase,
  Zap,
  ChevronRight,
  Settings,
  Plus,
  Clock,
  BarChart3,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Badge } from '@skillancer/ui/badge';
import { Progress } from '@skillancer/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';

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
// MOCK DATA
// =============================================================================

const mockSubscription: SubscriptionInfo = {
  tier: 'PRO',
  status: 'ACTIVE',
  billingCycle: 'MONTHLY',
  price: 499,
  currentPeriodStart: '2024-10-01',
  currentPeriodEnd: '2024-11-01',
  cancelAtPeriodEnd: false,
};

const mockUsage: UsageInfo = {
  clients: { current: 8, limit: 15 },
  skillpods: { used: 12, limit: -1 }, // -1 = unlimited
  teamMembers: { current: 2, limit: 5 },
  storage: { usedGB: 45.2, limitGB: 100 },
};

const mockAddons: Addon[] = [
  { id: '1', type: 'EXTRA_CLIENT_SLOT', name: 'Extra Client Slot', quantity: 2, unitPrice: 49, active: true },
  { id: '2', type: 'TEAM_SEAT', name: 'Team Seat', quantity: 3, unitPrice: 29, active: true },
];

const mockInvoices: Invoice[] = [
  { id: 'inv-001', date: '2024-10-01', amount: 695, status: 'paid', description: 'Pro Plan + 2 Add-ons' },
  { id: 'inv-002', date: '2024-09-01', amount: 695, status: 'paid', description: 'Pro Plan + 2 Add-ons' },
  { id: 'inv-003', date: '2024-08-01', amount: 597, status: 'paid', description: 'Pro Plan + 1 Add-on' },
  { id: 'inv-004', date: '2024-07-01', amount: 499, status: 'paid', description: 'Pro Plan' },
];

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
        <span className={isAtLimit ? 'text-red-600 font-medium' : 'text-gray-900'}>
          {current} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percentage}
          className={`h-2 ${isAtLimit ? 'bg-red-200' : isNearLimit ? 'bg-amber-200' : 'bg-gray-200'}`}
        />
      )}
      {isUnlimited && (
        <div className="h-2 bg-green-100 rounded-full overflow-hidden">
          <div className="h-full w-full bg-green-400 animate-pulse" style={{ opacity: 0.5 }} />
        </div>
      )}
    </div>
  );
}

function PlanCard({
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
        <div className="text-3xl font-bold mt-2">
          {price !== null ? `$${price}` : 'Custom'}
          {price !== null && <span className="text-sm font-normal text-gray-500">/month</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
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

  const subscription = mockSubscription;
  const usage = mockUsage;
  const addons = mockAddons;
  const invoices = mockInvoices;

  const monthlyAddonTotal = addons.reduce((sum, a) => sum + a.quantity * a.unitPrice, 0);
  const totalMonthly = subscription.price + monthlyAddonTotal;

  const handleUpgrade = (tier: PlanTier) => {
    setSelectedTier(tier);
    setShowUpgradeDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-gray-500 mt-1">Manage your plan, add-ons, and payment settings</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/billing/payment-methods">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Methods
          </Link>
        </Button>
      </div>

      {/* Current Plan Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-6 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {subscription.tier === 'BASIC' && 'Basic'}
                    {subscription.tier === 'PRO' && 'Professional'}
                    {subscription.tier === 'ENTERPRISE' && 'Enterprise'}
                    {' '}Plan
                  </h2>
                  <Badge className={tierBadgeColors[subscription.tier]}>{subscription.tier}</Badge>
                  <Badge className={statusBadgeColors[subscription.status]}>{subscription.status}</Badge>
                </div>
                <p className="text-gray-500 text-sm">
                  Billed {subscription.billingCycle.toLowerCase()} • Renews{' '}
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
                  <ChevronRight className="h-4 w-4 mr-1" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
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
                    Add more client slots →
                  </Link>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
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
                <CardTitle className="text-base flex items-center gap-2">
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
                  Add team seats →
                </Link>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
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
                  <span>{Math.round(usage.storage.limitGB - usage.storage.usedGB)} GB available</span>
                ) : (
                  <Link href="/settings/billing/addons" className="text-purple-600 hover:underline">
                    Upgrade storage →
                  </Link>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Add-ons Tab */}
        <TabsContent value="addons" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-500">
              Add extra capacity and features to your subscription
            </p>
            <Button asChild>
              <Link href="/settings/billing/addons">
                <Plus className="h-4 w-4 mr-2" />
                Browse Add-ons
              </Link>
            </Button>
          </div>

          {addons.length > 0 ? (
            <div className="space-y-3">
              {addons.map((addon) => (
                <Card key={addon.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        {addon.type === 'EXTRA_CLIENT_SLOT' && <Users className="h-5 w-5 text-gray-600" />}
                        {addon.type === 'TEAM_SEAT' && <Briefcase className="h-5 w-5 text-gray-600" />}
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
                <Plus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-medium text-lg">No add-ons yet</h3>
                <p className="text-gray-500 mt-1">
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
              <table className="w-full">
                <thead className="bg-gray-50 text-sm text-gray-500">
                  <tr>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Description</th>
                    <th className="text-left p-4 font-medium">Amount</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Actions</th>
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
              You're about to upgrade your subscription. Your new plan will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between">
                <span>Current plan</span>
                <span className="font-medium">{subscription.tier} (${subscription.price}/mo)</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>New plan</span>
                <span className="font-medium">
                  {selectedTier} (${selectedTier === 'PRO' ? 499 : selectedTier === 'ENTERPRISE' ? 'Custom' : 199}/mo)
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowUpgradeDialog(false)}>
              Confirm Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
