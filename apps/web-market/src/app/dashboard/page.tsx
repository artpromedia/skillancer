/**
 * Dashboard Page - Protected route requiring authentication
 */

import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { DashboardContent } from './components/dashboard-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Dashboard | Skillancer',
  description: 'Manage your freelancing business on Skillancer.',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user initials from name
 */
function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

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

export default async function DashboardPage() {
  // Check authentication
  const session = await getAuthSession();

  if (!session) {
    // Redirect to login with return URL
    redirect('/login?redirect=/dashboard');
  }

  // Extract user info for display
  const userName = getDisplayName(session.firstName, session.lastName, session.email);
  const userInitials = getInitials(session.firstName, session.lastName, session.email);

  return <DashboardContent userName={userName} userInitials={userInitials} />;
}
