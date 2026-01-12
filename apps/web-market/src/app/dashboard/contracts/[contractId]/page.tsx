import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { ContractDetailContent } from './components/contract-detail-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Contract Details | Skillancer',
  description: 'View and manage your contract details.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function ContractDetailPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/contracts');
  }

  return <ContractDetailContent />;
}
