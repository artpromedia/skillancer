import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { RecommendationsContent } from './components/recommendations-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Recommendations | Skillancer',
  description: 'Manage testimonials and endorsements from clients and colleagues.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function RecommendationsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/recommendations');
  }

  return <RecommendationsContent />;
}
