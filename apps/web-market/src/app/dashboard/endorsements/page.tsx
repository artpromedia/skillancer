import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { EndorsementsContent } from './components/endorsements-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Endorsements | Skillancer',
  description: 'Manage endorsements from clients and colleagues.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function EndorsementsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/endorsements');
  }

  return <EndorsementsContent />;
}
