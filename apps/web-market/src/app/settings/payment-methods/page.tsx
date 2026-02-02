'use client';

/**
 * Payment Methods Settings Page
 *
 * Manage saved payment methods for making payments as a client.
 */

import { ArrowLeft, CreditCard, Plus, Shield, Lock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, Suspense } from 'react';

import { AddPaymentMethod } from '@/components/payments/AddPaymentMethod';
import { PaymentMethodList } from '@/components/payments/PaymentMethodList';
import { usePaymentMethods } from '@/hooks/use-payment-methods';

// ============================================================================
// Components
// ============================================================================

function LoadingState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-500">Loading payment methods...</p>
      </div>
    </div>
  );
}

function PaymentMethodsContent() {
  const { hasPaymentMethod, paymentMethods, isLoading, error } = usePaymentMethods();
  const [showAddForm, setShowAddForm] = useState(false);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-red-800">Error Loading Payment Methods</h3>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <button
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Payment Method Section */}
      {showAddForm ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <AddPaymentMethod
            setAsDefault={!hasPaymentMethod}
            onCancel={() => setShowAddForm(false)}
            onSuccess={() => setShowAddForm(false)}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Saved Payment Methods</h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasPaymentMethod
                ? `You have ${paymentMethods.length} payment method${paymentMethods.length > 1 ? 's' : ''} saved.`
                : 'Add a payment method to hire freelancers.'}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add Payment Method
          </button>
        </div>
      )}

      {/* Payment Methods List */}
      {!showAddForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <PaymentMethodList showActions />
        </div>
      )}

      {/* Security Info */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h4 className="text-sm font-semibold text-gray-900">Payment Security</h4>
        <p className="mt-2 text-sm text-gray-600">
          Your payment information is securely stored by Stripe, our payment processor. We never
          store your full card number or sensitive details on our servers.
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4 text-green-600" />
            <span>PCI DSS Compliant</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Lock className="h-4 w-4 text-green-600" />
            <span>256-bit SSL Encryption</span>
          </div>
          <a
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            href="https://stripe.com/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Stripe Privacy Policy →
          </a>
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900">Frequently Asked Questions</h4>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-700">When will I be charged?</dt>
            <dd className="mt-1 text-sm text-gray-500">
              You&apos;ll be charged when you fund escrow for a contract or when a milestone payment
              is due. All payments go through our secure escrow system.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-700">
              What payment methods are accepted?
            </dt>
            <dd className="mt-1 text-sm text-gray-500">
              We accept all major credit and debit cards (Visa, Mastercard, American Express,
              Discover) and bank accounts (ACH).
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-700">
              How do I change my default payment method?
            </dt>
            <dd className="mt-1 text-sm text-gray-500">
              Click the menu icon (•••) next to any payment method and select &quot;Set as
              Default&quot;. Your default method will be pre-selected during checkout.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PaymentMethodsSettingsPage() {
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

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your saved payment methods for hiring freelancers
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Suspense fallback={<LoadingState />}>
          <PaymentMethodsContent />
        </Suspense>
      </div>
    </div>
  );
}
