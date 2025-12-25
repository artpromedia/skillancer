/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { redirect } from 'next/navigation';

import { ProfileEditForm } from './components/profile-edit-form';

import type { Metadata } from 'next';

import { getAuthSession } from '@/lib/auth';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Edit Profile | Skillancer',
  description: 'Manage your freelancer profile, bio, hourly rate, and availability settings.',
};

// ============================================================================
// Page
// ============================================================================

export default async function DashboardProfilePage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/profile');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your public profile information</p>
        </div>

        <ProfileEditForm userId={session.userId} />
      </div>
    </main>
  );
}
