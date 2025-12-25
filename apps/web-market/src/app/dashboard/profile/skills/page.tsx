/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { redirect } from 'next/navigation';

import { SkillsManager } from './components/skills-manager';

import type { Metadata } from 'next';

import { getAuthSession } from '@/lib/auth';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Manage Skills | Skillancer',
  description: 'Add, verify, and manage your professional skills.',
};

// ============================================================================
// Page
// ============================================================================

export default async function DashboardSkillsPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/profile/skills');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Manage Skills</h1>
          <p className="text-muted-foreground mt-1">
            Add your skills and verify them through SkillPod assessments
          </p>
        </div>

        <SkillsManager userId={session.userId} />
      </div>
    </main>
  );
}
