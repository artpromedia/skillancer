'use client';

/**
 * Earnings & Payouts Page
 *
 * Dashboard for freelancers to view earnings, request payouts,
 * and manage payout settings.
 */

import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  Settings,
  ExternalLink,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';

import {
  BalanceCard,
  PayoutHistoryTable,
  RequestPayoutModal,
  PayoutScheduleSettings,
} from '@/components/payouts';
import { useStripeConnect } from '@/hooks/use-stripe-connect';

// ============================================================================
// Components
// ============================================================================

function LoadingState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm text-gray-500">Loading earnings...</p>
      </div>
    </div>
  );
}

function ConnectStripePrompt() {
  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
        <Wallet className="h-8 w-8 text-yellow-600" />
      </div>
      <h3 className="mt-6 text-xl font-semibold text-gray-900">Connect Your Payment Account</h3>
      <p className="mx-auto mt-3 max-w-md text-gray-600">
        To view your earnings and withdraw funds, you need to connect a payment account first. This
        allows us to securely transfer your earnings to your bank account.
      </p>
      <Link
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        href="/settings/payments"
      >
        Connect Payment Account
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}

function EarningsContent() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const { hasAccount, isActive, isLoading: connectLoading } = useStripeConnect();

  if (connectLoading) {
    return <LoadingState />;
  }

  // User needs to connect Stripe first
  if (!hasAccount || !isActive) {
    return <ConnectStripePrompt />;
  }

  return (
    <div className="space-y-8">
      {/* Balance & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Balance Card */}
        <div className="lg:col-span-2">
          <BalanceCard onWithdraw={() => setShowPayoutModal(true)} />
        </div>

        {/* Quick Links */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">Quick Actions</h4>
            <div className="space-y-2">
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowPayoutModal(true)}
              >
                <Wallet className="h-4 w-4 text-indigo-600" />
                Request Payout
              </button>
              <Link
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                href="/settings/payments"
              >
                <Settings className="h-4 w-4 text-gray-500" />
                Payment Settings
              </Link>
              <Link
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                href="/dashboard/contracts"
              >
                <TrendingUp className="h-4 w-4 text-green-600" />
                View Contracts
              </Link>
            </div>
          </div>

          {/* Help Card */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-5 w-5 text-gray-400" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Need Help?</h4>
                <p className="mt-1 text-xs text-gray-500">
                  Questions about payouts or earnings?{' '}
                  <a className="text-indigo-600 hover:underline" href="/help/payments">
                    Visit our help center
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Schedule */}
      <PayoutScheduleSettings />

      {/* Payout History */}
      <PayoutHistoryTable
        showViewAll
        limit={10}
        onViewAll={() => {
          // Could navigate to full history page
        }}
      />

      {/* Request Payout Modal */}
      <RequestPayoutModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        onSuccess={() => setShowPayoutModal(false)}
      />
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function EarningsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            href="/dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Earnings & Payouts</h1>
              <p className="mt-1 text-sm text-gray-500">
                View your earnings and manage withdrawals
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Suspense fallback={<LoadingState />}>
          <EarningsContent />
        </Suspense>

        {/* FAQ Section */}
        <div className="mt-12 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-gray-900">How long do payouts take?</h4>
              <p className="mt-1 text-sm text-gray-600">
                Standard payouts arrive in 2-5 business days depending on your bank and region.
                Instant payouts are available within 30 minutes for eligible accounts.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">What are the payout fees?</h4>
              <p className="mt-1 text-sm text-gray-600">
                Standard payouts have minimal fees (typically $0.25-$3 depending on region). Instant
                payouts have an additional 1.5% fee with a minimum of $1.50.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                What&apos;s the minimum payout amount?
              </h4>
              <p className="mt-1 text-sm text-gray-600">
                The minimum payout amount is $25 USD (or equivalent in your currency). This ensures
                fees don&apos;t eat into small withdrawals.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Can I cancel a payout?</h4>
              <p className="mt-1 text-sm text-gray-600">
                Pending payouts can be cancelled. Once a payout is processing or in transit, it
                cannot be cancelled and will need to complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
