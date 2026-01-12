import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { GuildsContent } from './components/guilds-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'My Guilds | Skillancer',
  description: 'Manage your guild memberships and team collaborations.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function DashboardGuildsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/guilds');
  }

  return <GuildsContent />;
}
