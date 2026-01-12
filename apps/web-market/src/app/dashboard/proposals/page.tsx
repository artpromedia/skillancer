import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { ProposalsContent } from './components/proposals-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'My Proposals | Skillancer',
  description: 'Track and manage your job proposals.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function FreelancerProposalsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/proposals');
  }

  return <ProposalsContent />;
}
