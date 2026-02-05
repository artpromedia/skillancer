/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Payments Settings Page
 *
 * Manage Stripe Connect account for receiving payments as a freelancer.
 * Handles onboarding flow, account status display, and payout settings.
 *
 * @module app/settings/payments/page
 */

import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
  AlertTriangle,
  DollarSign,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';

import {
  useStripeConnect,
  getStatusLabel,
  getStatusColor,
  getRequirementDisplayName,
} from '@/hooks/use-stripe-connect';

// ============================================================================
// Types
// ============================================================================

interface StatusBannerProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onDismiss?: () => void;
}

// ============================================================================
// Components
// ============================================================================

function StatusBanner({ type, title, message, onDismiss }: StatusBannerProps) {
  const styles = {
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      titleColor: 'text-green-800',
      textColor: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: XCircle,
      iconColor: 'text-red-500',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      titleColor: 'text-yellow-800',
      textColor: 'text-yellow-700',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: Info,
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
    },
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <div className={`rounded-lg border p-4 ${style.bg}`}>
      <div className="flex">
        <Icon className={`h-5 w-5 ${style.iconColor}`} />
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${style.titleColor}`}>{title}</h3>
          <p className={`mt-1 text-sm ${style.textColor}`}>{message}</p>
        </div>
        {onDismiss && (
          <button className="ml-4 text-gray-400 hover:text-gray-600" onClick={onDismiss}>
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm text-gray-500">Loading payment settings...</p>
      </div>
    </div>
  );
}

function NotConnectedState({
  onConnect,
  isConnecting,
}: {
  onConnect: () => Promise<void>;
  isConnecting: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
        <Landmark className="h-8 w-8 text-indigo-600" />
      </div>

      <h3 className="mt-6 text-lg font-semibold text-gray-900">Set Up Payments</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        Connect with Stripe to receive payments for your work. We use Stripe Express for secure,
        fast payouts to your bank account.
      </p>

      <div className="mx-auto mt-6 grid max-w-lg gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-4">
          <Shield className="mx-auto h-6 w-6 text-indigo-600" />
          <p className="mt-2 text-xs font-medium text-gray-900">Secure</p>
          <p className="text-xs text-gray-500">Bank-level encryption</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <Clock className="mx-auto h-6 w-6 text-indigo-600" />
          <p className="mt-2 text-xs font-medium text-gray-900">Fast</p>
          <p className="text-xs text-gray-500">2-day payouts</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <DollarSign className="mx-auto h-6 w-6 text-indigo-600" />
          <p className="mt-2 text-xs font-medium text-gray-900">Low Fees</p>
          <p className="text-xs text-gray-500">Competitive rates</p>
        </div>
      </div>

      <button
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isConnecting}
        onClick={onConnect}
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Connect with Stripe
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="mt-4 text-xs text-gray-500">
        You&apos;ll be redirected to Stripe to complete verification
      </p>
    </div>
  );
}

function OnboardingState({
  account,
  onContinue,
  isContinuing,
}: {
  account: NonNullable<ReturnType<typeof useStripeConnect>['account']>;
  onContinue: () => Promise<void>;
  isContinuing: boolean;
}) {
  const currentlyDue = account.requirements?.currentlyDue ?? [];

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
          <AlertCircle className="h-6 w-6 text-yellow-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-900">Complete Your Account Setup</h3>
          <p className="mt-1 text-sm text-yellow-700">
            Please complete the following to start receiving payments:
          </p>

          {currentlyDue.length > 0 && (
            <ul className="mt-4 space-y-2">
              {currentlyDue.slice(0, 5).map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-yellow-800">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-600" />
                  {getRequirementDisplayName(item)}
                </li>
              ))}
              {currentlyDue.length > 5 && (
                <li className="text-sm text-yellow-700">
                  And {currentlyDue.length - 5} more items...
                </li>
              )}
            </ul>
          )}

          <button
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 disabled:opacity-50"
            disabled={isContinuing}
            onClick={onContinue}
          >
            {isContinuing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Continue Setup
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActiveAccountState({
  account,
  onOpenDashboard,
  isOpeningDashboard,
  onUpdateAccount,
  isUpdating,
  onDisconnect,
  isDisconnecting,
}: {
  account: NonNullable<ReturnType<typeof useStripeConnect>['account']>;
  onOpenDashboard: () => Promise<void>;
  isOpeningDashboard: boolean;
  onUpdateAccount: () => Promise<void>;
  isUpdating: boolean;
  onDisconnect: () => Promise<void>;
  isDisconnecting: boolean;
}) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const hasExternalAccount = !!account.externalAccount?.last4;
  const hasRestrictions =
    (account.requirements?.currentlyDue?.length ?? 0) > 0 ||
    (account.requirements?.pastDue?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Payments Enabled</h3>
              <p className="text-sm text-gray-500">Your account is ready to receive payments</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(account.status)}`}
          >
            {getStatusLabel(account.status)}
          </span>
        </div>

        {/* Account Details */}
        <div className="mt-6 grid gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-500">Charges</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-900">
              {account.chargesEnabled ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Enabled
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  Disabled
                </>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Payouts</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-900">
              {account.payoutsEnabled ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Enabled
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  Disabled
                </>
              )}
            </p>
          </div>
          {hasExternalAccount && (
            <div>
              <p className="text-sm font-medium text-gray-500">Payout Method</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                <Landmark className="h-4 w-4 text-gray-400" />
                {account.externalAccount?.bank ?? 'Bank Account'} ••••
                {account.externalAccount?.last4}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isOpeningDashboard}
            onClick={onOpenDashboard}
          >
            {isOpeningDashboard ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            View Stripe Dashboard
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isUpdating}
            onClick={onUpdateAccount}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Update Account
          </button>
        </div>
      </div>

      {/* Restrictions Warning */}
      {hasRestrictions && (
        <StatusBanner
          message={`Please update the following: ${[
            ...(account.requirements?.currentlyDue ?? []),
            ...(account.requirements?.pastDue ?? []),
          ]
            .slice(0, 3)
            .map(getRequirementDisplayName)
            .join(', ')}`}
          title="Action Required"
          type="warning"
        />
      )}

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h4 className="text-sm font-semibold text-red-900">Danger Zone</h4>
        <p className="mt-1 text-sm text-red-700">
          Disconnecting your Stripe account will prevent you from receiving payments.
        </p>

        {showDisconnectConfirm ? (
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm font-medium text-red-800">Are you sure?</p>
            <button
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              disabled={isDisconnecting}
              onClick={() => {
                void onDisconnect();
                setShowDisconnectConfirm(false);
              }}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
            </button>
            <button
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setShowDisconnectConfirm(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => setShowDisconnectConfirm(true)}
          >
            Disconnect Stripe Account
          </button>
        )}
      </div>
    </div>
  );
}

function RestrictedAccountState({
  account,
  onUpdateAccount,
  isUpdating,
}: {
  account: NonNullable<ReturnType<typeof useStripeConnect>['account']>;
  onUpdateAccount: () => Promise<void>;
  isUpdating: boolean;
}) {
  const allRequirements = [
    ...(account.requirements?.pastDue ?? []),
    ...(account.requirements?.currentlyDue ?? []),
  ] as string[];

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-900">Account Restricted</h3>
          <p className="mt-1 text-sm text-red-700">
            Your account has restrictions. Please update the following information to restore full
            functionality:
          </p>

          {allRequirements.length > 0 && (
            <ul className="mt-4 space-y-2">
              {allRequirements.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-red-800">
                  <XCircle className="h-4 w-4 text-red-500" />
                  {getRequirementDisplayName(item)}
                </li>
              ))}
            </ul>
          )}

          <button
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            disabled={isUpdating}
            onClick={onUpdateAccount}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Update Account
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component (Inner)
// ============================================================================

function PaymentsSettingsContent() {
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<StatusBannerProps | null>(null);

  const {
    account,
    isLoading,
    error,
    hasAccount,
    isOnboarding,
    isActive,
    isRestricted,
    createAccount,
    isCreating,
    startOnboarding,
    isStartingOnboarding,
    openDashboard,
    isOpeningDashboard,
    disconnect,
    isDisconnecting,
    refetch,
  } = useStripeConnect({
    refetchInterval: isOnboarding ? 5000 : false, // Poll while onboarding
  });

  // Handle return from Stripe
  useEffect(() => {
    const status = searchParams.get('status');
    const connected = searchParams.get('connected');
    const refresh = searchParams.get('refresh');

    if (status === 'success' || connected === 'true') {
      setBanner({
        type: 'success',
        title: 'Setup Complete',
        message: 'Your payment account has been set up successfully. You can now receive payments!',
      });
      void refetch();
    } else if (status === 'incomplete') {
      setBanner({
        type: 'warning',
        title: 'Setup Incomplete',
        message: 'Your account setup is incomplete. Please continue to enable payments.',
      });
    } else if (refresh === 'true') {
      setBanner({
        type: 'info',
        title: 'Session Expired',
        message: 'Your setup session expired. Please continue where you left off.',
      });
    }

    // Clear URL params
    if (status || refresh || connected) {
      window.history.replaceState({}, '', '/settings/payments');
    }
  }, [searchParams, refetch]);

  const handleConnect = useCallback(async () => {
    try {
      await createAccount();
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Connection Failed',
        message: err instanceof Error ? err.message : 'Failed to connect with Stripe',
      });
    }
  }, [createAccount]);

  const handleContinueOnboarding = useCallback(async () => {
    try {
      await startOnboarding('/settings/payments?status=success');
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to continue onboarding',
      });
    }
  }, [startOnboarding]);

  const handleUpdateAccount = useCallback(async () => {
    try {
      await startOnboarding('/settings/payments?status=success');
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update account',
      });
    }
  }, [startOnboarding]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      setBanner({
        type: 'success',
        title: 'Account Disconnected',
        message: 'Your Stripe account has been disconnected.',
      });
    } catch (err) {
      setBanner({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to disconnect account',
      });
    }
  }, [disconnect]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <StatusBanner
        message={error?.message ?? 'An unexpected error occurred'}
        title="Error Loading Payment Settings"
        type="error"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      {banner && <StatusBanner {...banner} onDismiss={() => setBanner(null)} />}

      {/* Content based on state */}
      {!hasAccount && <NotConnectedState isConnecting={isCreating} onConnect={handleConnect} />}

      {hasAccount && isOnboarding && account && (
        <OnboardingState
          account={account}
          isContinuing={isStartingOnboarding}
          onContinue={handleContinueOnboarding}
        />
      )}

      {hasAccount && isActive && account && (
        <ActiveAccountState
          account={account}
          isDisconnecting={isDisconnecting}
          isOpeningDashboard={isOpeningDashboard}
          isUpdating={isStartingOnboarding}
          onDisconnect={handleDisconnect}
          onOpenDashboard={openDashboard}
          onUpdateAccount={handleUpdateAccount}
        />
      )}

      {hasAccount && isRestricted && account && (
        <RestrictedAccountState
          account={account}
          isUpdating={isStartingOnboarding}
          onUpdateAccount={handleUpdateAccount}
        />
      )}

      {/* Info Section */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h4 className="text-sm font-semibold text-gray-900">About Stripe Connect</h4>
        <p className="mt-2 text-sm text-gray-600">
          Skillancer uses Stripe Connect to securely process payments and deposits to your bank
          account. Your financial information is never stored on our servers - it&apos;s handled
          entirely by Stripe, a PCI Level 1 certified payment processor.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <a
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            href="https://stripe.com/connect"
            rel="noopener noreferrer"
            target="_blank"
          >
            Learn about Stripe Connect
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
          <a
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            href="https://stripe.com/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Stripe Privacy Policy
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PaymentsSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            href="/settings"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">Payment Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage how you receive payments for your work
          </p>
        </div>

        {/* Main Content - wrapped in Suspense for useSearchParams */}
        <Suspense fallback={<LoadingState />}>
          <PaymentsSettingsContent />
        </Suspense>
      </div>
    </div>
  );
}
