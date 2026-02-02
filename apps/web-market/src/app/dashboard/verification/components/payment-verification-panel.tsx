'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@skillancer/ui';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { usePaymentVerification } from '@/hooks/use-payment-verification';

import type { PaymentMethod } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface PaymentVerificationPanelProps {
  readonly className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PaymentVerificationPanel({ className }: PaymentVerificationPanelProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMethodType, setSelectedMethodType] = useState<'card' | 'bank_account'>('card');
  const [methodToRemove, setMethodToRemove] = useState<string | null>(null);

  const {
    status,
    methods,
    isLoading,
    isLoadingMethods,
    error,
    createSetupIntent,
    isCreating,
    confirmVerification,
    isConfirming,
    removeMethod,
    isRemoving,
    refetch,
  } = usePaymentVerification();

  const handleAddPaymentMethod = async () => {
    const setupIntent = await createSetupIntent(selectedMethodType);

    // In production, use Stripe Elements to collect payment details
    // For now, simulate the process
    console.log('Setup Intent created:', setupIntent);

    // Mock: Auto-confirm for demo
    await confirmVerification({
      setupIntentId: setupIntent.setupIntentId,
      paymentMethodId: `pm_mock_${Date.now()}`,
    });

    setShowAddDialog(false);
  };

  const handleRemoveMethod = async () => {
    if (!methodToRemove) return;
    await removeMethod(methodToRemove);
    setMethodToRemove(null);
  };

  if (isLoading) {
    return <PaymentVerificationSkeleton />;
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="text-destructive h-12 w-12" />
          <div className="text-center">
            <p className="font-medium">Failed to load payment verification</p>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="text-primary h-5 w-5" />
            Payment Verification
          </CardTitle>
          <CardDescription>Verify a payment method to unlock additional features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className={cn('rounded-full p-3', status?.isVerified ? 'bg-emerald-100' : 'bg-muted')}
            >
              {status?.isVerified ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              ) : (
                <CreditCard className="text-muted-foreground h-8 w-8" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {status?.isVerified ? 'Payment Verified' : 'Not Verified'}
              </p>
              <p className="text-muted-foreground text-sm">
                {status?.isVerified
                  ? `Verified on ${new Date(status.verifiedAt).toLocaleDateString()}`
                  : 'Add a payment method to verify your account'}
              </p>
            </div>
            {!status?.isVerified && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Benefits Card */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {status?.benefits.map((benefit) => (
              <div
                key={benefit.label}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3',
                  benefit.available ? 'border-emerald-200 bg-emerald-50' : 'border-dashed'
                )}
              >
                {benefit.available ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <Shield className="text-muted-foreground h-5 w-5" />
                )}
                <span className={cn('text-sm', !benefit.available && 'text-muted-foreground')}>
                  {benefit.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Your verified payment methods</CardDescription>
          </div>
          <Button variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingMethods ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : methods?.paymentMethods && methods.paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {methods.paymentMethods.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  onRemove={() => setMethodToRemove(method.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <CreditCard className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground">No payment methods added</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Payment Method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>Choose a payment method type to add</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <button
              className={cn(
                'flex items-center gap-4 rounded-lg border p-4 text-left transition-colors',
                selectedMethodType === 'card' && 'ring-primary ring-2'
              )}
              type="button"
              onClick={() => setSelectedMethodType('card')}
            >
              <div className="rounded-lg bg-blue-100 p-2">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Credit or Debit Card</p>
                <p className="text-muted-foreground text-sm">
                  Add a Visa, Mastercard, or American Express
                </p>
              </div>
            </button>

            <button
              className={cn(
                'flex items-center gap-4 rounded-lg border p-4 text-left transition-colors',
                selectedMethodType === 'bank_account' && 'ring-primary ring-2'
              )}
              type="button"
              onClick={() => setSelectedMethodType('bank_account')}
            >
              <div className="rounded-lg bg-emerald-100 p-2">
                <Building2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">Bank Account</p>
                <p className="text-muted-foreground text-sm">
                  Link your bank account for direct deposits
                </p>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button disabled={isCreating || isConfirming} onClick={handleAddPaymentMethod}>
              {isCreating || isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {selectedMethodType === 'card' ? 'Card' : 'Bank Account'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!methodToRemove} onOpenChange={() => setMethodToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Payment Method</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodToRemove(null)}>
              Cancel
            </Button>
            <Button disabled={isRemoving} variant="destructive" onClick={handleRemoveMethod}>
              {isRemoving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface PaymentMethodCardProps {
  readonly method: PaymentMethod;
  readonly onRemove: () => void;
}

function PaymentMethodCard({ method, onRemove }: PaymentMethodCardProps) {
  const Icon = method.type === 'card' ? CreditCard : Building2;

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div
        className={cn('rounded-lg p-2', method.type === 'card' ? 'bg-blue-100' : 'bg-emerald-100')}
      >
        <Icon
          className={cn('h-5 w-5', method.type === 'card' ? 'text-blue-600' : 'text-emerald-600')}
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium capitalize">{method.brand || method.type}</p>
          {method.isDefault && (
            <Badge className="text-xs" variant="secondary">
              Default
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {method.type === 'card' ? (
            <>
              •••• {method.last4}
              {method.expiryMonth && method.expiryYear && (
                <span className="ml-2">
                  Expires {method.expiryMonth}/{method.expiryYear}
                </span>
              )}
            </>
          ) : (
            <>•••• {method.last4}</>
          )}
        </p>
      </div>
      <Button size="icon" variant="ghost" onClick={onRemove}>
        <Trash2 className="text-muted-foreground h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function PaymentVerificationSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-1 h-4 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
