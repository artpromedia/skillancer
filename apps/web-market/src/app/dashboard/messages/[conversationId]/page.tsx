import { redirect } from 'next/navigation';

import { getAuthSession } from '@/lib/auth';

import { ConversationContent } from './components/conversation-content';

import type { Metadata } from 'next';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Conversation | Skillancer',
  description: 'View and manage your conversation.',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function ConversationPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/messages');
  }

  return <ConversationContent />;
}
