'use client';

/**
 * Settings Index Page
 *
 * Navigation hub for all user settings including payments,
 * notifications, and account preferences.
 *
 * @module app/settings/page
 */

import {
  ArrowLeft,
  Bell,
  CreditCard,
  Lock,
  User,
  ChevronRight,
  Shield,
  Building2,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface SettingsLinkProps {
  href: string;
  icon: typeof Bell;
  title: string;
  description: string;
  badge?: string;
}

// ============================================================================
// Components
// ============================================================================

function SettingsLink({ href, icon: Icon, title, description, badge }: SettingsLinkProps) {
  return (
    <Link
      className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-md"
      href={href}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 group-hover:bg-indigo-100">
          <Icon className="h-6 w-6 text-gray-600 group-hover:text-indigo-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {badge && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
    </Link>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            href="/dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your account settings and preferences</p>
        </div>

        {/* Settings Grid */}
        <div className="space-y-4">
          {/* Account Section */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Account
            </h2>
            <div className="space-y-3">
              <SettingsLink
                description="Update your personal information and profile photo"
                href="/settings/profile"
                icon={User}
                title="Profile"
              />
              <SettingsLink
                description="Password, two-factor authentication, and sessions"
                href="/settings/security"
                icon={Lock}
                title="Security"
              />
            </div>
          </div>

          {/* Payments Section */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Payments
            </h2>
            <div className="space-y-3">
              <SettingsLink
                badge="Stripe Connect"
                description="Manage how you receive payments for your work"
                href="/settings/payments"
                icon={CreditCard}
                title="Payment Settings"
              />
            </div>
          </div>

          {/* Verification Section */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Verification
            </h2>
            <div className="space-y-3">
              <SettingsLink
                description="Verify your identity to unlock platform features"
                href="/settings/verification"
                icon={Shield}
                title="Identity Verification"
              />
              <SettingsLink
                description="Verify your business for enterprise clients"
                href="/settings/business"
                icon={Building2}
                title="Business Verification"
              />
            </div>
          </div>

          {/* Notifications Section */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Notifications
            </h2>
            <div className="space-y-3">
              <SettingsLink
                description="Control how and when you receive notifications"
                href="/settings/notifications"
                icon={Bell}
                title="Notification Preferences"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <Link className="font-medium text-indigo-600 hover:text-indigo-500" href="/help">
              Visit our Help Center
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
