import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { MessagesContent } from './components/messages-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Messages | Skillancer',
  description: 'Communicate with clients and manage your conversations.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function MessagesPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/messages');
  }

  return <MessagesContent />;
}
