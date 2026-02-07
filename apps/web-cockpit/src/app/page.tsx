/**
 * Cockpit Home Page - Protected route requiring authentication
 *
 * Server component that handles authentication before rendering
 * the client dashboard.
 *
 * @module app/page
 */

import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/server-auth';

import { CockpitDashboard } from './components/cockpit-dashboard';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Dashboard | Cockpit',
  description: 'Manage your freelancing business with Skillancer Cockpit.',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display name from session
 */
function getDisplayName(firstName?: string, lastName?: string, email?: string): string {
  if (firstName) {
    return firstName;
  }
  if (email) {
    return email.split('@')[0] || 'User';
  }
  return 'User';
}

// ============================================================================
// Page Component
// ============================================================================

export default async function CockpitHome() {
  // Check authentication
  const session = await getAuthSession();

  if (!session) {
    // Redirect to login with return URL
    redirect('/login?redirect=/');
  }

  // Extract user info for display
  const userName = getDisplayName(session.firstName, session.lastName, session.email);

  return <CockpitDashboard userName={userName} />;
}
