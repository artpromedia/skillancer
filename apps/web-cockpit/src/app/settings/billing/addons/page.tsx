'use client';

/**
 * Executive Add-ons Page
 *
 * Browse and manage subscription add-ons
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Minus,
  Users,
  Briefcase,
  HardDrive,
  Zap,
  Globe,
  BarChart3,
  Shield,
  Headphones,
  Palette,
  Code,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Badge } from '@skillancer/ui/badge';
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

interface AddonConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  monthlyPrice: number;
  unit: string;
  maxQuantity: number;
  minTier: 'BASIC' | 'PRO' | 'ENTERPRISE';
  popular?: boolean;
}

interface ActiveAddon {
  addonId: string;
  quantity: number;
}

// =============================================================================
// ADDON DATA
// =============================================================================

const addons: AddonConfig[] = [
  {
    id: 'EXTRA_CLIENT_SLOT',
    name: 'Extra Client Slot',
    description: 'Add capacity for one additional concurrent client engagement',
    icon: Users,
    monthlyPrice: 49,
    unit: 'slot',
    maxQuantity: 10,
    minTier: 'BASIC',
    popular: true,
  },
  {
    id: 'TEAM_SEAT',
    name: 'Team Seat',
    description: 'Add a team member to help manage your engagements',
    icon: Briefcase,
    monthlyPrice: 29,
    unit: 'seat',
    maxQuantity: 20,
    minTier: 'BASIC',
    popular: true,
  },
  {
    id: 'EXTRA_STORAGE',
    name: 'Extra Storage',
    description: 'Add 50GB of additional document and file storage',
    icon: HardDrive,
    monthlyPrice: 9,
    unit: '50GB',
    maxQuantity: 10,
    minTier: 'BASIC',
  },
  {
    id: 'SKILLPOD_PREMIUM',
    name: 'Premium SkillPods',
    description: 'Access premium SkillPod templates and advanced AI capabilities',
    icon: Zap,
    monthlyPrice: 79,
    unit: 'bundle',
    maxQuantity: 1,
    minTier: 'PRO',
  },
  {
    id: 'CUSTOM_DOMAIN',
    name: 'Custom Domain',
    description: 'Use your own domain for client portals and workspaces',
    icon: Globe,
    monthlyPrice: 19,
    unit: 'domain',
    maxQuantity: 5,
    minTier: 'PRO',
  },
  {
    id: 'ADVANCED_ANALYTICS',
    name: 'Advanced Analytics',
    description: 'Detailed engagement analytics, benchmarking, and insights',
    icon: BarChart3,
    monthlyPrice: 49,
    unit: 'bundle',
    maxQuantity: 1,
    minTier: 'PRO',
  },
  {
    id: 'COMPLIANCE_PACK',
    name: 'Compliance Pack',
    description: 'SOC 2 reports, audit logs, and compliance documentation',
    icon: Shield,
    monthlyPrice: 99,
    unit: 'pack',
    maxQuantity: 1,
    minTier: 'PRO',
  },
  {
    id: 'PRIORITY_SUPPORT',
    name: 'Priority Support',
    description: '24/7 phone support with 1-hour response time SLA',
    icon: Headphones,
    monthlyPrice: 129,
    unit: 'plan',
    maxQuantity: 1,
    minTier: 'PRO',
  },
  {
    id: 'WHITE_LABEL',
    name: 'White Label',
    description: 'Remove Skillancer branding from all client-facing materials',
    icon: Palette,
    monthlyPrice: 199,
    unit: 'license',
    maxQuantity: 1,
    minTier: 'ENTERPRISE',
  },
  {
    id: 'API_ACCESS_EXTENDED',
    name: 'Extended API Access',
    description: 'Higher rate limits and access to beta API endpoints',
    icon: Code,
    monthlyPrice: 49,
    unit: 'plan',
    maxQuantity: 1,
    minTier: 'PRO',
  },
];

// Current subscription (mock)
const currentTier: 'BASIC' | 'PRO' | 'ENTERPRISE' = 'PRO';

// Active addons (mock)
const activeAddons: ActiveAddon[] = [
  { addonId: 'EXTRA_CLIENT_SLOT', quantity: 2 },
  { addonId: 'TEAM_SEAT', quantity: 3 },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function AddonCard({
  addon,
  currentQuantity,
  canAdd,
  onQuantityChange,
}: {
  addon: AddonConfig;
  currentQuantity: number;
  canAdd: boolean;
  onQuantityChange: (quantity: number) => void;
}) {
  const Icon = addon.icon;
  const isActive = currentQuantity > 0;
  const tierRestricted = !canAdd && currentQuantity === 0;

  const tierLabels = {
    BASIC: 'Basic+',
    PRO: 'Pro+',
    ENTERPRISE: 'Enterprise',
  };

  return (
    <Card className={`relative ${isActive ? 'ring-2 ring-purple-200 bg-purple-50/30' : ''}`}>
      {addon.popular && !isActive && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-amber-500 text-white text-xs">Popular</Badge>
        </div>
      )}
      {isActive && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-green-500 text-white text-xs">Active</Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isActive ? 'bg-purple-100' : 'bg-gray-100'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-purple-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <CardTitle className="text-base">{addon.name}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold">${addon.monthlyPrice}</span>
                <span className="text-sm text-gray-500">/{addon.unit}/mo</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-sm text-gray-600">{addon.description}</p>
        {tierRestricted && (
          <div className="flex items-center gap-1 mt-2 text-amber-600 text-xs">
            <AlertCircle className="h-3 w-3" />
            Requires {tierLabels[addon.minTier]} plan
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {canAdd || isActive ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentQuantity === 0}
                onClick={() => onQuantityChange(Math.max(0, currentQuantity - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium">{currentQuantity}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentQuantity >= addon.maxQuantity}
                onClick={() => onQuantityChange(Math.min(addon.maxQuantity, currentQuantity + 1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-right">
              {currentQuantity > 0 && (
                <span className="font-medium text-purple-600">
                  ${currentQuantity * addon.monthlyPrice}/mo
                </span>
              )}
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            Upgrade to {tierLabels[addon.minTier]}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function AddonsPage() {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    addons.forEach((addon) => {
      const active = activeAddons.find((a) => a.addonId === addon.id);
      initial[addon.id] = active?.quantity ?? 0;
    });
    return initial;
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const tierOrder = { BASIC: 0, PRO: 1, ENTERPRISE: 2 };
  const canAddAddon = (addon: AddonConfig) => tierOrder[currentTier] >= tierOrder[addon.minTier];

  const handleQuantityChange = (addonId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [addonId]: quantity }));
  };

  // Calculate changes
  const changes = addons
    .map((addon) => {
      const original = activeAddons.find((a) => a.addonId === addon.id)?.quantity ?? 0;
      const current = quantities[addon.id];
      if (original !== current) {
        return {
          addon,
          originalQuantity: original,
          newQuantity: current,
          priceDiff: (current - original) * addon.monthlyPrice,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{
    addon: AddonConfig;
    originalQuantity: number;
    newQuantity: number;
    priceDiff: number;
  }>;

  const hasChanges = changes.length > 0;
  const totalChange = changes.reduce((sum, c) => sum + c.priceDiff, 0);
  const currentTotal = addons.reduce((sum, addon) => {
    const active = activeAddons.find((a) => a.addonId === addon.id);
    return sum + (active?.quantity ?? 0) * addon.monthlyPrice;
  }, 0);
  const newTotal = currentTotal + totalChange;

  const handleSaveChanges = () => {
    // API call to update add-ons
    setShowConfirmDialog(false);
    // Refresh data
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/billing">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Billing
            </Link>
          </Button>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">New Monthly Total</div>
              <div className="text-lg font-bold">
                ${newTotal}/mo
                <span
                  className={`text-sm ml-2 ${
                    totalChange > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  ({totalChange > 0 ? '+' : ''}${totalChange})
                </span>
              </div>
            </div>
            <Button onClick={() => setShowConfirmDialog(true)}>Save Changes</Button>
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">Add-ons</h1>
        <p className="text-gray-500 mt-1">
          Extend your subscription with additional features and capacity
        </p>
      </div>

      {/* Current Add-ons Summary */}
      {activeAddons.length > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-purple-600" />
                <span className="font-medium">
                  {activeAddons.length} active add-on{activeAddons.length > 1 ? 's' : ''}
                </span>
              </div>
              <span className="font-bold text-purple-600">${currentTotal}/mo</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add-on Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {addons.map((addon) => (
          <AddonCard
            key={addon.id}
            addon={addon}
            currentQuantity={quantities[addon.id]}
            canAdd={canAddAddon(addon)}
            onQuantityChange={(qty) => handleQuantityChange(addon.id, qty)}
          />
        ))}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Add-on Changes</DialogTitle>
            <DialogDescription>
              Review your add-on changes. Charges will be prorated for the current billing period.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {changes.map((change) => (
              <div
                key={change.addon.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium">{change.addon.name}</div>
                  <div className="text-sm text-gray-500">
                    {change.originalQuantity} → {change.newQuantity} {change.addon.unit}
                    {change.newQuantity !== 1 ? 's' : ''}
                  </div>
                </div>
                <div
                  className={`font-medium ${
                    change.priceDiff > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {change.priceDiff > 0 ? '+' : ''}${change.priceDiff}/mo
                </div>
              </div>
            ))}

            <hr />

            <div className="flex items-center justify-between font-bold">
              <span>New Monthly Total</span>
              <span>${newTotal}/mo</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges}>Confirm Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
