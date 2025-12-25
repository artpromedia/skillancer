/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { redirect } from 'next/navigation';

import { PortfolioManager } from './components/portfolio-manager';

import type { Metadata } from 'next';

import { getAuthSession } from '@/lib/auth';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Manage Portfolio | Skillancer',
  description: 'Showcase your best work to attract clients.',
};

// ============================================================================
// Page
// ============================================================================

export default async function DashboardPortfolioPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/profile/portfolio');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Manage Portfolio</h1>
          <p className="text-muted-foreground mt-1">Showcase your best work to attract clients</p>
        </div>

        <PortfolioManager userId={session.userId} />
      </div>
    </main>
  );
}
